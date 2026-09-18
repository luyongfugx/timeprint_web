import assert from "node:assert/strict";
import { test } from "node:test";

import { cosConfigured, objectKey, signedObjectURL } from "../../scripts/lib/cos.mjs";
import { signedUpload, signedDeferredUpload, uploadObject, downloadObject } from "../../src/lib/templates/storage";

Object.assign(process.env, {
  TEMPLATE_COS_BUCKET: "fixture-1234567890",
  TEMPLATE_COS_REGION: "ap-singapore",
  TEMPLATE_COS_PREFIX: "template-assets-v2",
  TEMPLATE_COS_SECRET_ID: "fixture-id",
  TEMPLATE_COS_SECRET_KEY: "fixture-key",
});

test("COS: deferred uploads inherit bucket permissions without signing an ACL header", async () => {
  const receipt = await signedDeferredUpload("sealed/session/asset", "application/json");
  assert.equal("x-cos-acl" in receipt.uploadHeaders, false);
  assert.equal(new URL(receipt.uploadURL).searchParams.get("q-header-list")?.split(";").includes("x-cos-acl"), false);
});

test("COS: isolated keys and signed PUT are bounded by session lifetime", async () => {
  assert.equal(cosConfigured(), true);
  assert.equal(objectKey("staging/session/asset"), "template-assets-v2/staging/session/asset");
  assert.throws(() => objectKey("../ugc_json/old.json"));
  assert.throws(() => objectKey("sealed/session/../../old"));
  const receipt = await signedUpload(
    "staging/session/asset",
    "application/json",
    new Date(Date.now() + 120000).toISOString(),
  );
  const url = new URL(receipt.uploadURL);
  assert.equal(url.protocol, "https:");
  assert.equal(url.hostname, "fixture-1234567890.cos.ap-singapore.myqcloud.com");
  assert.equal(url.pathname, "/template-assets-v2/staging/session/asset");
  assert.equal("x-cos-acl" in receipt.uploadHeaders, false);
  assert.equal(url.searchParams.get("q-header-list")?.split(";").includes("x-cos-acl"), false);
  assert.equal(receipt.uploadHeaders["x-cos-forbid-overwrite"], "true");
  for (const name of ["content-type", "host", "x-cos-forbid-overwrite"])
    assert.ok(url.searchParams.get("q-header-list")?.split(";").includes(name));
  const [start, end] = url.searchParams.get("q-sign-time")!.split(";").map(Number);
  assert.ok(end - start <= 120);
  assert.ok(!receipt.uploadURL.includes("fixture-key"));
  const get = new URL(await signedObjectURL("staging/session/asset", "GET"));
  assert.notEqual(url.searchParams.get("q-signature"), get.searchParams.get("q-signature"));
  await assert.rejects(signedUpload("staging/session/asset", "image/png", new Date(0).toISOString()), {
    code: "UPLOAD_SESSION_EXPIRED",
  });
});

test("COS: upload inherits bucket permissions; bounded downloads reject oversized or unavailable objects", async (t) => {
  const requests: { method: string; headers: Headers }[] = [];
  const replies = [
    new Response("", { status: 200 }),
    new Response(new Uint8Array([1, 2, 3])),
    new Response(new Uint8Array([1, 2, 3, 4])),
    new Response("Denied", { status: 403 }),
  ];
  t.mock.method(globalThis, "fetch", async (_input: unknown, init: RequestInit) => {
    assert.equal(init.redirect, "error");
    requests.push({ method: init.method ?? "GET", headers: new Headers(init.headers) });
    return replies.shift()!;
  });
  await uploadObject("sealed/session/asset", Buffer.from("{}"), "application/json");
  assert.equal(requests[0].headers.has("x-cos-acl"), false);
  assert.equal(requests[0].headers.get("x-cos-forbid-overwrite"), "true");
  assert.deepEqual(await downloadObject("sealed/session/asset", 3), Buffer.from([1, 2, 3]));
  await assert.rejects(downloadObject("sealed/session/asset", 3), { code: "PAYLOAD_TOO_LARGE" });
  await assert.rejects(downloadObject("sealed/session/asset", 3), { code: "RESOURCE_NOT_READY" });
});
