import "server-only";
import { randomBytes, randomUUID } from "node:crypto";

import { checkReadable } from "./access-policy";
import { apiBase, shareOrigin } from "./config";
import { type CreateInput, type TemplateRow } from "./contracts";
import { actorHash, canonical, sha256, shareCode } from "./crypto";
import { rows, write, transaction, parseJSON, isDuplicateKey, type Connection } from "./database";
import { TemplateError } from "./errors";
import { lockedSession, rateLimit } from "./repository";

export async function lockedTemplate(id: string, conn: Connection): Promise<TemplateRow> {
  const [t] = await rows<TemplateRow>(
    "SELECT *,CAST(id AS CHAR) AS id FROM watermarks_share_links WHERE id=? FOR UPDATE",
    [id],
    conn,
  );
  if (!t) throw new TemplateError("TEMPLATE_NOT_FOUND", 404);
  return t;
}
export async function publishTransaction(
  sid: string,
  token: string,
  input: CreateInput,
  contract: number,
  legacyExpiry: number,
) {
  return transaction(async (c) => {
    const s = await lockedSession(sid, sha256(token), c, true);
    if (!["ready", "committed"].includes(s.state))
      throw new TemplateError("RESOURCE_NOT_READY", 503, "Resources are not ready.", true);
    const actor = actorHash(input.userID);
    if (
      s.actor_hash !== actor ||
      s.client_request_id !== input.clientRequestID ||
      s.visibility !== input.visibility ||
      s.purpose !== "template"
    )
      throw new TemplateError("UPLOAD_TOKEN_INVALID", 403);
    const {
      coverImageURL: _cover,
      jsonDownloadURL: _payload,
      coverWidth: _width,
      coverHeight: _height,
      userID: _user,
      ...normalized
    } = input;
    const hash = sha256(canonical({ ...normalized, manifest: s.manifest_hash, contract, legacyExpiry }));
    // Atomic key claim serializes all sessions for the same installation/request.
    // A failed/crashed transaction rolls the claim back; no orphan pending lease.
    await write(
      "INSERT INTO template_publish_requests(actor_hash,client_request_id,request_hash,state) VALUES (?,?,?,'pending') ON DUPLICATE KEY UPDATE actor_hash=actor_hash",
      [actor, input.clientRequestID, hash],
      c,
    );
    const [previous] = await rows<Record<string, any>>(
      "SELECT *,CAST(template_id AS CHAR) AS template_id FROM template_publish_requests WHERE actor_hash=? AND client_request_id=? FOR UPDATE",
      [actor, input.clientRequestID],
      c,
    );
    if (previous.request_hash !== hash) throw new TemplateError("IDEMPOTENCY_CONFLICT", 409);
    if (previous.state === "succeeded") {
      if (s.visibility === "private") {
        const t = await lockedTemplate(previous.template_id, c);
        const [bound] = await rows(
          "SELECT id FROM template_assets WHERE upload_session_id=? AND template_id=? LIMIT 1",
          [sid, t.id],
          c,
        );
        if (s.state !== "committed" || !bound) throw new TemplateError("UPLOAD_TOKEN_INVALID", 403);
        checkReadable(t, t.share_code);
      }
      return { replay: true, receipt: parseJSON(previous.receipt_json) };
    }
    if (s.state !== "ready" || Date.parse(s.expires_at) <= Date.now())
      throw new TemplateError("UPLOAD_SESSION_EXPIRED", 410);
    await rateLimit(actor, "publish-hour", 5, 3600, c);
    await rateLimit(actor, "publish-day", 20, 86400, c);
    const [clock] = await rows<{ stamp: string }>("SELECT UTC_TIMESTAMP(0) AS stamp", [], c);
    const stamp = new Date(clock.stamp),
      duration = contract === 1 ? legacyExpiry : input.visibility === "private" ? 2_592_000 : 0;
    const expires = duration ? new Date(stamp.getTime() + duration * 1000) : null;
    const meta = s.completion_json;
    let code = "",
      id = "";
    for (let attempt = 0; attempt < 5; attempt++) {
      code = contract === 1 ? randomBytes(4).toString("hex").toUpperCase() : shareCode();
      try {
        await write(
          `INSERT INTO watermarks_share_links (watermark_name,company_name,cover_image_url,json_download_url,status,created_at,user_id,share_code,expire_time,contract_version,visibility,discovery_state,cover_kind,cover_width,cover_height,payload_sha256,expires_at,actor_hash,cover_asset_id,payload_asset_id)
          VALUES (?,?,?,?,0,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            input.visibility === "private" ? "" : input.watermarkName,
            input.visibility === "private" ? "" : input.companyName,
            `${apiBase()}/assets/${s.cover_asset_id}`,
            `${apiBase()}/assets/${s.payload_asset_id}`,
            stamp,
            "anonymous",
            code,
            expires ? Math.floor(expires.getTime() / 1000) : 0,
            contract,
            contract === 1 ? null : input.visibility,
            contract === 2 && input.visibility === "public" ? "eligible" : "held",
            input.coverKind,
            meta.coverWidth,
            meta.coverHeight,
            meta.payloadSHA256,
            expires,
            actor,
            s.cover_asset_id,
            s.payload_asset_id,
          ],
          c,
        );
        // Read back as text, never from the driver's numeric insertId.
        id = (
          await rows<{ id: string }>(
            "SELECT CAST(id AS CHAR) AS id FROM watermarks_share_links WHERE share_code=?",
            [code],
            c,
          )
        )[0].id;
        break;
      } catch (error) {
        if (!isDuplicateKey(error) || attempt === 4) throw error;
      }
    }
    await write("UPDATE template_assets SET template_id=? WHERE upload_session_id=?", [id, sid], c);
    await write("UPDATE template_upload_sessions SET state='committed' WHERE id=?", [sid], c);
    const receipt = {
      contractVersion: 2,
      templateID: id,
      clientRequestID: input.clientRequestID,
      visibility: input.visibility,
      shareCode: code,
      shareLink: `${shareOrigin()}/share?code=${code}`,
      createdAt: stamp.toISOString(),
      expiresAt: expires?.toISOString() ?? null,
    };
    await write(
      "UPDATE template_publish_requests SET state='succeeded',template_id=?,receipt_json=? WHERE actor_hash=? AND client_request_id=?",
      [id, JSON.stringify(receipt), actor, input.clientRequestID],
      c,
    );
    return { replay: false, receipt };
  });
}
export async function attachLegacy(
  id: string,
  sid: string,
  expected: string,
  approval?: { admin: string; reason: string },
) {
  return transaction(async (c) => {
    const t = await lockedTemplate(id, c);
    checkReadable(t, t.share_code);
    if (!approval && t.cover_asset_id) return;
    if (t.contract_version !== 1 || t.updated_at !== expected) throw new TemplateError("VERSION_CONFLICT", 409);
    const [s] = await rows<Record<string, any>>(
      "SELECT * FROM template_upload_sessions WHERE id=? FOR UPDATE",
      [sid],
      c,
    );
    if (!s || s.state !== "ready" || s.purpose !== "template" || (approval && s.visibility !== "public"))
      throw new TemplateError("RESOURCE_NOT_READY", 503);
    const meta = parseJSON<Record<string, any>>(s.completion_json);
    await write("UPDATE template_assets SET template_id=? WHERE upload_session_id=?", [id, sid], c);
    await write("UPDATE template_upload_sessions SET state='committed' WHERE id=?", [sid], c);
    await write(
      "UPDATE watermarks_share_links SET cover_asset_id=?,payload_asset_id=?,cover_width=?,cover_height=?,payload_sha256=? WHERE id=?",
      [s.cover_asset_id, s.payload_asset_id, meta.coverWidth, meta.coverHeight, meta.payloadSHA256, id],
      c,
    );
    if (approval) {
      await write(
        "UPDATE watermarks_share_links SET visibility='public',discovery_state='eligible',updated_at=UTC_TIMESTAMP(3) WHERE id=?",
        [id],
        c,
      );
      await audit(c, approval.admin, id, "approve-legacy-public", approval.reason);
    }
  });
}
export async function recordUse(id: string, code: string | undefined, actor: string) {
  return transaction(async (c) => {
    const t = await lockedTemplate(id, c);
    checkReadable(t, code);
    const [prior] = await rows(
      "SELECT actor_hash FROM template_uses WHERE template_id=? AND actor_hash=?",
      [id, actor],
      c,
    );
    if (!prior) {
      await write("INSERT INTO template_uses(template_id,actor_hash) VALUES (?,?)", [id, actor], c);
      await write("UPDATE watermarks_share_links SET use_count=use_count+1 WHERE id=?", [id], c);
    }
    return {
      accepted: true,
      counted: !prior,
      useCount: t.visibility === "public" ? Number(t.use_count) + (prior ? 0 : 1) : null,
    };
  });
}
export async function submitReport(id: string, input: Record<string, any>) {
  return transaction(async (c) => {
    const t = await lockedTemplate(id, c);
    checkReadable(t, input.shareCode);
    const actor = actorHash(input.userID),
      hash = sha256(canonical({ ...input, templateID: id }));
    const [previous] = await rows<{ id: string; request_hash: string }>(
      "SELECT id,request_hash FROM template_reports WHERE actor_hash=? AND client_request_id=? FOR UPDATE",
      [actor, input.clientRequestID],
      c,
    );
    if (previous) {
      if (previous.request_hash !== hash) throw new TemplateError("IDEMPOTENCY_CONFLICT", 409);
      return { replay: true, receipt: { reportID: previous.id, status: "received" } };
    }
    const reportID = randomUUID();
    await write(
      "INSERT INTO template_reports(id,template_id,actor_hash,client_request_id,request_hash,reason,source) VALUES (?,?,?,?,?,?,?)",
      [reportID, id, actor, input.clientRequestID, hash, input.reason, input.source],
      c,
    );
    return { replay: false, receipt: { reportID, status: "received" } };
  });
}
export async function submitRequest(input: Record<string, any>, sid?: string, token?: string) {
  return transaction(async (c) => {
    const hash = sha256(canonical(input));
    if (input.attachmentIDs.length) {
      const s = await lockedSession(sid ?? "", sha256(token ?? ""), c, true);
      if (
        s.client_request_id !== input.clientRequestID ||
        s.purpose !== input.kind ||
        !["ready", "committed"].includes(s.state)
      )
        throw new TemplateError("UPLOAD_TOKEN_INVALID", 403);
      const actual = await rows<{ id: string }>(
        "SELECT id FROM template_assets WHERE upload_session_id=? AND kind='evidence' AND state='sealed'",
        [sid],
        c,
      );
      if (canonical(actual.map((a) => a.id).sort()) !== canonical([...input.attachmentIDs].sort()))
        throw new TemplateError("RESOURCE_INVALID", 422);
    }
    await write(
      "INSERT INTO template_requests(id,client_request_id,request_hash,kind,description,contact,company_name,required_fields,attachment_ids,submitted_code) VALUES (?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE client_request_id=client_request_id",
      [
        randomUUID(),
        input.clientRequestID,
        hash,
        input.kind,
        input.description,
        input.contact,
        input.companyName,
        JSON.stringify(input.requiredFields),
        JSON.stringify(input.attachmentIDs),
        input.shareCode ?? null,
      ],
      c,
    );
    const [record] = await rows<Record<string, any>>(
      "SELECT * FROM template_requests WHERE client_request_id=? FOR UPDATE",
      [input.clientRequestID],
      c,
    );
    if (record.request_hash !== hash) throw new TemplateError("IDEMPOTENCY_CONFLICT", 409);
    const replay = !!record.accepted;
    if (input.templateID)
      await write(
        "UPDATE template_requests SET template_id=(SELECT id FROM watermarks_share_links WHERE id=? LIMIT 1) WHERE id=?",
        [input.templateID, record.id],
        c,
      );
    if (input.attachmentIDs.length) {
      await write("UPDATE template_assets SET request_id=? WHERE upload_session_id=?", [record.id, sid], c);
      await write("UPDATE template_upload_sessions SET state='committed' WHERE id=?", [sid], c);
    }
    await write("UPDATE template_requests SET accepted=1 WHERE id=?", [record.id], c);
    return { replay, receipt: { requestID: record.id, status: "received" } };
  });
}
async function audit(
  c: Connection,
  admin: string,
  id: string | null,
  action: string,
  reason: string,
  before?: unknown,
  after?: unknown,
  reportID?: string,
  requestID?: string,
) {
  await write(
    "INSERT INTO template_moderation_actions(id,admin_user_id,template_id,action,reason,before_state,after_state,report_id,request_id) VALUES (?,?,?,?,?,?,?,?,?)",
    [
      randomUUID(),
      admin,
      id,
      action,
      reason,
      JSON.stringify(before ?? null),
      JSON.stringify(after ?? null),
      reportID ?? null,
      requestID ?? null,
    ],
    c,
  );
}
export async function editTemplateMetadata(
  id: string,
  admin: string,
  input: {
    watermarkName: string;
    companyName: string;
    reason: string;
    expectedUpdatedAt: string;
  },
) {
  return transaction(async (c) => {
    const t = await lockedTemplate(id, c);
    if (t.status === -2) throw new TemplateError("TEMPLATE_REMOVED", 410, "该记录已删除");
    if (t.updated_at !== input.expectedUpdatedAt)
      throw new TemplateError("VERSION_CONFLICT", 409, "记录已更新，请刷新后重试");
    if (
      [...input.watermarkName].length > (t.contract_version === 1 ? 255 : 100) ||
      (t.contract_version === 2 && t.visibility === "public" && !input.watermarkName.trim())
    )
      throw new TemplateError("INVALID_REQUEST", 400, "请检查水印名称");
    const stamp = new Date(Math.max(Date.now(), Date.parse(t.updated_at) + 1));
    await write(
      "UPDATE watermarks_share_links SET watermark_name=?,company_name=?,updated_at=? WHERE id=?",
      [input.watermarkName, input.companyName, stamp, id],
      c,
    );
    await audit(
      c,
      admin,
      id,
      "edit_metadata",
      input.reason,
      { watermarkName: t.watermark_name, companyName: t.company_name },
      { watermarkName: input.watermarkName, companyName: input.companyName },
    );
    return { templateID: id, updatedAt: stamp.toISOString() };
  });
}
export async function deleteTemplate(id: string, admin: string, input: { reason: string; expectedUpdatedAt: string }) {
  return transaction(async (c) => {
    const t = await lockedTemplate(id, c);
    if (t.status === -2) return { templateID: id, deleted: true };
    if (t.updated_at !== input.expectedUpdatedAt)
      throw new TemplateError("VERSION_CONFLICT", 409, "记录已更新，请刷新后重试");
    const stamp = new Date(Math.max(Date.now(), Date.parse(t.updated_at) + 1));
    await write(
      "UPDATE watermarks_share_links SET status=-2,removed_at=?,removed_reason=?,updated_at=? WHERE id=?",
      [stamp, input.reason, stamp, id],
      c,
    );
    await audit(c, admin, id, "delete", input.reason, { status: t.status }, { status: -2 });
    return { templateID: id, deleted: true };
  });
}
export async function moderateInTransaction(
  c: Connection,
  id: string,
  admin: string,
  action: "remove" | "restore",
  reason: string,
  expected?: string,
) {
  const t = await lockedTemplate(id, c);
  if (t.status === -2) throw new TemplateError("TEMPLATE_REMOVED", 410, "该记录已删除，不能重新上架");
  if (expected && t.updated_at !== expected) throw new TemplateError("VERSION_CONFLICT", 409);
  const stamp = new Date();
  await write(
    "UPDATE watermarks_share_links SET status=?,removed_at=?,removed_reason=?,updated_at=? WHERE id=?",
    [action === "remove" ? -1 : 0, action === "remove" ? stamp : null, action === "remove" ? reason : null, stamp, id],
    c,
  );
  await audit(
    c,
    admin,
    id,
    action,
    reason,
    { status: t.status, removedAt: t.removed_at },
    { status: action === "remove" ? -1 : 0 },
  );
  return { templateID: id, status: action === "remove" ? -1 : 0, updatedAt: stamp.toISOString() };
}
export async function resolveReport(id: string, admin: string, decision: "remove" | "keep", note: string) {
  return transaction(async (c) => {
    const [r] = await rows<Record<string, any>>(
      "SELECT *,CAST(template_id AS CHAR) AS template_id FROM template_reports WHERE id=? FOR UPDATE",
      [id],
      c,
    );
    if (!r) throw new TemplateError("TEMPLATE_NOT_FOUND", 404);
    if (r.status === "resolved") return { status: "resolved" };
    if (decision === "remove") await moderateInTransaction(c, r.template_id, admin, "remove", note);
    await write(
      "UPDATE template_reports SET status='resolved',resolved_at=UTC_TIMESTAMP(3),resolution=? WHERE id=?",
      [`${decision}: ${note}`, id],
      c,
    );
    await audit(c, admin, r.template_id, decision, note, undefined, undefined, id);
    return { status: "resolved" };
  });
}
export async function resolveRequest(
  id: string,
  admin: string,
  input: { status: string; note: string; decision?: string },
) {
  return transaction(async (c) => {
    const [r] = await rows<Record<string, any>>(
      "SELECT *,CAST(template_id AS CHAR) AS template_id FROM template_requests WHERE id=? FOR UPDATE",
      [id],
      c,
    );
    if (!r) throw new TemplateError("TEMPLATE_NOT_FOUND", 404);
    if (r.kind === "removal" && input.status === "resolved" && !input.decision)
      throw new TemplateError("INVALID_REQUEST", 400, "A removal decision is required.");
    if (input.decision === "remove") {
      const templateID =
        r.template_id ??
        (
          await rows<{ id: string }>(
            "SELECT CAST(id AS CHAR) AS id FROM watermarks_share_links WHERE UPPER(share_code)=UPPER(?)",
            [r.submitted_code],
            c,
          )
        )[0]?.id;
      if (!templateID) throw new TemplateError("TEMPLATE_NOT_FOUND", 404);
      await moderateInTransaction(c, templateID, admin, "remove", input.note);
    }
    await write(
      "UPDATE template_requests SET status=?,resolution=?,resolved_at=? WHERE id=?",
      [input.status, input.note, input.status === "in_review" ? null : new Date(), id],
      c,
    );
    await audit(
      c,
      admin,
      r.template_id,
      input.decision ?? input.status,
      input.note,
      undefined,
      undefined,
      undefined,
      id,
    );
    return { status: input.status };
  });
}
