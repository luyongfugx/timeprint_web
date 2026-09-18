import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

import type { Asset } from "../../src/lib/templates/asset-service";
import type { TemplateRow } from "../../src/lib/templates/contracts";
import { sha256 } from "../../src/lib/templates/crypto";
import { cosObjectReference } from "../../src/lib/templates/storage";

const load = createRequire(import.meta.url);
test("payload routes accept legacy IDs and owned COS URLs and return direct resources with a matching digest", async (t) => {
  function replace(path: string, overrides: Record<string, unknown>) {
    const original = load(path),
      cached = load.cache[load.resolve(path)]!;
    cached.exports = { ...original, ...overrides };
    t.after(() => {
      cached.exports = original;
    });
  }
  const template = {
    id: "123",
    cover_asset_id: "cover",
    payload_asset_id: "payload",
    visibility: "public",
    status: 0,
    removed_at: null,
    contract_version: 2,
    expires_at: null,
    share_code: "Y9VH52",
  } as TemplateRow;
  const images = ["cover", "logo"].map(
    (id) =>
      ({
        id,
        template_id: "123",
        kind: id,
        state: "sealed",
        object_key: `staging/session/${id}`,
        sealed_key: `sealed/session/${id}`,
        request_id: null,
      }) as Asset,
  );
  let input: unknown;
  let fetched = 0;
  replace("../../src/lib/templates/asset-service", {
    getAsset: async (id: string) => {
      assert.equal(id, "payload");
      return { id, template_id: "123", kind: "payload", state: "sealed", sealed_key: "sealed/session/payload" };
    },
    downloadObject: async (key: string) => {
      assert.equal(key, "sealed/session/payload");
      fetched++;
      return Buffer.from(JSON.stringify(input));
    },
  });
  replace("../../src/lib/templates/repository", {
    rows: async (sql: string, values: unknown[]) => {
      assert.deepEqual(values, ["123"]);
      return sql.includes("template_asset_records") ? images : [template];
    },
  });
  const { payloadResponse } = load("../../src/lib/templates/access-service");
  for (const mode of ["internal", "sealed", "staging"]) {
    const url = (a: Asset) =>
      mode === "internal"
        ? `template-asset:${a.id}`
        : cosObjectReference(mode === "sealed" ? a.sealed_key! : a.object_key);
    input = {
      coverUrl: url(images[0]),
      watermarkModel: {
        items: [
          {
            id: 1,
            content: "template-asset:keep-text",
            logoInfo: { logoUrl: url(images[1]) },
            extraLogoListInfo: { logoList: [{ logoUrl: url(images[1]) }] },
          },
        ],
      },
      itemHistories: {},
    };
    const response = await payloadResponse(template);
    const bytes = await response.text();
    assert.equal(response.headers.get("X-Payload-SHA256"), sha256(bytes));
    const output = JSON.parse(bytes);
    assert.equal(output.coverUrl, cosObjectReference(images[0].sealed_key!));
    assert.equal(output.watermarkModel.items[0].logoInfo.logoUrl, cosObjectReference(images[1].sealed_key!));
    assert.equal(
      output.watermarkModel.items[0].extraLogoListInfo.logoList[0].logoUrl,
      cosObjectReference(images[1].sealed_key!),
    );
    assert.equal(output.watermarkModel.items[0].content, "template-asset:keep-text");
    assert.equal(output.itemHistories, undefined);
  }
  for (const url of [
    "template-asset:other-share",
    cosObjectReference("sealed/other/cover"),
    "https://example.com/image.png",
    "template-asset:logo",
  ]) {
    input = { coverUrl: url, watermarkModel: { items: [] } };
    await assert.rejects(payloadResponse(template), { code: "RESOURCE_INVALID" });
  }
  assert.equal(fetched, 7);
});
