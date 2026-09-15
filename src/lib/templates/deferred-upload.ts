import "server-only";
import { z } from "zod";

import { checkReadable, readRow } from "./access-service";
import { getAsset, session, type Asset } from "./asset-service";
import { uuid, visibility, MAX_SESSION_BYTES, MAX_IMAGE_BYTES, MAX_PAYLOAD_BYTES } from "./contracts";
import { actorHash, canonical, equalSecret, sha256 } from "./crypto";
import { rows, transaction, write } from "./database";
import { TemplateError } from "./errors";
import { rateLimit } from "./repository";
import { cosObjectReference, signedDeferredUpload } from "./storage";

const resourceSchema = z
  .object({
    assetID: uuid,
    kind: z.enum(["cover", "logo", "payload"]),
    contentType: z.enum(["image/png", "image/jpeg", "image/webp", "application/json"]),
    byteLength: z.number().int().positive().max(MAX_IMAGE_BYTES),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    width: z.number().int().positive().max(25000).optional(),
    height: z.number().int().positive().max(25000).optional(),
  })
  .strict()
  .refine((a) =>
    a.kind === "payload"
      ? a.contentType === "application/json" && a.byteLength <= MAX_PAYLOAD_BYTES
      : a.contentType !== "application/json" && !!a.width && !!a.height,
  );
export const deferredPlanSchema = z
  .object({
    clientRequestID: uuid,
    userID: uuid,
    visibility,
    uploadToken: z.string().regex(/^[a-f0-9]{64}$/),
    assets: z.array(resourceSchema).min(2).max(34),
  })
  .strict()
  .refine(
    (p) =>
      new Set(p.assets.map((a) => a.assetID)).size === p.assets.length &&
      p.assets.filter((a) => a.kind === "cover").length === 1 &&
      p.assets.filter((a) => a.kind === "payload").length === 1 &&
      p.assets.reduce((n, a) => n + a.byteLength, 0) <= MAX_SESSION_BYTES,
  );

// These are address reservations, not a declaration that bytes were uploaded or validated.
// Existing state names are retained for database/read compatibility; uploadMode distinguishes the protocol.
export async function createDeferredPlan(input: z.infer<typeof deferredPlanSchema>) {
  const sid = input.clientRequestID,
    actor = actorHash(input.userID),
    tokenHash = sha256(input.uploadToken);
  const manifest = sha256(canonical(input.assets));
  const cover = input.assets.find((a) => a.kind === "cover")!,
    payload = input.assets.find((a) => a.kind === "payload")!;
  await transaction(async (c) => {
    // An idempotent insert locks the same session even when the initial response was lost.
    await write(
      `INSERT INTO template_upload_sessions(id,actor_hash,client_request_id,visibility,purpose,token_hash)
      VALUES (?,?,?,?,'template',?) ON DUPLICATE KEY UPDATE id=id`,
      [sid, actor, sid, input.visibility, tokenHash],
      c,
    );
    const [s] = await rows<{
      actor_hash: string;
      token_hash: string;
      visibility: string;
      state: string;
      manifest_hash: string | null;
    }>(
      "SELECT actor_hash,token_hash,visibility,state,manifest_hash FROM template_upload_sessions WHERE id=? FOR UPDATE",
      [sid],
      c,
    );
    if (s.actor_hash !== actor || !equalSecret(s.token_hash, tokenHash) || s.visibility !== input.visibility)
      throw new TemplateError("UPLOAD_TOKEN_INVALID", 403);
    if (s.manifest_hash) {
      if (s.manifest_hash !== manifest) throw new TemplateError("IDEMPOTENCY_CONFLICT", 409);
      if (s.state !== "committed")
        await write(
          "UPDATE template_upload_sessions SET expires_at=UTC_TIMESTAMP(3)+INTERVAL 1 HOUR WHERE id=?",
          [sid],
          c,
        );
      return;
    }
    if (s.state !== "open") throw new TemplateError("RESOURCE_INVALID", 422);
    await rateLimit(actor, "session", 20, 3600, c);
    for (const a of input.assets) {
      const key = `sealed/${sid}/${a.assetID}`;
      await write(
        `INSERT INTO template_assets (id,upload_session_id,client_asset_id,kind,object_key,sealed_key,mime,bytes,sha256,sealed_sha256,width,height,state)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'sealed')`,
        [
          a.assetID,
          sid,
          a.assetID,
          a.kind,
          key,
          key,
          a.contentType,
          a.byteLength,
          a.sha256,
          a.sha256,
          a.width ?? null,
          a.height ?? null,
        ],
        c,
      );
    }
    await write(
      "UPDATE template_upload_sessions SET state='ready',manifest_hash=?,completion_json=?,cover_asset_id=?,payload_asset_id=? WHERE id=?",
      [
        manifest,
        JSON.stringify({
          uploadMode: "deferred",
          coverWidth: cover.width,
          coverHeight: cover.height,
          payloadSHA256: payload.sha256,
        }),
        cover.assetID,
        payload.assetID,
        sid,
      ],
      c,
    );
  });
  // No COS download, image decoding, hash verification, or copy occurs here.
  const assets = await rows<Asset>("SELECT * FROM template_asset_records WHERE upload_session_id=?", [sid]);
  const templateID = assets.find((a) => a.template_id)?.template_id;
  if (templateID) {
    const template = await readRow(templateID);
    checkReadable(template, template.share_code);
  }
  return {
    uploadSessionID: sid,
    assets: await Promise.all(
      assets.map(async (a) => ({
        assetID: a.id,
        objectURL: cosObjectReference(a.object_key),
        ...(await signedDeferredUpload(a.object_key, a.mime)),
      })),
    ),
  };
}

export async function refreshDeferredTicket(sid: string, token: string, assetID: string) {
  const s = await session(sid, token, "template", true),
    a = await getAsset(assetID);
  if (s.completion_json?.uploadMode !== "deferred" || a.upload_session_id !== sid || a.request_id)
    throw new TemplateError("UPLOAD_TOKEN_INVALID", 403);
  if (s.state === "committed") {
    if (!a.template_id) throw new TemplateError("RESOURCE_INVALID", 422);
    const template = await readRow(a.template_id);
    checkReadable(template, template.share_code);
  }
  return {
    assetID: a.id,
    objectURL: cosObjectReference(a.object_key),
    ...(await signedDeferredUpload(a.object_key, a.mime)),
  };
}
