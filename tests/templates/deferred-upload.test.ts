import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { test } from "node:test";

import type { Asset, Session } from "../../src/lib/templates/asset-service";

const load = createRequire(import.meta.url);
test("deferred plans reserve addresses without COS I/O and publish before bytes exist", async (t) => {
  const env = { ...process.env };
  Object.assign(process.env, {
    TEMPLATE_COS_BUCKET: "wm-1330977225",
    TEMPLATE_COS_REGION: "ap-singapore",
    TEMPLATE_COS_PREFIX: "template-assets-v2",
    TEMPLATE_COS_SECRET_ID: "fixture",
    TEMPLATE_COS_SECRET_KEY: "fixture",
    TEMPLATE_ACTOR_HMAC_KEY: "fixture-secret-at-least-thirty-two-characters",
    TEMPLATE_PUBLIC_ENABLED: "true",
    TEMPLATE_PRIVATE_ENABLED: "true",
  });
  t.after(() => {
    process.env = env;
  });
  function replace(path: string, overrides: Record<string, unknown>) {
    const original = load(path),
      cached = load.cache[load.resolve(path)]!;
    cached.exports = { ...original, ...overrides };
    t.after(() => {
      cached.exports = original;
    });
  }
  let stored: Record<string, any> | undefined;
  let assets: Asset[] = [],
    publishCalls = 0;
  const query = async (sql: string, values: unknown[]) => {
    if (sql.includes("template_upload_sessions")) return stored ? [{ ...stored }] : [];
    if (sql.includes("template_asset_records") && sql.includes("upload_session_id")) return assets;
    if (sql.includes("template_asset_records")) return assets.filter((a) => a.id === values[0]);
    throw new Error(`Unexpected query: ${sql}`);
  };
  const write = async (sql: string, values: any[]) => {
    if (sql.startsWith("INSERT INTO template_upload_sessions")) {
      stored ??= {
        id: values[0],
        actor_hash: values[1],
        client_request_id: values[2],
        visibility: values[3],
        token_hash: values[4],
        purpose: "template",
        state: "open",
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        manifest_hash: null,
      };
    } else if (sql.startsWith("INSERT INTO template_assets")) {
      assets.push({
        id: values[0],
        upload_session_id: values[1],
        kind: values[3],
        object_key: values[4],
        sealed_key: values[5],
        mime: values[6],
        bytes: values[7],
        sha256: values[8],
        state: "sealed",
        template_id: null,
        request_id: null,
      } as Asset);
    } else if (sql.includes("manifest_hash=")) {
      Object.assign(stored!, {
        state: "ready",
        manifest_hash: values[0],
        completion_json: JSON.parse(values[1]),
        cover_asset_id: values[2],
        payload_asset_id: values[3],
      });
    } else if (!sql.includes("expires_at=")) throw new Error(`Unexpected write: ${sql}`);
  };
  replace("../../src/lib/templates/database", {
    rows: query,
    write,
    transaction: async (fn: (c: unknown) => unknown) => fn({}),
  });
  replace("../../src/lib/templates/repository", { rows: query, rateLimit: async () => {} });
  replace("../../src/lib/templates/storage", {
    downloadObject: async () => {
      throw new Error("Must not download or validate bytes");
    },
    uploadObject: async () => {
      throw new Error("Must not seal or proxy bytes");
    },
  });
  let removed = false;
  replace("../../src/lib/templates/access-service", {
    readRow: async () => ({
      visibility: "private",
      share_code: "ABC123",
      status: removed ? -1 : 0,
      contract_version: 2,
      expires_at: null,
    }),
  });
  replace("../../src/lib/templates/transactions", {
    publishTransaction: async () => {
      publishCalls++;
      stored!.state = "committed";
      assets.forEach((a) => {
        a.template_id = "template";
      });
      return { replay: publishCalls > 1, receipt: { shareCode: "ABC123" } };
    },
  });
  const { createDeferredPlan, deferredPlanSchema, refreshDeferredTicket } = load(
    "../../src/lib/templates/deferred-upload",
  );
  const { publish } = load("../../src/lib/templates/publish-service");
  for (const visibility of ["public", "private"] as const) {
    stored = undefined;
    assets = [];
    publishCalls = 0;
    const input = {
      clientRequestID: randomUUID(),
      userID: randomUUID(),
      visibility,
      uploadToken: "a".repeat(64),
      assets: [
        {
          assetID: randomUUID(),
          kind: "cover",
          contentType: "image/png",
          byteLength: 123,
          sha256: "b".repeat(64),
          width: 100,
          height: 100,
        },
        {
          assetID: randomUUID(),
          kind: "payload",
          contentType: "application/json",
          byteLength: 55,
          sha256: "c".repeat(64),
        },
      ],
    };
    const parsed = deferredPlanSchema.parse(input);
    const plan = await createDeferredPlan(parsed);
    assert.equal(assets.length, 2);
    assert.equal(plan.uploadSessionID, input.clientRequestID);
    assert.equal(stored!.state, "ready");
    for (const a of plan.assets) {
      assert.ok(a.objectURL.includes(`/sealed/${input.clientRequestID}/`));
      assert.equal("x-cos-acl" in a.uploadHeaders, false);
      assert.equal(a.uploadHeaders["x-cos-forbid-overwrite"], undefined);
    }
    await createDeferredPlan(parsed);
    assert.equal(assets.length, 2, "ambiguous plan retry reuses addresses");
    await assert.rejects(createDeferredPlan({ ...parsed, uploadToken: "d".repeat(64) }), {
      code: "UPLOAD_TOKEN_INVALID",
    });
    await assert.rejects(
      createDeferredPlan({
        ...parsed,
        assets: parsed.assets.map((a: any) => ({ ...a, byteLength: a.byteLength + 1 })),
      }),
      { code: "IDEMPOTENCY_CONFLICT" },
    );
    const cover = plan.assets.find((a: any) => a.assetID === input.assets[0].assetID);
    const payload = plan.assets.find((a: any) => a.assetID === input.assets[1].assetID);
    const body = {
      clientRequestID: input.clientRequestID,
      userID: input.userID,
      visibility,
      coverImageURL: cover.objectURL,
      jsonDownloadURL: payload.objectURL,
    };
    const req = new Request("https://wm.timeprint.net/api/applink/v2/templates", {
      headers: {
        "Idempotency-Key": input.clientRequestID,
        "X-Template-Upload-Session": input.clientRequestID,
        "X-Template-Upload-Token": input.uploadToken,
      },
    });
    const first = await publish(req, body);
    const replay = await publish(req, body);
    assert.equal(first.receipt.shareCode, replay.receipt.shareCode);
    assert.equal(replay.replay, true);
    stored!.expires_at = new Date(0).toISOString();
    const fresh = await refreshDeferredTicket(input.clientRequestID, input.uploadToken, input.assets[0].assetID);
    assert.equal(fresh.objectURL, cover.objectURL, "committed uploads can refresh after original session expiry");
    await assert.rejects(refreshDeferredTicket(input.clientRequestID, "wrong", input.assets[0].assetID), {
      code: "UPLOAD_TOKEN_INVALID",
    });
    removed = true;
    await assert.rejects(refreshDeferredTicket(input.clientRequestID, input.uploadToken, input.assets[0].assetID), {
      code: "TEMPLATE_REMOVED",
    });
    removed = false;
  }
});
