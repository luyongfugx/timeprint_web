import "server-only";
import { randomUUID } from "node:crypto";

import { rows, write, transaction, type Connection, parseJSON } from "./database";
import { TemplateError } from "./errors";

export { rows, write, transaction, parseJSON } from "./database";
export async function rateLimit(key: string, action: string, limit: number, seconds: number, conn?: Connection) {
  const window = Math.floor(Date.now() / 1000 / seconds);
  const run = async (c: Connection) => {
    await write(
      "INSERT INTO template_rate_limits (`key`,action,window_start,count) VALUES (?,?,?,1) ON DUPLICATE KEY UPDATE count=count+1",
      [key, action, window],
      c,
    );
    const [r] = await rows<{ count: number }>(
      "SELECT count FROM template_rate_limits WHERE `key`=? AND action=? AND window_start=? FOR UPDATE",
      [key, action, window],
      c,
    );
    if (r.count > limit) throw new TemplateError("RATE_LIMITED", 429, "Please try again later.", true);
  };
  if (conn) await run(conn);
  else await transaction(run);
}
export async function lockedSession(id: string, tokenHash: string, conn: Connection, allowCommitted = false) {
  const [s] = await rows<Record<string, any>>(
    "SELECT * FROM template_upload_sessions WHERE id=? FOR UPDATE",
    [id],
    conn,
  );
  if (!s || s.token_hash !== tokenHash) throw new TemplateError("UPLOAD_TOKEN_INVALID", 403);
  if (!(allowCommitted && s.state === "committed") && Date.parse(s.expires_at) <= Date.now())
    throw new TemplateError("UPLOAD_SESSION_EXPIRED", 410);
  if (s.completion_json) s.completion_json = parseJSON(s.completion_json);
  return s;
}
export async function registerAssetRecord(sid: string, tokenHash: string, input: Record<string, any>) {
  return transaction(async (c) => {
    const s = await lockedSession(sid, tokenHash, c);
    if (s.state !== "open") throw new TemplateError("RESOURCE_INVALID", 422);
    const [previous] = await rows<Record<string, any>>(
      "SELECT * FROM template_assets WHERE upload_session_id=? AND client_asset_id=?",
      [sid, input.clientAssetID],
      c,
    );
    if (previous) {
      if (
        previous.sha256 !== input.sha256 ||
        previous.kind !== input.kind ||
        previous.mime !== input.contentType ||
        Number(previous.bytes) !== input.byteLength
      )
        throw new TemplateError("IDEMPOTENCY_CONFLICT", 409);
      return previous;
    }
    const assets = await rows<{ kind: string; bytes: number }>(
      "SELECT kind,bytes FROM template_assets WHERE upload_session_id=?",
      [sid],
      c,
    );
    if (
      assets.length >= (s.purpose === "template" ? 34 : 3) ||
      assets.reduce((sum, a) => sum + Number(a.bytes), 0) + input.byteLength > 52_428_800
    )
      throw new TemplateError("RESOURCE_INVALID", 422);
    if (
      s.purpose === "template" ? input.kind === "evidence" : input.kind !== "evidence" || input.byteLength > 5_242_880
    )
      throw new TemplateError("RESOURCE_INVALID", 422);
    if (["cover", "payload"].includes(input.kind) && assets.some((a) => a.kind === input.kind))
      throw new TemplateError("RESOURCE_INVALID", 422);
    const id = randomUUID();
    await write(
      "INSERT INTO template_assets (id,upload_session_id,client_asset_id,kind,object_key,mime,bytes,sha256) VALUES (?,?,?,?,?,?,?,?)",
      [id, sid, input.clientAssetID, input.kind, input.objectKey, input.contentType, input.byteLength, input.sha256],
      c,
    );
    return (await rows<Record<string, any>>("SELECT * FROM template_assets WHERE id=?", [id], c))[0];
  });
}
export async function completeSessionRecord(
  sid: string,
  tokenHash: string,
  assets: Record<string, unknown>[],
  manifest: string,
  receipt: unknown,
  coverID?: string,
  payloadID?: string,
) {
  return transaction(async (c) => {
    const s = await lockedSession(sid, tokenHash, c);
    if (s.state !== "open") {
      if (
        s.cover_asset_id !== (coverID ?? null) ||
        s.payload_asset_id !== (payloadID ?? null) ||
        s.manifest_hash !== manifest
      )
        throw new TemplateError("IDEMPOTENCY_CONFLICT", 409);
      return s.completion_json;
    }
    const actual = await rows<{ id: string }>("SELECT id FROM template_assets WHERE upload_session_id=?", [sid], c);
    if (actual.length !== assets.length || actual.some((a) => !assets.some((x) => x.id === a.id)))
      throw new TemplateError("RESOURCE_INVALID", 422);
    for (const a of assets)
      await write(
        "UPDATE template_assets SET sealed_key=?,sealed_sha256=?,mime=COALESCE(?,mime),bytes=COALESCE(?,bytes),width=?,height=?,state='sealed' WHERE id=? AND upload_session_id=?",
        [a.sealedKey, a.sealedSHA256, a.mime ?? null, a.bytes ?? null, a.width ?? null, a.height ?? null, a.id, sid],
        c,
      );
    await write(
      "UPDATE template_upload_sessions SET state='ready',manifest_hash=?,completion_json=?,cover_asset_id=?,payload_asset_id=? WHERE id=?",
      [manifest, JSON.stringify(receipt), coverID ?? null, payloadID ?? null, sid],
      c,
    );
    return receipt;
  });
}
