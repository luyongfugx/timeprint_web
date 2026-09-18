import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

import type { TemplateRow } from "../../src/lib/templates/contracts";

const requireModule = createRequire(import.meta.url);

test("legacy GET returns unsigned COS resources without reading or migrating objects", async (t) => {
  const env = { ...process.env };
  Object.assign(process.env, {
    TEMPLATE_COS_BUCKET: "fixture-1234567890",
    TEMPLATE_COS_REGION: "ap-singapore",
    TEMPLATE_COS_PREFIX: "template-assets-v2",
    TEMPLATE_ALLOWED_LEGACY_ASSET_HOSTS: "fixture-1234567890.cos.ap-singapore.myqcloud.com",
  });
  delete process.env.TEMPLATE_COS_SECRET_ID;
  delete process.env.TEMPLATE_COS_SECRET_KEY;
  t.after(() => {
    process.env = env;
  });
  function replace(path: string, overrides: Record<string, unknown>) {
    const original = requireModule(path);
    const cached = requireModule.cache[requireModule.resolve(path)]!;
    cached.exports = { ...original, ...overrides };
    t.after(() => {
      cached.exports = original;
    });
  }
  const host = "https://fixture-1234567890.cos.ap-singapore.myqcloud.com";
  let template = {
    id: "123",
    contract_version: 2,
    visibility: "public",
    watermark_name: "Fixture",
    company_name: "Company",
    share_code: "Y9VH52",
    status: 0,
    created_at: "2026-09-18T00:00:00.000Z",
    expires_at: null,
    expire_time: 0,
    removed_at: null,
    cover_asset_id: "cover",
    payload_asset_id: "payload",
    cover_image_url: "https://wm.timeprint.net/api/applink/v2/assets/cover",
    json_download_url: "https://wm.timeprint.net/api/applink/v2/assets/payload",
  } as TemplateRow;
  let mode = "deferred";
  let resourceFormat: string | null = null;
  let missingPayload = false;
  const queries: string[] = [];
  replace("../../src/lib/templates/repository", {
    rows: async (sql: string, values: unknown[]) => {
      queries.push(sql);
      if (sql.includes("watermarks_share_links")) {
        assert.match(sql, /WHERE normalized_share_code=\?/);
        assert.deepEqual(values, ["Y9VH52"]);
        return [template];
      }
      assert.match(sql, /a\.template_id=\?/);
      assert.deepEqual(values, ["123", "cover", "payload"]);
      return ["cover", ...(missingPayload ? [] : ["payload"])].map((kind) => ({
        id: kind,
        kind,
        sealed_key: `sealed/session/${kind}`,
        upload_mode: mode,
        resource_format: resourceFormat,
      }));
    },
  });
  replace("../../src/lib/templates/routes", { requestLimit: async () => {} });
  t.mock.method(globalThis, "fetch", async () => {
    throw new Error("Metadata GET must not fetch resources");
  });
  const { GET } = requireModule("../../src/app/api/applink/[id]/route");
  const get = () =>
    GET(new Request("https://wm.timeprint.net/api/applink/y9vh52"), {
      params: Promise.resolve({ id: "y9vh52" }),
    });
  const response = await get();
  assert.equal(response.status, 200);
  const { shareLink } = await response.json();
  assert.equal(shareLink.cover_image_url, `${host}/template-assets-v2/sealed/session/cover`);
  assert.equal(shareLink.json_download_url, `${host}/template-assets-v2/sealed/session/payload`);
  assert.equal(new URL(shareLink.json_download_url).search, "");
  assert.equal(shareLink.share_code, "Y9VH52");
  assert.equal(queries.length, 2);

  missingPayload = true;
  assert.equal((await get()).status, 422);
  missingPayload = false;
  template = { ...template, status: -1 };
  assert.equal((await get()).status, 410);
  template = { ...template, status: 0, expires_at: "2000-01-01T00:00:00.000Z" };
  assert.equal((await get()).status, 410);
  template = { ...template, expires_at: null, visibility: "private" };
  const privateShare = (await (await get()).json()).shareLink;
  assert.equal(privateShare.watermark_name, "");
  assert.ok(privateShare.json_download_url.includes("code=Y9VH52"));
  template = { ...template, visibility: "public" };
  mode = "snapshot";
  assert.match((await (await get()).json()).shareLink.json_download_url, /\/templates\/123\/payload/);
  resourceFormat = "cos";
  assert.equal(
    (await (await get()).json()).shareLink.json_download_url,
    `${host}/template-assets-v2/sealed/session/payload`,
  );

  template = {
    ...template,
    contract_version: 1,
    visibility: null,
    cover_asset_id: null,
    payload_asset_id: null,
    cover_image_url: `${host}/ugc_cover/original.png`,
    json_download_url: `${host}/ugc_json/original.json`,
  };
  queries.length = 0;
  const legacy = (await (await get()).json()).shareLink;
  assert.equal(legacy.cover_image_url, template.cover_image_url);
  assert.equal(legacy.json_download_url, template.json_download_url);
  assert.equal(queries.length, 1);
});
