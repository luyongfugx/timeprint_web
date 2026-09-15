import "server-only";
import { randomUUID } from "node:crypto";
import { resolve4 } from "node:dns/promises";
import { request } from "node:https";

import { imageMetadata, newSession, referenceURL, session, completeSession } from "./asset-service";
import { apiBase } from "./config";
import { MAX_IMAGE_BYTES, MAX_PAYLOAD_BYTES, MAX_SESSION_BYTES, type TemplateRow } from "./contracts";
import { sha256 } from "./crypto";
import { TemplateError } from "./errors";
import { logFailure } from "./log";
import { mapImages, parsePayload, payloadBytes } from "./payload";
import { registerAssetRecord } from "./repository";
import { uploadObject } from "./storage";

export function publicIPv4(address: string) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = parts;
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && [0, 168].includes(b)) ||
    (a === 198 && [18, 19, 51].includes(b)) ||
    (a === 203 && b === 0)
  );
}
export function legacyURL(value: string, kind: "cover" | "payload" | "logo") {
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    throw new TemplateError("RESOURCE_INVALID", 422);
  }
  const hosts = (process.env.TEMPLATE_ALLOWED_LEGACY_ASSET_HOSTS ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  // Historical templates also reference the app's built-in logos in wm_logo.
  const prefix = { cover: "ugc_cover", payload: "ugc_json", logo: "(?:ugc_logo|wm_logo)" }[kind];
  let pathname: string;
  try {
    pathname = decodeURIComponent(u.pathname);
  } catch {
    throw new TemplateError("RESOURCE_INVALID", 422);
  }
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    u.port ||
    u.hash ||
    !hosts.includes(u.hostname) ||
    !new RegExp(`^/(?:android/)?${prefix}/[\\p{L}\\p{N}_.-]+$`, "u").test(pathname)
  )
    throw new TemplateError("RESOURCE_INVALID", 422, "The resource source is not allowed.");
  return u;
}
// Every legacy resource rejection is silent for the client, so log the reason
// (stage + host + resolved addresses/status) before dropping the request.
function failure(stage: string, context: Record<string, unknown>, message?: string) {
  const error = new TemplateError("RESOURCE_INVALID", 422, message);
  logFailure(stage, context, error);
  return error;
}
function deny(stage: string, context: Record<string, unknown>, message?: string): never {
  throw failure(stage, context, message);
}
export async function fetchLegacy(value: string, kind: "cover" | "payload" | "logo") {
  const u = legacyURL(value, kind),
    max = kind === "payload" ? MAX_PAYLOAD_BYTES : MAX_IMAGE_BYTES,
    host = u.hostname;
  let addresses = await resolve4(u.hostname);
  // VPNs and hosted DNS can return fake-IP or link-local answers for public hosts.
  // Resolve those over HTTPS; never connect to the original non-public address.
  // The fallback answers must still pass public-address checks before being pinned.
  if (addresses.length && addresses.every((a) => /^(?:198\.(?:18|19)|169\.254)\./.test(a))) {
    const response = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(u.hostname)}&type=A`, {
      signal: AbortSignal.timeout(5000),
      redirect: "error",
      cache: "no-store",
    });
    if (!response.ok) deny("legacy-dns-fallback", { kind, host, dnsStatus: response.status, addresses });
    const result = (await response.json()) as { Status?: number; Answer?: { type: number; data: string }[] };
    if (result.Status !== 0) deny("legacy-dns-fallback", { kind, host, dnsStatusCode: result.Status, addresses });
    addresses = (result.Answer ?? []).filter((answer) => answer.type === 1).map((answer) => answer.data);
  }
  if (!addresses.length || addresses.some((a) => !publicIPv4(a))) deny("legacy-dns-address", { kind, host, addresses });
  // Pin the verified address into TLS connection lookup, closing DNS-rebinding gaps.
  // Redirects are rejected entirely; no arbitrary second host is ever fetched.
  return new Promise<Buffer>((resolve, reject) => {
    const req = request(
      u,
      {
        method: "GET",
        family: 4,
        signal: AbortSignal.timeout(10_000),
        lookup: (_host, _options, callback) => callback(null, addresses[0], 4),
      },
      (res) => {
        if (res.statusCode !== 200) {
          res.destroy();
          // This callback is outside the promise chain, so reject instead of throwing.
          reject(failure("legacy-http-status", { kind, host, statusCode: res.statusCode }));
          return;
        }
        let size = 0;
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > max) res.destroy(new TemplateError("PAYLOAD_TOO_LARGE", 413));
          else chunks.push(chunk);
        });
        res.on("end", () => resolve(Buffer.concat(chunks, size)));
        res.on("error", (error) => {
          logFailure("legacy-http-response", { kind, host, statusCode: res.statusCode }, error);
          reject(error);
        });
      },
    );
    req.on("error", (error) => {
      // Connection reset, TLS failure or the 10s abort both land here.
      logFailure("legacy-http-request", { kind, host, address: addresses[0] }, error);
      reject(error);
    });
    req.end();
  });
}
export async function legacySnapshot(
  input: {
    clientRequestID: string;
    userID: string;
    visibility: "public" | null;
    coverImageURL: string;
    jsonDownloadURL: string;
  },
  load: typeof fetchLegacy = fetchLegacy,
) {
  const credentials = await newSession(input.clientRequestID, input.userID, input.visibility);
  const s = await session(credentials.uploadSessionID, credentials.uploadToken);
  let total = 0;
  const saved = new Map<string, string>();
  const save = async (bytes: Buffer, kind: "cover" | "payload" | "logo") => {
    total += bytes.length;
    if (total > MAX_SESSION_BYTES) throw new TemplateError("PAYLOAD_TOO_LARGE", 413);
    const mime = kind === "payload" ? "application/json" : (await imageMetadata(bytes)).mime;
    const asset = await registerAssetRecord(s.id, sha256(credentials.uploadToken), {
      clientAssetID: randomUUID(),
      kind,
      contentType: mime,
      byteLength: bytes.length,
      sha256: sha256(bytes),
      objectKey: `staging/${s.id}/${randomUUID()}`,
    });
    await uploadObject(asset.object_key, bytes, mime);
    return asset.id;
  };
  const coverID = await save(await load(input.coverImageURL, "cover"), "cover");
  const payload = parsePayload(await load(input.jsonDownloadURL, "payload"), input.visibility);
  payload.coverUrl = referenceURL(s.id, coverID);
  await mapImages(payload, async (url, kind) => {
    if (kind === "cover") return referenceURL(s.id, coverID);
    if (saved.has(url)) return saved.get(url)!;
    const id = await save(await load(url, "logo"), "logo");
    const ref = referenceURL(s.id, id);
    saved.set(url, ref);
    return ref;
  });
  const payloadID = await save(payloadBytes(payload), "payload");
  await completeSession(s, credentials.uploadToken, coverID, payloadID);
  return {
    ...credentials,
    coverID,
    payloadID,
    coverImageURL: referenceURL(s.id, coverID),
    jsonDownloadURL: referenceURL(s.id, payloadID),
  };
}
export const isAssetReference = (url: string) => url.startsWith(`${apiBase()}/upload-sessions/`);

export async function snapshotForLegacyApproval(t: TemplateRow, admin: string) {
  const input = {
    clientRequestID: randomUUID(),
    userID: admin,
    visibility: "public" as const,
    coverImageURL: t.cover_asset_id ? `template-asset:${t.cover_asset_id}` : t.cover_image_url,
    jsonDownloadURL: t.payload_asset_id ? `template-asset:${t.payload_asset_id}` : t.json_download_url,
  };
  if (!t.cover_asset_id || !t.payload_asset_id) return legacySnapshot(input);
  const { getAsset, downloadObject } = await import("./asset-service");
  return legacySnapshot(input, async (url, kind) => {
    if (!url.startsWith("template-asset:")) throw new TemplateError("RESOURCE_INVALID", 422);
    const asset = await getAsset(url.slice("template-asset:".length));
    if (asset.template_id !== t.id || asset.kind !== kind || asset.state !== "sealed" || !asset.sealed_key)
      throw new TemplateError("RESOURCE_INVALID", 422);
    return downloadObject(asset.sealed_key, kind === "payload" ? MAX_PAYLOAD_BYTES : MAX_IMAGE_BYTES);
  });
}
