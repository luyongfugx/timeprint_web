import "server-only";
import { checkReadable, normalizeCode } from "./access-policy";

export { checkReadable, normalizeCode } from "./access-policy";
import sharp from "sharp";

import { getAsset, downloadObject, type Asset } from "./asset-service";
import { apiBase, enabled, shareOrigin } from "./config";
import { type TemplateRow, type TemplateDetail, MAX_PAYLOAD_BYTES, MAX_IMAGE_BYTES } from "./contracts";
import { sha256 } from "./crypto";
import { TemplateError } from "./errors";
import { privateHeaders } from "./http";
import { legacySnapshot, legacyURL } from "./legacy-assets";
import { mapImages, parsePayload, payloadBytes } from "./payload";
import { rows } from "./repository";
import { cosObjectReference } from "./storage";
import { attachLegacy } from "./transactions";

import { randomUUID } from "node:crypto";

export async function readRow(id: string): Promise<TemplateRow> {
  const [data] = await rows<TemplateRow>("SELECT * FROM template_records WHERE id=?", [id]);
  if (!data) throw new TemplateError("TEMPLATE_NOT_FOUND", 404, "Template not found.");
  return data;
}
export async function readTemplate(id: string, code?: string | null) {
  const t = await readRow(id);
  checkReadable(t, code);
  return t;
}
export async function byCode(code: string) {
  const normalized = normalizeCode(code);
  const [data] = await rows<TemplateRow>(
    "SELECT *,CAST(id AS CHAR) AS id FROM watermarks_share_links WHERE normalized_share_code=?",
    [normalized],
  );
  if (!data) throw new TemplateError("TEMPLATE_NOT_FOUND", 404, "Template not found.");
  const t = data;
  checkReadable(t, normalized);
  return t;
}
export async function ensureSnapshot(t: TemplateRow) {
  if (t.cover_asset_id && t.payload_asset_id) return t;
  const snapshot = await legacySnapshot({
    clientRequestID: randomUUID(),
    userID: randomUUID(),
    visibility: t.visibility === "public" ? "public" : null,
    coverImageURL: t.cover_image_url,
    jsonDownloadURL: t.json_download_url,
  });
  await attachLegacy(t.id, snapshot.uploadSessionID, t.updated_at);
  return readTemplate(t.id, t.share_code);
}
export function assetURL(id: string, t: TemplateRow) {
  return `${apiBase()}/assets/${id}${t.visibility !== "public" ? `?code=${encodeURIComponent(t.share_code)}` : ""}`;
}
export function detail(t: TemplateRow): TemplateDetail {
  const suffix = t.visibility !== "public" ? `?code=${encodeURIComponent(t.share_code)}` : "";
  const url = assetURL(t.cover_asset_id!, t);
  return {
    contractVersion: 2,
    templateID: String(t.id),
    legacy: t.contract_version === 1,
    visibility: t.visibility,
    watermarkName: t.visibility === "private" ? "" : t.watermark_name,
    companyName: t.visibility === "private" ? "" : (t.company_name ?? ""),
    shareCode: t.share_code,
    shareLink: `${shareOrigin()}/share?code=${encodeURIComponent(t.share_code)}`,
    cover: {
      kind: t.cover_kind,
      url,
      thumbnailURL: `${url}${suffix ? "&" : "?"}variant=thumb`,
      width: t.cover_width ?? 1,
      height: t.cover_height ?? 1,
    },
    payload: {
      url: `${apiBase()}/templates/${encodeURIComponent(t.id)}/payload${suffix}`,
      schemaVersion: t.payload_schema_version,
      contentVersion: t.content_version,
    },
    useCount: t.visibility === "public" ? Number(t.use_count) : null,
    createdAt: t.created_at,
    expiresAt:
      t.contract_version === 1
        ? Number(t.expire_time) > 0
          ? new Date(Number(t.expire_time) * 1000).toISOString()
          : null
        : t.expires_at,
    canShare: true,
    canReport: enabled("REPORT"),
  };
}
export function card(t: TemplateRow) {
  const { payload: _payload, ...result } = detail(t);
  return result;
}
export async function payloadResponse(t: TemplateRow) {
  t = await ensureSnapshot(t);
  const asset = await getAsset(t.payload_asset_id!);
  if (asset.template_id !== t.id || asset.kind !== "payload" || asset.state !== "sealed" || !asset.sealed_key)
    throw new TemplateError("RESOURCE_INVALID", 422);
  const bytes = await downloadObject(asset.sealed_key, MAX_PAYLOAD_BYTES);
  const payload = parsePayload(bytes, t.visibility);
  const images = await rows<Asset>(
    "SELECT * FROM template_asset_records WHERE template_id=? AND kind IN ('cover','logo') AND state='sealed' AND sealed_key IS NOT NULL AND request_id IS NULL",
    [t.id],
  );
  await mapImages(payload, async (url, kind) => {
    const a = images.find(
      (image) =>
        image.kind === kind &&
        (url === `template-asset:${image.id}` ||
          url === cosObjectReference(image.sealed_key!) ||
          url === cosObjectReference(image.object_key)),
    );
    if (!a) throw new TemplateError("RESOURCE_INVALID", 422);
    return cosObjectReference(a.sealed_key!);
  });
  await readTemplate(t.id, t.share_code);
  const output = payloadBytes(payload);
  return new Response(output, {
    headers: { ...privateHeaders, "Content-Type": "application/json", "X-Payload-SHA256": sha256(output) },
  });
}
export async function assetResponse(id: string, code: string | null, thumbnail = false) {
  const asset = await getAsset(id);
  if (!asset.template_id || asset.request_id || asset.state !== "sealed" || !asset.sealed_key)
    throw new TemplateError("TEMPLATE_NOT_FOUND", 404);
  const t = await readTemplate(asset.template_id, code);
  if (asset.kind === "payload") return payloadResponse(t);
  let bytes: Buffer = await downloadObject(asset.sealed_key, MAX_IMAGE_BYTES);
  if (thumbnail)
    bytes = await sharp(bytes, { limitInputPixels: 25_000_000 })
      .resize({ width: 480, height: 640, fit: "inside", withoutEnlargement: true })
      .toBuffer();
  await readTemplate(t.id, code);
  return new Response(new Uint8Array(bytes), {
    headers: { ...privateHeaders, "Content-Type": asset.mime, "Content-Length": String(bytes.length) },
  });
}
export function legacyDTO(t: TemplateRow) {
  const d = detail(t);
  return {
    id: d.templateID,
    watermark_name: d.watermarkName,
    company_name: d.companyName,
    cover_image_url: d.cover.url,
    json_download_url: d.payload.url,
    status: t.status,
    created_at: t.created_at,
    share_code: t.share_code,
    expire_time: t.expire_time,
  };
}

export async function legacyDownloadDTO(t: TemplateRow) {
  const result = legacyDTO(t);
  if (t.visibility === "private") return result;
  if (!t.cover_asset_id && !t.payload_asset_id && t.contract_version === 1) {
    // Reading an old share must not download, migrate and re-upload its resources.
    return {
      ...result,
      cover_image_url: legacyURL(t.cover_image_url, "cover").href,
      json_download_url: legacyURL(t.json_download_url, "payload").href,
    };
  }
  const assets = await rows<{
    id: string;
    kind: string;
    sealed_key: string;
    upload_mode: string | null;
    resource_format: string | null;
  }>(
    `SELECT a.id,a.kind,a.sealed_key,JSON_UNQUOTE(JSON_EXTRACT(s.completion_json,'$.uploadMode')) AS upload_mode,
       JSON_UNQUOTE(JSON_EXTRACT(s.completion_json,'$.resourceFormat')) AS resource_format
     FROM template_assets a JOIN template_upload_sessions s ON s.id=a.upload_session_id
     WHERE a.template_id=? AND a.id IN (?,?) AND a.state='sealed' AND a.sealed_key IS NOT NULL
       AND a.request_id IS NULL`,
    [t.id, t.cover_asset_id, t.payload_asset_id],
  );
  const cover = assets.find((a) => a.id === t.cover_asset_id && a.kind === "cover");
  const payload = assets.find((a) => a.id === t.payload_asset_id && a.kind === "payload");
  if (!cover || !payload) throw new TemplateError("RESOURCE_INVALID", 422);
  // Old sealed snapshots still require payloadResponse's reference conversion.
  if (payload.upload_mode !== "deferred" && payload.resource_format !== "cos") return result;
  return {
    ...result,
    cover_image_url: cosObjectReference(cover.sealed_key),
    json_download_url: cosObjectReference(payload.sealed_key),
  };
}
