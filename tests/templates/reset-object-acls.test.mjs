import assert from "node:assert/strict";
import { test } from "node:test";

import { resetObjectACLs } from "../../scripts/reset-template-object-acls.mjs";

const options = { Bucket: "fixture-1234567890", Region: "ap-singapore", Prefix: "template-assets-v2/" };
const key = (id) => `${options.Prefix}sealed/session/${id}`;

test("ACL reset: preview follows pagination without modifying objects", async () => {
  const markers = [];
  const result = await resetObjectACLs(
    {
      async getBucket(params) {
        assert.equal(params.Prefix, options.Prefix);
        markers.push(params.Marker);
        return params.Marker
          ? { Contents: [{ Key: key("b") }], IsTruncated: "false" }
          : { Contents: [{ Key: key("a") }], IsTruncated: "true", NextMarker: key("a") };
      },
      async putObjectAcl() {
        assert.fail("Preview must not modify ACLs");
      },
    },
    options,
    () => {},
  );
  assert.deepEqual(markers, ["", key("a")]);
  assert.deepEqual(result, { scanned: 2, updated: 0, failed: 0 });
});

test("ACL reset: applies default, bounds concurrency and reports failures without dropping other objects", async () => {
  let running = 0;
  let peak = 0;
  const logs = [];
  const result = await resetObjectACLs(
    {
      async getBucket() {
        return { Contents: Array.from({ length: 12 }, (_, i) => ({ Key: key(String(i)) })) };
      },
      async putObjectAcl(params) {
        assert.equal(params.ACL, "default");
        assert.equal(params.Bucket, options.Bucket);
        peak = Math.max(peak, ++running);
        await new Promise((resolve) => setImmediate(resolve));
        running--;
        if (params.Key === key("3"))
          throw Object.assign(new Error("Denied"), { code: "AccessDenied", statusCode: 403 });
      },
    },
    { ...options, apply: true },
    (line) => logs.push(JSON.parse(line)),
  );
  assert.deepEqual(result, { scanned: 12, updated: 11, failed: 1 });
  assert.ok(peak <= 5);
  assert.equal(logs.find((entry) => entry.action === "failed").key, key("3"));
});

test("ACL reset: stops on invalid pagination instead of repeating updates forever", async () => {
  await assert.rejects(
    resetObjectACLs(
      {
        async getBucket() {
          return { Contents: [], IsTruncated: true };
        },
      },
      options,
      () => {},
    ),
    /pagination did not advance/,
  );
});
