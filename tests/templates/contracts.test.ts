import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";

import { normalizeCode, checkReadable } from "../../src/lib/templates/access-policy";
import { imageMetadata } from "../../src/lib/templates/asset-service";
import clientLocales from "../../src/lib/templates/client-locales.json";
import { createSchema, searchSchema, reportSchema, type TemplateRow } from "../../src/lib/templates/contracts";
import { canonical, shareCode } from "../../src/lib/templates/crypto";
import { boundedBytes, body } from "../../src/lib/templates/http";
import { publicIPv4, legacyURL } from "../../src/lib/templates/legacy-assets";
import { parsePayload, mapImages, payloadBytes } from "../../src/lib/templates/payload";
import { queryCode, cursorEncode, cursorDecode } from "../../src/lib/templates/search-service";
import { trendingLocaleCandidates } from "../../src/lib/templates/trending-locales";

import examples from "./fixtures/contract-examples.json";

process.env.TEMPLATE_CURSOR_SIGNING_KEY = "test-only-cursor-secret-32-characters";
const fixture = examples.examples;
test("trending locales preserve exact overrides, language parents and Chinese scripts", () => {
  assert.deepEqual(trendingLocaleCandidates("en-AU"), ["en-au", "en"]);
  assert.deepEqual(trendingLocaleCandidates("fr-CA"), ["fr-ca", "fr", "en"]);
  assert.deepEqual(trendingLocaleCandidates("pt-BR"), ["pt-br", "pt", "pt-pt", "en"]);
  assert.deepEqual(trendingLocaleCandidates("sr-Latn-RS"), ["sr-latn-rs", "sr-latn", "sr", "en"]);
  assert.deepEqual(trendingLocaleCandidates("zh-CN"), ["zh-cn", "zh-hans", "zh-sg", "zh-my", "zh", "en"]);
  assert.deepEqual(trendingLocaleCandidates("zh-HANS"), ["zh-hans", "zh-cn", "zh-sg", "zh-my", "zh", "en"]);
  assert.deepEqual(trendingLocaleCandidates("zh-HK"), ["zh-hk", "zh-hant", "zh-tw", "zh-mo", "en"]);
  assert.ok(!trendingLocaleCandidates("zh-Hant-CN").includes("zh-hans"));
  assert.ok(!trendingLocaleCandidates("zh-Hans-HK").includes("zh-hant"));
  assert.deepEqual(trendingLocaleCandidates("iw-IL"), ["iw-il", "he-il", "he", "iw", "en"]);
  assert.deepEqual(trendingLocaleCandidates("tl-PH"), ["tl-ph", "fil-ph", "fil", "tl", "en"]);
  assert.deepEqual(trendingLocaleCandidates("kk"), ["kk", "kk-kz", "en"]);
  assert.equal(clientLocales.languages.length, 112);
  assert.equal(new Set(clientLocales.languages.map((language) => language.code.toLowerCase())).size, 112);
  for (const language of clientLocales.languages)
    assert.equal(trendingLocaleCandidates(language.code)[0], language.code.toLowerCase());
});
test("iOS public/private contracts and forbidden management fields", () => {
  assert.ok(createSchema.safeParse(fixture.createPublicRequest).success);
  assert.ok(createSchema.safeParse(fixture.createPrivateRequest).success);
  for (const overrides of [
    { visibility: "team" },
    { status: 0 },
    { contractVersion: 3 },
    { watermarkName: "" },
    { expiresInSeconds: 2592000 },
  ])
    assert.equal(createSchema.safeParse({ ...fixture.createPublicRequest, ...overrides }).success, false);
  assert.equal(createSchema.safeParse({ ...fixture.createPrivateRequest, expiresInSeconds: 2592001 }).success, false);
  assert.equal(createSchema.safeParse({ ...fixture.createPrivateRequest, coverKind: "photo" }).success, false);
  assert.ok(createSchema.safeParse({ ...fixture.createPublicRequest, watermarkName: "😀".repeat(100) }).success);
  assert.ok(!createSchema.safeParse({ ...fixture.createPublicRequest, watermarkName: "😀".repeat(101) }).success);
});
test("codes, Chinese words, legacy hex, and allowed links are distinguished", () => {
  assert.equal(normalizeCode(" tq8 h3y 6v9n "), "TQ8H3Y6V9N");
  assert.equal(queryCode("Simple", "auto"), null);
  assert.equal(queryCode("中文水印名称", "auto"), null);
  assert.equal(queryCode("AB12CD", "auto"), "AB12CD");
  assert.equal(queryCode("deadbeef", "auto"), "DEADBEEF");
  assert.equal(queryCode("TP7K9W4R2M", "keyword"), null);
  assert.equal(queryCode("https://share.timeprint.net/share?code=TQ8H3Y6V9N", "auto"), "TQ8H3Y6V9N");
  assert.equal(queryCode("https://share.timeprint.net/zh-Hans/share?code=FE2FAE61", "auto"), "FE2FAE61");
  assert.equal(queryCode("https://share.timeprint.net/en/share/?code=FE2FAE61", "code"), "FE2FAE61");
  for (const url of [
    "https://evil.example/share?code=AB12CD",
    "https://share.timeprint.net@evil.example/share?code=AB12CD",
    "https://share.timeprint.net/share?code=AB12CD&code=ABC234",
    "https://share.timeprint.net/admin/share?code=AB12CD",
    "https://share.timeprint.net/zh-Hans/share?code=AB12CD&code=ABC234",
  ])
    assert.throws(() => queryCode(url, "auto"));
});
test("public/private/legacy access and exact expiration boundary", () => {
  const t = {
    id: "1",
    visibility: "private",
    status: 0,
    removed_at: null,
    share_code: "TQ8H3Y6V9N",
    contract_version: 2,
    expires_at: "2026-10-13T06:00:00Z",
  } as TemplateRow;
  const expiry = Date.parse(t.expires_at!);
  assert.throws(() => checkReadable(t, undefined, expiry - 1), { code: "TEMPLATE_NOT_FOUND" });
  checkReadable(t, t.share_code, expiry - 1);
  assert.throws(() => checkReadable(t, t.share_code, expiry), { code: "TEMPLATE_EXPIRED" });
  assert.throws(() => checkReadable({ ...t, status: -1 }, t.share_code, expiry - 1), { code: "TEMPLATE_REMOVED" });
  checkReadable({ ...t, contract_version: 1, visibility: null, expire_time: 0 }, t.share_code, expiry + 100);
  assert.throws(() => checkReadable({ ...t, visibility: null }, undefined, expiry - 1));
});
test("payload retains native renderer identity and unknown fields, stripping only public history", async () => {
  const payload = {
    ...fixture.nativePayloadResponse,
    itemHistories: { "8": { content: [{ text: "prior", isFavorite: false }] } },
    customFuture: { color: "blue" },
  };
  const bytes = payloadBytes(payload),
    pub = parsePayload(bytes, "public"),
    priv = parsePayload(bytes, "private");
  assert.ok(!("itemHistories" in pub));
  assert.deepEqual(priv.itemHistories, payload.itemHistories);
  assert.deepEqual(pub.watermarkModel, payload.watermarkModel);
  assert.deepEqual(pub.customFuture, payload.customFuture);
  assert.equal(payload.watermarkModel.base_id, "12");
  assert.equal(payload.watermarkModel.catalogSourceBaseID, "60");
  const p = parsePayload(
    payloadBytes({
      ...payload,
      watermarkModel: {
        ...payload.watermarkModel,
        items: [
          { id: 1, logoInfo: { logoUrl: "logo1" }, logoListInfo: { logoList: [{ logoUrl: "logo2" }] } },
          { id: 8, content: "https://example.invalid/do-not-fetch" },
        ],
      },
    }),
    "public",
  );
  const visited: string[] = [];
  await mapImages(p, async (url) => {
    visited.push(url);
    return "mapped:" + url;
  });
  assert.equal(visited.length, 3);
  assert.ok(!visited.some((v) => v.includes("do-not-fetch")));
  assert.equal(canonical({ b: 1, a: 2 }), canonical({ a: 2, b: 1 }));
});
test("invalid payloads, deep JSON, large bodies, MIME spoofing and private network resources fail", async () => {
  assert.throws(() => parsePayload(Buffer.from('{"watermarkModel":[]}'), "public"));
  assert.throws(() => parsePayload(Buffer.from('{"watermarkModel":{"items":[]},"schemaVersion":2}'), "public"), {
    code: "UNSUPPORTED_SCHEMA",
  });
  let nested: unknown = {};
  for (let i = 0; i < 42; i++) nested = { nested };
  assert.throws(() => parsePayload(payloadBytes({ watermarkModel: { items: [] }, nested }), "public"));
  await assert.rejects(imageMetadata(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), {
    code: "RESOURCE_INVALID",
  });
  await assert.rejects(boundedBytes(new Response("12345").body, 4), { code: "PAYLOAD_TOO_LARGE" });
  await assert.rejects(
    body(
      new Request("https://test.invalid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      }),
      createSchema,
    ),
    { code: "INVALID_REQUEST" },
  );
  process.env.TEMPLATE_ALLOWED_LEGACY_ASSET_HOSTS = "assets.timeprint.example";
  for (const ip of ["127.0.0.1", "10.0.0.1", "169.254.169.254", "192.168.1.1", "100.64.0.1", "172.31.0.1", "::1"])
    assert.equal(publicIPv4(ip), false);
  assert.ok(publicIPv4("8.8.8.8"));
  for (const prefix of ["", "android/"]) {
    for (const [kind, folder] of [
      ["cover", "ugc_cover"],
      ["payload", "ugc_json"],
      ["logo", "ugc_logo"],
    ] as const) {
      const url = `https://assets.timeprint.example/${prefix}${folder}/example_123.png`;
      assert.equal(legacyURL(url, kind).pathname, `/${prefix}${folder}/example_123.png`);
    }
  }
  for (const path of [
    "/android/private/file.json",
    "/android/ugc_cover/file.png",
    "/android/ugc_json/%2Ffile.json",
    "/other/ugc_json/file.json",
    "/ugc_json/%252Fprivate.json",
    "/ugc_json/%ZZ.json",
  ])
    assert.throws(() => legacyURL(`https://assets.timeprint.example${path}`, "payload"));
  const localized = "https://assets.timeprint.example/android/ugc_json/٢٠٢٦٠٨٣١_3gup.json";
  assert.equal(
    legacyURL("https://assets.timeprint.example/wm_logo/jt_express_logo2.png", "logo").pathname,
    "/wm_logo/jt_express_logo2.png",
  );
  assert.throws(() => legacyURL("https://assets.timeprint.example/wm_logo/jt_express_logo2.png", "payload"));
  assert.equal(decodeURIComponent(legacyURL(localized, "payload").pathname), "/android/ugc_json/٢٠٢٦٠٨٣١_3gup.json");
  assert.equal(legacyURL(encodeURI(localized), "payload").href, legacyURL(localized, "payload").href);
  for (const url of [
    "https://evil.example/ugc_json/1.json",
    "http://assets.timeprint.example/ugc_json/1.json",
    "https://assets.timeprint.example:444/ugc_json/1.json",
    "https://assets.timeprint.example/ugc_json/%2fprivate",
  ])
    assert.throws(() => legacyURL(url, "payload"));
});
test("signed pagination is bound to query and offset; generated codes use the contract alphabet", () => {
  const token = cursorEncode(randomUUID(), 20, "query-hash");
  assert.equal(cursorDecode(token, "query-hash").offset, 20);
  assert.throws(() => cursorDecode(token, "other-query"));
  assert.throws(() => cursorDecode(token + "x", "query-hash"));
  const codes = new Set(Array.from({ length: 1000 }, shareCode));
  assert.equal(codes.size, 1000);
  for (const code of codes) assert.match(code, /^T[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{9}$/);
  assert.equal(searchSchema.safeParse({ ...fixture.searchRequest, limit: 51 }).success, false);
  assert.ok(reportSchema.safeParse(fixture.reportRequest).success);
});
