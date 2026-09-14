import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test, after, before } from "node:test";

import sharp from "sharp";

import { databaseURL } from "../../scripts/lib/database-config.mjs";
import { readTemplate, byCode, detail, payloadResponse, assetResponse } from "../../src/lib/templates/access-service";
import { newSession, session, registerAsset, completeSession } from "../../src/lib/templates/asset-service";
import { createSchema, requestSchema } from "../../src/lib/templates/contracts";
import { actorHash, sha256 } from "../../src/lib/templates/crypto";
import { database, rows, write, transaction } from "../../src/lib/templates/database";
import { publish } from "../../src/lib/templates/publish-service";
import { v2Route } from "../../src/lib/templates/routes";
import { publicPage, search, candidates, trendingTerms } from "../../src/lib/templates/search-service";
import {
  recordUse,
  moderateInTransaction,
  submitReport,
  submitRequest,
  resolveReport,
  resolveRequest,
  editTemplateMetadata,
  deleteTemplate,
  attachLegacy,
} from "../../src/lib/templates/transactions";

import examples from "./fixtures/contract-examples.json";

const active = process.env.TEMPLATE_MYSQL_TEST === "true";
if (active && (!new URL(databaseURL()).pathname.endsWith("_test") || new URL(databaseURL()).hostname !== "127.0.0.1"))
  throw new Error("Tests require an explicit disposable local *_test database.");
process.env.TEMPLATE_ACTOR_HMAC_KEY = "local-test-hmac-secret-not-for-production";
process.env.TEMPLATE_CURSOR_SIGNING_KEY = "local-test-cursor-secret-not-for-production";
process.env.TEMPLATE_PUBLIC_ENABLED = "true";
process.env.TEMPLATE_PRIVATE_ENABLED = "true";
process.env.TEMPLATE_SEARCH_ENABLED = "true";
process.env.TEMPLATE_REPORT_ENABLED = "true";
process.env.TEMPLATE_COS_BUCKET = "fixture-1234567890";
process.env.TEMPLATE_COS_REGION = "ap-singapore";
process.env.TEMPLATE_COS_SECRET_ID = "test-secret-id";
process.env.TEMPLATE_COS_SECRET_KEY = "test-secret-key";
// Storage HTTP contract double; MySQL transactions below use a real MySQL server.
const objects = new Map<string, Buffer>();
const originalFetch = globalThis.fetch;
if (active)
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.hostname !== "fixture-1234567890.cos.ap-singapore.myqcloud.com")
      throw new Error("Unexpected external network access in tests");
    const method = init?.method ?? "GET";
    const key = decodeURIComponent(url.pathname);
    if (method === "PUT") {
      const headers = new Headers(init?.headers);
      if (headers.get("x-cos-forbid-overwrite") === "true" && objects.has(key))
        return new Response("Conflict", { status: 409 });
      const b = init?.body;
      const bytes = b instanceof Blob ? Buffer.from(await b.arrayBuffer()) : Buffer.from(b as Uint8Array);
      objects.set(key, bytes);
      return Response.json({ Key: key });
    }
    const bytes = objects.get(key);
    return bytes ? new Response(new Uint8Array(bytes)) : Response.json({ message: "Missing" }, { status: 404 });
  };
before(async () => {
  if (!active) return;
  // Only the disposable database guarded above is reset.
  for (const table of [
    "template_assets",
    "template_reports",
    "template_requests",
    "template_publish_requests",
    "template_uses",
    "template_upload_sessions",
    "template_search_snapshots",
    "template_moderation_actions",
    "template_rate_limits",
    "watermarks_share_links",
  ])
    await write(`DELETE FROM ${table}`);
});
let uuidIDs = false;
before(async () => {
  if (!active) return;
  const [column] = await rows<{ DATA_TYPE: string }>(
    "SELECT DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='watermarks_share_links' AND COLUMN_NAME='id'",
  );
  uuidIDs = column.DATA_TYPE === "char";
  if (!uuidIDs) await write("ALTER TABLE watermarks_share_links AUTO_INCREMENT=9007199254740993");
});
after(async () => {
  if (active) await database().$disconnect();
  globalThis.fetch = originalFetch;
});
async function draft(visibility: "public" | "private", name = "Daily inspection") {
  const userID = randomUUID(),
    clientRequestID = randomUUID(),
    credentials = await newSession(clientRequestID, userID, visibility),
    s = await session(credentials.uploadSessionID, credentials.uploadToken);
  const cover = await sharp({ create: { width: 20, height: 30, channels: 3, background: "#2463db" } })
    .png()
    .toBuffer();
  const put = async (kind: "cover" | "payload" | "logo", bytes: Buffer) => {
    const receipt = await registerAsset(s, credentials.uploadToken, {
      clientAssetID: randomUUID(),
      kind,
      contentType: kind === "payload" ? "application/json" : "image/png",
      byteLength: bytes.length,
      sha256: sha256(bytes),
    });
    await fetch(receipt.uploadURL, { method: "PUT", headers: receipt.uploadHeaders, body: new Uint8Array(bytes) });
    return receipt;
  };
  const logo = await put("logo", cover),
    c = await put("cover", cover);
  const native = structuredClone(examples.examples.nativePayloadResponse) as Record<string, any>;
  native.coverUrl = c.assetReferenceURL;
  native.itemHistories = { "8": { content: [{ text: "private edit", isFavorite: false }] } };
  native.watermarkModel.items.push({
    id: 1,
    logoInfo: { logoUrl: logo.assetReferenceURL },
    logoListInfo: { logoList: [{ logoUrl: logo.assetReferenceURL }] },
  });
  const p = await put("payload", Buffer.from(JSON.stringify(native)));
  await completeSession(s, credentials.uploadToken, c.assetID, p.assetID);
  const input = createSchema.parse({
    ...examples.examples.createPublicRequest,
    userID,
    clientRequestID,
    visibility,
    watermarkName: visibility === "public" ? name : "",
    coverKind: "watermark",
    coverImageURL: c.assetReferenceURL,
    jsonDownloadURL: p.assetReferenceURL,
    ...(visibility === "private" ? { expiresInSeconds: 2592000 } : {}),
  });
  const req = new Request("https://team.timeprint.net/api/applink/v2/templates", {
    method: "POST",
    headers: {
      "Idempotency-Key": clientRequestID,
      "X-Template-Upload-Session": s.id,
      "X-Template-Upload-Token": credentials.uploadToken,
    },
  });
  return { input, req, s, credentials, c, p, cover, logo };
}
test(
  "real MySQL: admin edits preserve assets, removal restores, deletion revokes access",
  { skip: !active },
  async () => {
    const d = await draft("public", "Admin operation fixture");
    const { receipt } = await publish(d.req, d.input);
    const id = receipt.templateID;
    const before = await byCode(receipt.shareCode);
    const edit = {
      watermarkName: "Edited fixture",
      companyName: "Test company",
      reason: "Integration test",
      expectedUpdatedAt: before.updated_at,
    };
    const edited = await editTemplateMetadata(id, "test-admin", edit);
    const current = await byCode(receipt.shareCode);
    assert.equal(current.watermark_name, edit.watermarkName);
    assert.equal(current.company_name, edit.companyName);
    for (const key of ["share_code", "cover_image_url", "json_download_url", "expires_at", "expire_time"] as const)
      assert.equal(current[key], before[key]);
    await assert.rejects(editTemplateMetadata(id, "test-admin", edit), { code: "VERSION_CONFLICT" });
    await assert.rejects(deleteTemplate(id, "test-admin", { reason: "stale", expectedUpdatedAt: before.updated_at }), {
      code: "VERSION_CONFLICT",
    });
    const removed = await transaction((c) =>
      moderateInTransaction(c, id, "test-admin", "remove", "test", edited.updatedAt),
    );
    await assert.rejects(byCode(receipt.shareCode), { code: "TEMPLATE_REMOVED" });
    const restored = await transaction((c) =>
      moderateInTransaction(c, id, "test-admin", "restore", "test", removed.updatedAt),
    );
    assert.equal((await byCode(receipt.shareCode)).status, 0);
    await deleteTemplate(id, "test-admin", { reason: "test", expectedUpdatedAt: restored.updatedAt });
    await assert.rejects(byCode(receipt.shareCode), { code: "TEMPLATE_REMOVED" });
    await assert.rejects(
      transaction((c) => moderateInTransaction(c, id, "test-admin", "restore", "test")),
      { code: "TEMPLATE_REMOVED" },
    );
    assert.equal((await rows("SELECT id FROM watermarks_share_links WHERE id=? AND status<>-2", [id])).length, 0);
    assert.ok((await rows("SELECT id FROM template_assets WHERE template_id=?", [id])).length > 0);
    const audit = await rows<{ action: string }>("SELECT action FROM template_moderation_actions WHERE template_id=?", [
      id,
    ]);
    assert.deepEqual(audit.map((a) => a.action).sort(), ["delete", "edit_metadata", "remove", "restore"]);
  },
);

test(
  "real MySQL: full sealed upload, 20-way idempotency, private access and no renewal",
  { skip: !active },
  async () => {
    const d = await draft("private");
    const results = await Promise.all(Array.from({ length: 20 }, () => publish(d.req, d.input)));
    assert.equal(results.filter((r) => !r.replay).length, 1);
    const receipt = results[0].receipt;
    assert.equal(typeof receipt.templateID, "string");
    if (uuidIDs) assert.match(receipt.templateID, /^[0-9a-f-]{36}$/);
    else assert.ok(BigInt(receipt.templateID) > BigInt("9007199254740991"));
    assert.equal(new Set(results.map((r) => r.receipt.templateID)).size, 1);
    assert.equal(Date.parse(String(receipt.expiresAt)) - Date.parse(String(receipt.createdAt)), 2592000000);
    await assert.rejects(readTemplate(receipt.templateID), { code: "TEMPLATE_NOT_FOUND" });
    const t = await byCode(receipt.shareCode);
    const dto = detail(t);
    assert.equal(dto.companyName, "");
    assert.equal(dto.watermarkName, "");
    assert.equal(dto.useCount, null);
    assert.ok(dto.cover.url.includes("code="));
    await assert.rejects(assetResponse(d.c.assetID, null), { code: "TEMPLATE_NOT_FOUND" });
    const response = await payloadResponse(t),
      bytes = await response.text();
    assert.equal(response.headers.get("X-Payload-SHA256"), sha256(bytes));
    const payload = JSON.parse(bytes);
    assert.deepEqual(payload.itemHistories, { "8": { content: [{ text: "private edit", isFavorite: false }] } });
    assert.ok(payload.watermarkModel.items.at(-1).logoInfo.logoUrl.includes(receipt.shareCode));
    await fetch(d.c.uploadURL, { method: "PUT", body: new Uint8Array(Buffer.from("mutated staging")) });
    assert.deepEqual(Buffer.from(await (await assetResponse(d.c.assetID, receipt.shareCode)).arrayBuffer()), d.cover);
    await assert.rejects(publish(d.req, { ...d.input, companyName: "different" }), { code: "IDEMPOTENCY_CONFLICT" });
    const bad = new Request(d.req, {
      headers: {
        "Idempotency-Key": d.input.clientRequestID,
        "X-Template-Upload-Session": d.s.id,
        "X-Template-Upload-Token": "wrong",
      },
    });
    await assert.rejects(publish(bad, d.input), { code: "UPLOAD_TOKEN_INVALID" });
    const result = await search({
      query: receipt.shareCode,
      mode: "code",
      locale: "en",
      limit: 20,
      excludedTemplateIDs: [],
    });
    assert.equal(result.autoOpenTemplateID, receipt.templateID);
    const ids = await candidates("", true, []);
    assert.ok(!ids.includes(receipt.templateID));
  },
);
test(
  "real MySQL: public payload history stripping, use dedupe, moderation and report transactions",
  { skip: !active },
  async () => {
    const d = await draft("public", '施工_%(),"Company'),
      r = await publish(d.req, d.input),
      id = r.receipt.templateID;
    const t = await readTemplate(id);
    const p = await (await payloadResponse(t)).json();
    assert.equal(p.itemHistories, undefined);
    assert.equal(p.watermarkModel.base_id, "12");
    assert.equal(t.cover_width, 20);
    assert.equal(t.cover_height, 30);
    assert.deepEqual(await candidates('_%(),"', false, []), [id]);
    assert.ok(!(await candidates("not-present", false, [])).includes(id));
    const actor = actorHash(randomUUID());
    const uses = await Promise.all(Array.from({ length: 20 }, () => recordUse(id, undefined, actor)));
    assert.equal(uses.filter((u) => u.counted).length, 1);
    assert.equal((await readTemplate(id)).use_count, "1");
    const input = { ...examples.examples.reportRequest, userID: randomUUID(), clientRequestID: randomUUID() };
    const reports = await Promise.all(Array.from({ length: 5 }, () => submitReport(id, input)));
    assert.equal(new Set(reports.map((r) => r.receipt.reportID)).size, 1);
    assert.equal((await readTemplate(id)).status, 0);
    const admin = randomUUID();
    await resolveReport(reports[0].receipt.reportID, admin, "remove", "Reviewed test evidence");
    await assert.rejects(byCode(r.receipt.shareCode), { code: "TEMPLATE_REMOVED" });
    await assert.rejects(assetResponse(d.logo.assetID, null), { code: "TEMPLATE_REMOVED" });
    assert.ok(!(await candidates("", true, [])).includes(id));
    const [removed] = await rows<any>("SELECT * FROM template_records WHERE id=?", [id]);
    await assert.rejects(
      transaction((c) => moderateInTransaction(c, id, admin, "restore", "Restore", t.updated_at)),
      { code: "VERSION_CONFLICT" },
    );
    await transaction((c) =>
      moderateInTransaction(c, id, admin, "restore", "Restore reviewed template", removed.updated_at),
    );
    assert.equal((await readTemplate(id)).expires_at, null);
  },
);
test(
  "real MySQL: snapshots bind inputs and scan past removed candidates without repeats",
  { skip: !active },
  async () => {
    const a = await draft("public", "Pagination sample"),
      b = await draft("public", "Pagination sample"),
      c = await draft("public", "Pagination sample");
    const published = await Promise.all([a, b, c].map((d) => publish(d.req, d.input)));
    const input = { locale: "en", limit: 1, excludedTemplateIDs: [] };
    const first = await publicPage(input, "Pagination sample", "keyword");
    assert.ok(first.nextCursor);
    const target = published.find((r) => r.receipt.templateID !== first.items[0].templateID)!;
    const current = await readTemplate(target.receipt.templateID);
    await transaction((c) =>
      moderateInTransaction(c, current.id, randomUUID(), "remove", "Test removal", current.updated_at),
    );
    const second = await publicPage({ ...input, cursor: first.nextCursor }, "Pagination sample", "keyword");
    assert.equal(second.items.length, 1);
    assert.notEqual(second.items[0].templateID, first.items[0].templateID);
    assert.notEqual(second.items[0].templateID, current.id);
    const otherLocale = await publicPage(
      { ...input, cursor: first.nextCursor, locale: "zh" },
      "Pagination sample",
      "keyword",
    );
    assert.deepEqual(otherLocale.items, second.items);
  },
);
test(
  "real MySQL: request receipts, failed publication rollback, capability gating and route error contract",
  { skip: !active },
  async () => {
    const input = requestSchema.parse({ ...examples.examples.companyRequest, clientRequestID: randomUUID() });
    const results = await Promise.all(Array.from({ length: 10 }, () => submitRequest(input)));
    assert.equal(new Set(results.map((r) => r.receipt.requestID)).size, 1);
    assert.equal(results.filter((r) => !r.replay).length, 1);
    await assert.rejects(submitRequest({ ...input, description: "different" }), { code: "IDEMPOTENCY_CONFLICT" });
    await resolveRequest(results[0].receipt.requestID, randomUUID(), { status: "resolved", note: "Delivered" });
    const d = await draft("public");
    await write("UPDATE template_upload_sessions SET state='open' WHERE id=?", [d.s.id]);
    await assert.rejects(publish(d.req, d.input), { code: "RESOURCE_NOT_READY" });
    assert.equal(
      (
        await rows("SELECT template_id FROM template_publish_requests WHERE client_request_id=?", [
          d.input.clientRequestID,
        ])
      ).length,
      0,
    );
    const capabilities = await v2Route(new Request("https://team.timeprint.net/api/applink/v2/capabilities"), [
      "capabilities",
    ]);
    assert.deepEqual((await capabilities.json()).visibility, ["public"]);
    const v2 = await v2Route(
      new Request("https://team.timeprint.net/api/applink/v2/capabilities", {
        headers: { "X-Template-Upload-Protocol": "2" },
      }),
      ["capabilities"],
    );
    assert.deepEqual((await v2.json()).visibility, ["public", "private"]);
    const error = await v2Route(new Request("https://team.timeprint.net/api/applink/v2/by-code/BAD"), [
      "by-code",
      "BAD",
    ]);
    assert.equal(error.status, 400);
    const err = await error.json();
    assert.equal(err.error.code, "INVALID_CODE");
    assert.ok(err.error.requestID);
    assert.equal(error.headers.get("Cache-Control"), "no-store");
  },
);

test("real MySQL: exact expired private reads and restored links never renew", { skip: !active }, async () => {
  const d = await draft("private"),
    result = await publish(d.req, d.input),
    id = result.receipt.templateID;
  await write(
    "UPDATE watermarks_share_links SET created_at=UTC_TIMESTAMP(0)-INTERVAL 2592000 SECOND,expires_at=UTC_TIMESTAMP(0),expire_time=UNIX_TIMESTAMP(UTC_TIMESTAMP(0)) WHERE id=?",
    [id],
  );
  await assert.rejects(byCode(result.receipt.shareCode), { code: "TEMPLATE_EXPIRED" });
  await assert.rejects(assetResponse(d.c.assetID, result.receipt.shareCode), { code: "TEMPLATE_EXPIRED" });
  await assert.rejects(publish(d.req, d.input), { code: "TEMPLATE_EXPIRED" });
  await transaction((c) => moderateInTransaction(c, id, randomUUID(), "remove", "Expired link"));
  await transaction((c) => moderateInTransaction(c, id, randomUUID(), "restore", "Restore does not renew"));
  await assert.rejects(byCode(result.receipt.shareCode), { code: "TEMPLATE_EXPIRED" });
});

test("real MySQL: cross-session bindings and evidence ownership are enforced", { skip: !active }, async () => {
  const a = await draft("private"),
    b = await draft("private");
  await assert.rejects(publish(a.req, { ...a.input, jsonDownloadURL: b.p.assetReferenceURL }), {
    code: "RESOURCE_INVALID",
  });
  await assert.rejects(session(a.s.id, b.credentials.uploadToken), { code: "UPLOAD_TOKEN_INVALID" });
  const requestID = randomUUID(),
    s = await newSession(requestID, requestID, null, "removal"),
    state = await session(s.uploadSessionID, s.uploadToken, "evidence");
  const bytes = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#fff" } })
    .png()
    .toBuffer();
  const asset = await registerAsset(state, s.uploadToken, {
    clientAssetID: randomUUID(),
    kind: "evidence",
    contentType: "image/png",
    byteLength: bytes.length,
    sha256: sha256(bytes),
  });
  const uploadEvidence = (token: string, data = bytes) =>
    v2Route(
      new Request(
        `https://wm.timeprint.net/api/applink/v2/request-upload-sessions/${s.uploadSessionID}/assets/${asset.assetID}`,
        {
          method: "PUT",
          headers: { "Content-Type": "image/png", "X-Template-Upload-Token": token },
          body: new Uint8Array(data),
        },
      ),
      ["request-upload-sessions", s.uploadSessionID, "assets", asset.assetID],
    );
  assert.equal((await uploadEvidence("wrong-token")).status, 403);
  assert.equal((await uploadEvidence(s.uploadToken, Buffer.from("wrong bytes"))).status, 422);
  assert.equal((await uploadEvidence(s.uploadToken)).status, 200);
  assert.equal((await uploadEvidence(s.uploadToken)).status, 200);
  await completeSession(state, s.uploadToken, undefined, undefined, [asset.assetID]);
  const request = requestSchema.parse({
    clientRequestID: requestID,
    kind: "removal",
    description: "Fixture reference image",
    attachmentIDs: [asset.assetID],
  });
  await assert.rejects(submitRequest(request, s.uploadSessionID, "wrong"), { code: "UPLOAD_TOKEN_INVALID" });
  const first = await submitRequest(request, s.uploadSessionID, s.uploadToken);
  assert.equal(first.replay, false);
  assert.equal((await submitRequest(request, s.uploadSessionID, s.uploadToken)).replay, true);
  await assert.rejects(assetResponse(asset.assetID, null), { code: "TEMPLATE_NOT_FOUND" });
});

test("real MySQL: v1 wrapper and search never expose private/internal fields", { skip: !active }, async () => {
  const d = await draft("private"),
    r = await publish(d.req, d.input);
  const { GET: legacyGet } = await import("../../src/app/api/applink/[id]/route");
  const { POST: legacySearch } = await import("../../src/app/api/applink/search/route");
  const response = await legacyGet(new Request("https://team.timeprint.net/api/applink/" + r.receipt.shareCode), {
    params: Promise.resolve({ id: r.receipt.shareCode }),
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.shareLink.id, r.receipt.templateID);
  assert.equal(result.shareLink.company_name, "");
  assert.equal(result.shareLink.user_id, undefined);
  assert.equal(result.shareLink.actor_hash, undefined);
  assert.ok(result.shareLink.json_download_url.includes(r.receipt.shareCode));
  const searchResponse = await legacySearch(
    new Request("https://team.timeprint.net/api/applink/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 50, page: 1 }),
    }),
  );
  assert.equal(searchResponse.status, 200);
  assert.ok(!(await searchResponse.json()).results.some((t: { id: string }) => t.id === r.receipt.templateID));
});

test("Prisma: parameter binding, rollback, JSON/date/bigint and generated model reads", { skip: !active }, async () => {
  const injected = "' OR 1=1; DROP TABLE template_trending_terms; --";
  const [value] = await rows<{ text: string; large: string; time: string; data: { nested: number } }>(
    "SELECT ? AS text, CAST('9007199254740993' AS UNSIGNED) AS large, CAST('2026-09-14 12:34:56.123' AS DATETIME(3)) AS time, JSON_OBJECT('nested', 1) AS data",
    [injected],
  );
  assert.equal(value.text, injected);
  assert.equal(value.large, "9007199254740993");
  assert.equal(value.time, "2026-09-14T12:34:56.123Z");
  assert.deepEqual(value.data, { nested: 1 });
  const id = randomUUID();
  await assert.rejects(
    transaction(async (tx) => {
      await tx.template_trending_terms.create({ data: { id, term: "rollback", locale: "en" } });
      throw new Error("rollback probe");
    }),
    /rollback probe/,
  );
  assert.equal(await database().template_trending_terms.findUnique({ where: { id } }), null);
  await database().template_trending_terms.create({ data: { id, term: "Prisma verified", locale: "zz" } });
  try {
    const response = await v2Route(new Request("https://team.timeprint.net/api/applink/v2/discovery?locale=zz"), [
      "discovery",
    ]);
    assert.equal(response.status, 200);
    const discoveryResult = await response.json();
    assert.deepEqual(discoveryResult.trending, [{ term: "Prisma verified" }]);
    assert.equal(discoveryResult.links.removal, "https://wm.timeprint.net/templates/contact?kind=removal");
  } finally {
    await database().template_trending_terms.delete({ where: { id } });
  }
});

test(
  "legacy compatibility: 8-hex codes, expiry, original DTO and historical keyword search",
  { skip: !active },
  async () => {
    const { POST: legacySearch } = await import("../../src/app/api/applink/search/route");
    const { GET: legacyGet } = await import("../../src/app/api/applink/[id]/route");
    const title = `LegacyCompatibility-${randomUUID()}`;
    let historicalID = "";
    for (const expiry of [0, 2592000, 86400, 3600]) {
      const d = await draft("public", title);
      const r = await publish(d.req, { ...d.input, watermarkName: "L".repeat(255) }, 1, expiry);
      assert.match(r.receipt.shareCode, /^[A-F0-9]{8}$/);
      const result = await legacyGet(new Request(`https://wm.timeprint.net/api/applink/${r.receipt.shareCode}`), {
        params: Promise.resolve({ id: r.receipt.shareCode }),
      });
      assert.equal(result.status, 200);
      const dto = (await result.json()).shareLink;
      assert.equal(dto.watermark_name.length, 255);
      assert.equal(typeof dto.company_name, "string");
      assert.equal(dto.share_code, r.receipt.shareCode);
      assert.equal(Number(dto.expire_time), expiry ? Date.parse(dto.created_at) / 1000 + expiry : 0);
      const actor = actorHash(randomUUID());
      assert.equal((await recordUse(r.receipt.templateID, r.receipt.shareCode, actor)).counted, true);
      assert.equal((await recordUse(r.receipt.templateID, r.receipt.shareCode, actor)).counted, false);
      const [counted] = await rows<{ use_count: number }>("SELECT use_count FROM watermarks_share_links WHERE id=?", [
        r.receipt.templateID,
      ]);
      assert.equal(Number(counted.use_count), 1);
      if (expiry === 0) historicalID = r.receipt.templateID;
    }
    process.env.TEMPLATE_ALLOWED_LEGACY_ASSET_HOSTS = "wm-1330977225.cos.ap-singapore.myqcloud.com";
    await write(
      "UPDATE watermarks_share_links SET watermark_name=?,cover_asset_id=NULL,payload_asset_id=NULL,cover_image_url=?,json_download_url=? WHERE id=?",
      [
        title,
        "https://wm-1330977225.cos.ap-singapore.myqcloud.com/ugc_cover/fixture.png",
        "https://wm-1330977225.cos.ap-singapore.myqcloud.com/ugc_json/fixture.json",
        historicalID,
      ],
    );
    const searchLegacy = () =>
      legacySearch(
        new Request("https://wm.timeprint.net/api/applink/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keyword: title, page: 1, limit: 500 }),
        }),
      );
    const found = await searchLegacy();
    assert.equal(found.status, 200);
    const data = await found.json();
    assert.equal(data.perPage, 500);
    assert.deepEqual(
      data.results.map((r: { id: string }) => r.id),
      [historicalID],
    );
    await write("UPDATE watermarks_share_links SET status=-1 WHERE id=?", [historicalID]);
    assert.equal((await (await searchLegacy()).json()).results.length, 0);
    await write("UPDATE watermarks_share_links SET status=0,expire_time=1 WHERE id=?", [historicalID]);
    assert.equal((await (await searchLegacy()).json()).results.length, 0);
    const privateDraft = await draft("private", title);
    await publish(privateDraft.req, privateDraft.input);
    assert.equal((await (await searchLegacy()).json()).results.length, 0);
  },
);

test(
  "legacy public approval preserves identity and expiry and makes sealed resources searchable",
  { skip: !active },
  async () => {
    const name = `ApprovedLegacy-${randomUUID()}`;
    const oldDraft = await draft("public", name);
    const old = await publish(oldDraft.req, oldDraft.input, 1, 2592000);
    const id = old.receipt.templateID;
    const [before] = await rows<any>("SELECT * FROM template_records WHERE id=?", [id]);
    assert.equal((await candidates(name, false, [])).length, 0);
    const sealed = await draft("public", name);
    await attachLegacy(id, sealed.s.id, before.updated_at, {
      admin: "test-maintenance",
      reason: "Restore historical public discovery",
    });
    const [after] = await rows<any>("SELECT * FROM template_records WHERE id=?", [id]);
    for (const key of [
      "share_code",
      "created_at",
      "expire_time",
      "contract_version",
      "watermark_name",
      "company_name",
      "status",
    ])
      assert.equal(after[key], before[key]);
    assert.equal(after.visibility, "public");
    assert.equal(after.discovery_state, "eligible");
    const page = await publicPage({ locale: "en", limit: 20, excludedTemplateIDs: [] }, name, "keyword");
    assert.deepEqual(
      page.items.map((t) => t.templateID),
      [id],
    );
    const payload = await payloadResponse(await readTemplate(id));
    assert.equal(payload.status, 200);
    assert.equal("itemHistories" in (await payload.json()), false);
    await write("UPDATE watermarks_share_links SET status=-1 WHERE id=?", [id]);
    assert.deepEqual(await candidates(name, false, []), []);
  },
);

test("trending lookup selects enabled exact terms before aliases and English fallback", { skip: !active }, async () => {
  const ids: string[] = [];
  const add = async (locale: string, term: string, enabled = true) => {
    const id = randomUUID();
    ids.push(id);
    await database().template_trending_terms.create({ data: { id, locale, term, enabled } });
  };
  try {
    await add("en", "English");
    await add("en-AU", "Disabled Australian", false);
    await add("zh-Hans", "简体词");
    await add("fr", "Français");
    assert.deepEqual(await trendingTerms("en-AU"), [{ term: "English" }]);
    await add("en-AU", "Australian");
    assert.deepEqual(await trendingTerms("EN-au"), [{ term: "Australian" }]);
    assert.deepEqual(await trendingTerms("fr-CA"), [{ term: "Français" }]);
    assert.deepEqual(await trendingTerms("zh-CN"), [{ term: "简体词" }]);
    assert.deepEqual(await trendingTerms("zh-hans"), [{ term: "简体词" }]);
    assert.deepEqual(await trendingTerms("zh-HK"), [{ term: "English" }]);
    await add("zh-CN", "大陆专用词");
    assert.deepEqual(await trendingTerms("zh-CN"), [{ term: "大陆专用词" }]);
    assert.deepEqual(await trendingTerms("zh-SG"), [{ term: "简体词" }]);
    await add("zh-TW", "繁體詞");
    assert.deepEqual(await trendingTerms("zh-HK"), [{ term: "繁體詞" }]);
    assert.deepEqual(await trendingTerms("zh-Hant"), [{ term: "繁體詞" }]);
    const response = await v2Route(new Request("https://wm.timeprint.net/api/applink/v2/discovery?locale=en-AU"), [
      "discovery",
    ]);
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).trending, [{ term: "Australian" }]);
    await database().template_trending_terms.deleteMany({ where: { id: { in: ids } } });
    assert.deepEqual(await trendingTerms("zz-ZZ"), []);
  } finally {
    await database().template_trending_terms.deleteMany({ where: { id: { in: ids } } });
  }
});
