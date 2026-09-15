import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { test } from "node:test";

import type { Asset, Session } from "../../src/lib/templates/asset-service";
import type { CreateInput } from "../../src/lib/templates/contracts";
import { actorHash } from "../../src/lib/templates/crypto";

const requireModule = createRequire(import.meta.url);

test("legacy and v2 publishing header compatibility", async (t) => {
  const savedEnv = { ...process.env };
  Object.assign(process.env, {
    TEMPLATE_COS_BUCKET: "fixture-1234567890",
    TEMPLATE_COS_REGION: "ap-singapore",
    TEMPLATE_COS_PREFIX: "template-assets-v2",
    TEMPLATE_COS_SECRET_ID: "fixture-id",
    TEMPLATE_COS_SECRET_KEY: "fixture-key",
    TEMPLATE_PUBLIC_ENABLED: "true",
    TEMPLATE_PRIVATE_ENABLED: "true",
    TEMPLATE_ACTOR_HMAC_KEY: "test-only-publish-hmac-secret-32-characters",
  });
  t.after(() => {
    process.env = savedEnv;
  });

  // Replace only I/O boundaries. Exercise the actual route, input validation,
  // publish orchestration, actor checks and asset-reference validation.
  function replaceModule(path: string, overrides: Record<string, unknown>) {
    const original = requireModule(path);
    const cached = requireModule.cache[requireModule.resolve(path)]!;
    cached.exports = { ...original, ...overrides };
    t.after(() => {
      cached.exports = original;
    });
    return original;
  }

  const sid = randomUUID(),
    coverID = randomUUID(),
    payloadID = randomUUID();
  const token = "server-created-upload-token";
  let ready: Session;
  let snapshots: CreateInput[] = [];
  let commits: { input: CreateInput; contract: number; expiry: number }[] = [];
  const assets = replaceModule("../../src/lib/templates/asset-service", {
    getAsset: async (id: string) =>
      ({ id, upload_session_id: sid, kind: "cover", object_key: `staging/${sid}/cover` }) as Asset,
    session: async (id: string, secret: string) => {
      assert.equal(id, sid);
      assert.equal(secret, token);
      return ready;
    },
  }) as typeof import("../../src/lib/templates/asset-service");
  const coverImageURL = assets.referenceURL(sid, coverID);
  const jsonDownloadURL = assets.referenceURL(sid, payloadID);
  replaceModule("../../src/lib/templates/legacy-assets", {
    legacySnapshot: async (input: CreateInput) => {
      snapshots.push(input);
      ready = {
        id: sid,
        actor_hash: actorHash(input.userID),
        client_request_id: input.clientRequestID,
        visibility: input.visibility,
        state: "ready",
        cover_asset_id: coverID,
        payload_asset_id: payloadID,
      } as Session;
      return { uploadSessionID: sid, uploadToken: token, coverImageURL, jsonDownloadURL };
    },
  });
  replaceModule("../../src/lib/templates/transactions", {
    publishTransaction: async (id: string, secret: string, input: CreateInput, contract: number, expiry: number) => {
      assert.equal(id, sid);
      assert.equal(secret, token);
      commits.push({ input, contract, expiry });
      return {
        replay: false,
        receipt: {
          templateID: "123",
          shareCode: "ABC12345",
          shareLink: "https://share.timeprint.net/share?code=ABC12345",
        },
      };
    },
  });
  replaceModule("../../src/lib/templates/routes", { requestLimit: async () => {} });
  const { publish } = requireModule(
    "../../src/lib/templates/publish-service",
  ) as typeof import("../../src/lib/templates/publish-service");
  const { POST } = requireModule("../../src/app/api/applink/route") as typeof import("../../src/app/api/applink/route");

  const legacyBody = {
    watermarkName: "旧版水印",
    coverImageUrl: "https://assets.example/android/ugc_cover/cover.png",
    jsonDownloadUrl: "https://assets.example/android/ugc_json/template.json",
  };
  for (const [expireType, expiry] of [0, 2592000, 86400, 3600].entries()) {
    await t.test(`old app without any v2 headers: expireType=${expireType}`, async () => {
      snapshots = [];
      commits = [];
      const response = await POST(
        new Request("https://wm.timeprint.net/api/applink", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...legacyBody,
            ...(expireType ? { expireType, userId: "old-device-id", status: 0 } : {}),
          }),
        }),
      );
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        success: true,
        shareCode: "ABC12345",
        shareLink: "https://share.timeprint.net/share?code=ABC12345",
      });
      assert.equal(snapshots.length, 1);
      assert.equal(snapshots[0].coverImageURL, legacyBody.coverImageUrl);
      assert.equal(snapshots[0].jsonDownloadURL, legacyBody.jsonDownloadUrl);
      assert.match(snapshots[0].clientRequestID, /^[0-9a-f-]{36}$/);
      assert.equal(snapshots[0].userID, expireType ? "old-device-id" : "legacy-anonymous");
      assert.equal(commits.length, 1);
      assert.equal(commits[0].contract, 1);
      assert.equal(commits[0].expiry, expiry);
      assert.equal(commits[0].input.coverImageURL, coverImageURL);
      assert.equal(commits[0].input.jsonDownloadURL, jsonDownloadURL);
    });
  }

  const input: CreateInput = {
    contractVersion: 2,
    clientRequestID: randomUUID(),
    userID: randomUUID(),
    visibility: "public",
    watermarkName: "New template",
    companyName: "",
    coverKind: "watermark",
    coverWidth: 1,
    coverHeight: 1,
    coverImageURL: legacyBody.coverImageUrl,
    jsonDownloadURL: legacyBody.jsonDownloadUrl,
  };
  const request = (headers: Record<string, string> = {}) =>
    new Request("https://wm.timeprint.net/api/applink/v2/templates", { headers });
  await t.test("v2 still rejects missing and mismatched idempotency keys", async () => {
    const cases: Record<string, string>[] = [{}, { "Idempotency-Key": randomUUID() }];
    for (const headers of cases) await assert.rejects(publish(request(headers), input), { code: "INVALID_REQUEST" });
  });
  await t.test("v2 public URL publishing still creates a server session", async () => {
    snapshots = [];
    commits = [];
    await publish(request({ "Idempotency-Key": input.clientRequestID }), input);
    assert.equal(snapshots.length, 1);
    assert.equal(commits[0].contract, 2);
  });
  await t.test("private sharing and asset references cannot bypass upload credentials", async () => {
    const req = request({ "Idempotency-Key": input.clientRequestID });
    await assert.rejects(publish(req, { ...input, visibility: "private" }), { code: "UPLOAD_PROTOCOL_REQUIRED" });
    for (const refs of [{ coverImageURL }, { jsonDownloadURL }])
      await assert.rejects(publish(req, { ...input, ...refs }), { code: "UPLOAD_TOKEN_INVALID" });
  });
  await t.test("v2 controlled uploads use the supplied session without snapshotting", async () => {
    snapshots = [];
    commits = [];
    await publish(
      request({
        "Idempotency-Key": input.clientRequestID,
        "X-Template-Upload-Session": sid,
        "X-Template-Upload-Token": token,
      }),
      { ...input, coverImageURL, jsonDownloadURL },
    );
    assert.equal(snapshots.length, 0);
    assert.equal(commits.length, 1);
    assert.equal(commits[0].contract, 2);
  });
  await t.test("COS cover address publishes only for its own public upload session", async () => {
    const url = `https://fixture-1234567890.cos.ap-singapore.myqcloud.com/template-assets-v2/staging/${sid}/cover`;
    const req = request({
      "Idempotency-Key": input.clientRequestID,
      "X-Template-Upload-Session": sid,
      "X-Template-Upload-Token": token,
    });
    await publish(req, { ...input, coverImageURL: url, jsonDownloadURL });
    assert.equal(commits.at(-1)!.input.coverImageURL, url);
    for (const invalid of [
      url + "?q-signature=temporary",
      url.replace(sid, randomUUID()),
      url.replace("fixture-1234567890", "other-1234567890"),
    ]) {
      await assert.rejects(publish(req, { ...input, coverImageURL: invalid, jsonDownloadURL }), {
        code: "RESOURCE_INVALID",
      });
    }
    ready.visibility = "private";
    await assert.rejects(publish(req, { ...input, visibility: "private", coverImageURL: url, jsonDownloadURL }), {
      code: "RESOURCE_INVALID",
    });
  });
});
