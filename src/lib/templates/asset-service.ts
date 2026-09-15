import "server-only";
import { randomBytes, randomUUID } from "node:crypto";

import sharp from "sharp";
import { z } from "zod";

import { apiBase } from "./config";
import { registerAssetSchema } from "./contracts";
import { actorHash, canonical, equalSecret, sha256 } from "./crypto";
import { TemplateError } from "./errors";
import { mapImages, parsePayload, payloadBytes } from "./payload";
import { rows, write, rateLimit, registerAssetRecord, completeSessionRecord, parseJSON } from "./repository";
import { cosObjectReference, downloadObject, signedUpload, uploadObject } from "./storage";

export { downloadObject } from "./storage";

export type Asset = {
  id: string;
  upload_session_id: string;
  template_id: string | null;
  request_id: string | null;
  client_asset_id: string;
  kind: string;
  object_key: string;
  sealed_key: string | null;
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
  sha256: string;
  sealed_sha256: string | null;
  state: string;
};
export type Session = {
  id: string;
  token_hash: string;
  actor_hash: string;
  client_request_id: string;
  visibility: "public" | "private" | null;
  purpose: string;
  state: string;
  expires_at: string;
  completion_json: Record<string, unknown>;
  cover_asset_id: string;
  payload_asset_id: string;
};
export async function newSession(
  clientRequestID: string,
  userID: string,
  visibility: "public" | "private" | null,
  purpose = "template",
) {
  const actor = actorHash(userID);
  await rateLimit(actor, "session", 20, 3600);
  const token = randomBytes(32).toString("base64url");
  const id = randomUUID();
  await write(
    "INSERT INTO template_upload_sessions(id,actor_hash,client_request_id,visibility,purpose,token_hash) VALUES (?,?,?,?,?,?)",
    [id, actor, clientRequestID, visibility, purpose, sha256(token)],
  );
  const [data] = await rows<{ id: string; expires_at: string }>(
    "SELECT id,expires_at FROM template_upload_sessions WHERE id=?",
    [id],
  );
  return { uploadSessionID: data.id, uploadToken: token, expiresAt: data.expires_at };
}
export async function session(
  id: string,
  token: string,
  purpose = "template",
  allowCommitted = false,
): Promise<Session> {
  if (!z.string().uuid().safeParse(id).success || !token || token.length > 256)
    throw new TemplateError("UPLOAD_TOKEN_INVALID", 403);
  const [data] = await rows<Session>("SELECT * FROM template_upload_sessions WHERE id=?", [id]);
  if (
    !data ||
    !equalSecret(data.token_hash, sha256(token)) ||
    (purpose === "template" ? data.purpose !== purpose : !["removal", "company"].includes(data.purpose))
  )
    throw new TemplateError("UPLOAD_TOKEN_INVALID", 403);
  if (data.state === "committed" && !allowCommitted) throw new TemplateError("RESOURCE_INVALID", 422);
  if (!(allowCommitted && data.state === "committed") && Date.parse(data.expires_at) <= Date.now())
    throw new TemplateError("UPLOAD_SESSION_EXPIRED", 410);
  if (data.completion_json) data.completion_json = parseJSON(data.completion_json);
  return data;
}
export function referenceURL(sid: string, aid: string) {
  return `${apiBase()}/upload-sessions/${sid}/assets/${aid}`;
}
export function referenceID(url: string, sid: string) {
  const prefix = `${apiBase()}/upload-sessions/${sid}/assets/`;
  if (!url.startsWith(prefix)) throw new TemplateError("RESOURCE_INVALID", 422);
  const id = url.slice(prefix.length);
  if (!z.string().uuid().safeParse(id).success) throw new TemplateError("RESOURCE_INVALID", 422);
  return id;
}
// Match only the exact registered object in the authenticated session, never fetch client URLs.
export function matchesCoverReference(url: string, s: Session, asset: Asset) {
  return (
    asset.upload_session_id === s.id &&
    asset.kind === "cover" &&
    (url === referenceURL(s.id, asset.id) ||
      (s.visibility === "public" && url === cosObjectReference(asset.object_key)))
  );
}
export async function registerAsset(s: Session, token: string, input: z.infer<typeof registerAssetSchema>) {
  const asset = await registerAssetRecord(s.id, sha256(token), {
    ...input,
    objectKey: `staging/${s.id}/${randomUUID()}`,
  });
  return {
    assetID: asset.id,
    assetReferenceURL: referenceURL(s.id, asset.id),
    ...(await signedUpload(asset.object_key, asset.mime, s.expires_at)),
  };
}
export async function imageMetadata(bytes: Buffer, expected?: string) {
  try {
    const image = sharp(bytes, { limitInputPixels: 25_000_000, failOn: "warning" });
    const meta = await image.metadata();
    const mime = ({ png: "image/png", jpeg: "image/jpeg", webp: "image/webp" } as Record<string, string>)[
      meta.format ?? ""
    ];
    if (!mime || (expected && mime !== expected) || !meta.width || !meta.height || (meta.pages ?? 1) !== 1)
      throw new Error("Invalid image");
    // Force decoding; header-only metadata would accept truncated images.
    await image.stats();
    return { mime, width: meta.width, height: meta.height };
  } catch {
    throw new TemplateError("RESOURCE_INVALID", 422, "The image is invalid or exceeds the image limits.");
  }
}
export async function completeSession(
  s: Session,
  token: string,
  coverID?: string,
  payloadID?: string,
  attachmentIDs?: string[],
) {
  if (s.state === "ready") {
    if (s.purpose === "template" && (s.cover_asset_id !== coverID || s.payload_asset_id !== payloadID))
      throw new TemplateError("IDEMPOTENCY_CONFLICT", 409);
    if (
      attachmentIDs &&
      canonical([...attachmentIDs].sort()) !== canonical([...(s.completion_json.attachmentIDs as string[])].sort())
    )
      throw new TemplateError("IDEMPOTENCY_CONFLICT", 409);
    return s.completion_json;
  }
  const data = await rows<Asset>("SELECT * FROM template_asset_records WHERE upload_session_id=?", [s.id]);
  const assets = data;
  const contents = new Map<string, Buffer>();
  if (s.purpose === "template") {
    if (
      !assets.some((a) => a.id === coverID && a.kind === "cover") ||
      !assets.some((a) => a.id === payloadID && a.kind === "payload")
    )
      throw new TemplateError("RESOURCE_INVALID", 422);
  } else if (!attachmentIDs || canonical(assets.map((a) => a.id).sort()) !== canonical([...attachmentIDs].sort()))
    throw new TemplateError("RESOURCE_INVALID", 422);
  const sealed = [];
  for (const asset of assets) {
    const bytes = await downloadObject(asset.object_key, Number(asset.bytes));
    if (bytes.length !== Number(asset.bytes) || sha256(bytes) !== asset.sha256)
      throw new TemplateError("RESOURCE_INVALID", 422, "Uploaded bytes do not match the registered resource.");
    contents.set(asset.id, bytes);
    if (asset.kind !== "payload") Object.assign(asset, await imageMetadata(bytes, asset.mime));
  }
  let semanticPayloadHash = "";
  if (payloadID) {
    const payload = parsePayload(contents.get(payloadID)!, s.visibility);
    if (
      payload.coverUrl != null &&
      payload.coverUrl !== "" &&
      (typeof payload.coverUrl !== "string" ||
        !matchesCoverReference(payload.coverUrl, s, assets.find((a) => a.id === coverID)!))
    )
      throw new TemplateError("RESOURCE_INVALID", 422);
    payload.coverUrl = referenceURL(s.id, coverID!);
    await mapImages(payload, async (url, kind) => {
      const id = referenceID(url, s.id),
        asset = assets.find((a) => a.id === id && a.kind === kind);
      if (!asset) throw new TemplateError("RESOURCE_INVALID", 422);
      return `template-asset:${id}`;
    });
    contents.set(payloadID, payloadBytes(payload));
    const semantic = structuredClone(payload);
    await mapImages(semantic, async (url) => {
      const asset = assets.find((a) => `template-asset:${a.id}` === url);
      if (!asset) throw new TemplateError("RESOURCE_INVALID", 422);
      return `sha256:${asset.sha256}`;
    });
    semanticPayloadHash = sha256(payloadBytes(semantic));
  }
  for (const asset of assets) {
    const bytes = contents.get(asset.id)!;
    const key = `sealed/${s.id}/${randomUUID()}`;
    await uploadObject(key, bytes, asset.mime);
    sealed.push({
      id: asset.id,
      sealedKey: key,
      sealedSHA256: sha256(bytes),
      width: asset.width,
      height: asset.height,
    });
  }
  const cover = assets.find((a) => a.id === coverID);
  const receipt =
    s.purpose === "template"
      ? {
          state: "ready",
          coverWidth: cover!.width,
          coverHeight: cover!.height,
          payloadSHA256: sha256(contents.get(payloadID!)!),
        }
      : { state: "ready", attachmentIDs };
  const manifest = sha256(
    canonical({
      payload: semanticPayloadHash,
      images: assets
        .filter((a) => a.kind !== "payload")
        .map((a) => `${a.kind}:${a.sha256}`)
        .sort(),
    }),
  );
  return completeSessionRecord(s.id, sha256(token), sealed, manifest, receipt, coverID, payloadID);
}
export async function getAsset(id: string): Promise<Asset> {
  const [data] = await rows<Asset>("SELECT * FROM template_asset_records WHERE id=?", [id]);
  if (!data) throw new TemplateError("TEMPLATE_NOT_FOUND", 404);
  return data;
}
