import "server-only";

import {
  byCode,
  readTemplate,
  ensureSnapshot,
  detail,
  payloadResponse,
  assetResponse,
  normalizeCode,
} from "./access-service";
import { newSession, session, registerAsset, completeSession, getAsset } from "./asset-service";
import { configured, enabled } from "./config";
import {
  createSchema,
  sessionSchema,
  requestSessionSchema,
  registerAssetSchema,
  completeSchema,
  evidenceCompleteSchema,
  searchSchema,
  listSchema,
  useSchema,
  reportSchema,
  requestSchema,
  identifier,
  uuid,
  PRIVATE_EXPIRY_SECONDS,
} from "./contracts";
import { actorHash, sha256 } from "./crypto";
import { TemplateError } from "./errors";
import { body, boundedBytes, endpoint, json } from "./http";
import { publish } from "./publish-service";
import { rateLimit } from "./repository";
import { search, discovery, queryCode } from "./search-service";
import { uploadObject, downloadObject } from "./storage";
import { recordUse, submitReport, submitRequest } from "./transactions";

function flag(name: string) {
  if (!enabled(name))
    throw new TemplateError("SERVICE_UNAVAILABLE", 503, "This feature is temporarily unavailable.", true);
}
export async function requestLimit(req: Request, action: string, limit = 120) {
  // Only trust a header that the deployment proxy strips and replaces.
  const header = process.env.TEMPLATE_TRUSTED_IP_HEADER;
  if (header)
    await rateLimit(actorHash(`ip:${req.headers.get(header)?.slice(0, 128) ?? "unknown"}`), action, limit, 60);
  else await rateLimit(actorHash("unattributed"), action, limit * 5, 60);
}
export async function v2Route(req: Request, path: string[]) {
  return endpoint(req, async () => {
    if (req.method === "OPTIONS") return new Response(null, { status: 204 });
    if (req.method === "GET" && path.join("/") === "capabilities") {
      const ready = configured(),
        upload2 = req.headers.get("X-Template-Upload-Protocol") === "2";
      return json({
        contractVersion: 2,
        visibility: ready
          ? [...(enabled("PUBLIC") ? ["public"] : []), ...(upload2 && enabled("PRIVATE") ? ["private"] : [])]
          : [],
        privateExpirySeconds: PRIVATE_EXPIRY_SECONDS,
        idempotentCreate: true,
        uploadProtocolVersion: 2,
        searchEnabled: ready && enabled("SEARCH"),
        reportEnabled: ready && enabled("REPORT"),
      });
    }
    await requestLimit(req, "api");
    if (req.method === "POST" && path.join("/") === "templates") {
      const result = await publish(req, await body(req, createSchema));
      return json(result.receipt, result.replay ? 200 : 201);
    }
    if (req.method === "POST" && path.join("/") === "search") return json(await search(await body(req, searchSchema)));
    if (req.method === "GET" && path.join("/") === "discovery") {
      const q = new URL(req.url).searchParams;
      const input = listSchema.safeParse({
        locale: q.get("locale") ?? "en",
        limit: Number(q.get("limit") ?? 20),
        cursor: q.get("cursor"),
        excludedTemplateIDs: q.getAll("excludedTemplateIDs").flatMap((v) => v.split(",")),
      });
      if (!input.success) throw new TemplateError("INVALID_REQUEST");
      return json(await discovery(input.data));
    }
    if (req.method === "GET" && path[0] === "by-code" && path.length === 2)
      return json(detail(await ensureSnapshot(await byCode(path[1]))));
    if (req.method === "GET" && path[0] === "assets" && path.length === 2) {
      if (!uuid.safeParse(path[1]).success) throw new TemplateError("INVALID_REQUEST");
      const q = new URL(req.url).searchParams;
      return assetResponse(path[1], q.get("code"), q.get("variant") === "thumb");
    }
    if (path[0] === "templates" && path.length >= 2 && path.length <= 3) {
      if (!identifier.safeParse(path[1]).success) throw new TemplateError("INVALID_REQUEST");
      if (req.method === "GET" && path.length === 2)
        return json(detail(await ensureSnapshot(await readTemplate(path[1]))));
      if (req.method === "GET" && path[2] === "payload")
        return payloadResponse(await readTemplate(path[1], new URL(req.url).searchParams.get("code")));
      if (req.method === "POST" && path[2] === "uses") {
        const input = await body(req, useSchema);
        await rateLimit(actorHash(input.userID), "uses", 60, 60);
        return json(await recordUse(path[1], input.shareCode, actorHash(input.userID)));
      }
      if (req.method === "POST" && path[2] === "reports") {
        flag("REPORT");
        const input = await body(req, reportSchema);
        await rateLimit(actorHash(input.userID), "report", 20, 3600);
        const result = await submitReport(path[1], input);
        return json(result.receipt, result.replay ? 200 : 201);
      }
    }
    if (req.method === "PUT" && path.length === 4 && path[0] === "request-upload-sessions" && path[2] === "assets") {
      flag("REPORT");
      const s = await session(path[1], req.headers.get("X-Template-Upload-Token") ?? "", "evidence");
      if (s.state !== "open" || !uuid.safeParse(path[3]).success) throw new TemplateError("RESOURCE_INVALID", 422);
      const asset = await getAsset(path[3]);
      if (
        asset.upload_session_id !== s.id ||
        asset.kind !== "evidence" ||
        asset.state !== "staging" ||
        req.headers.get("content-type") !== asset.mime
      )
        throw new TemplateError("RESOURCE_INVALID", 422);
      const bytes = await boundedBytes(req.body, Math.min(Number(asset.bytes), 5 * 1024 * 1024));
      if (bytes.length !== Number(asset.bytes) || sha256(bytes) !== asset.sha256)
        throw new TemplateError("RESOURCE_INVALID", 422);
      // A retry may follow a lost upload response. Accept only identical existing bytes.
      try {
        await uploadObject(asset.object_key, bytes, asset.mime);
      } catch (error) {
        const existing = await downloadObject(asset.object_key, Number(asset.bytes)).catch(() => null);
        if (!existing || sha256(existing) !== asset.sha256) throw error;
      }
      return json({ uploaded: true, assetID: asset.id });
    }
    if (req.method === "POST" && ["upload-sessions", "request-upload-sessions"].includes(path[0])) {
      const evidence = path[0] === "request-upload-sessions";
      if (path.length === 1) {
        if (evidence) {
          flag("REPORT");
          const input = await body(req, requestSessionSchema);
          return json(await newSession(input.clientRequestID, input.clientRequestID, null, input.kind), 201);
        }
        const input = await body(req, sessionSchema);
        flag(input.visibility === "public" ? "PUBLIC" : "PRIVATE");
        return json(await newSession(input.clientRequestID, input.userID, input.visibility), 201);
      }
      if (path.length === 3) {
        const token = req.headers.get("X-Template-Upload-Token") ?? "";
        const s = await session(path[1], token, evidence ? "evidence" : "template");
        if (path[2] === "assets") return json(await registerAsset(s, token, await body(req, registerAssetSchema)));
        if (path[2] === "complete") {
          if (evidence) {
            const input = await body(req, evidenceCompleteSchema);
            return json(await completeSession(s, token, undefined, undefined, input.attachmentIDs));
          }
          const input = await body(req, completeSchema);
          return json(await completeSession(s, token, input.coverAssetID, input.payloadAssetID));
        }
      }
    }
    if (req.method === "POST" && path.join("/") === "requests") {
      flag("REPORT");
      const input = await body(req, requestSchema);
      if (input.shareLink) {
        const code = queryCode(input.shareLink, "code")!;
        if (input.shareCode && normalizeCode(input.shareCode) !== code) throw new TemplateError("INVALID_REQUEST");
        input.shareCode = code;
      } else if (input.shareCode) input.shareCode = normalizeCode(input.shareCode);
      await requestLimit(req, "requests", 10);
      const result = await submitRequest(
        input,
        req.headers.get("X-Template-Upload-Session") ?? undefined,
        req.headers.get("X-Template-Upload-Token") ?? undefined,
      );
      return json(result.receipt, result.replay ? 200 : 201);
    }
    throw new TemplateError("TEMPLATE_NOT_FOUND", 404, "This endpoint does not exist.");
  });
}
