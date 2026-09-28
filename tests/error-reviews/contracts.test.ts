import assert from "node:assert/strict";
import { test } from "node:test";

import { normalizeLog, redact, stratifiedObjects } from "../../src/lib/error-reviews/collect";
import {
  yesterday,
  reviewWindow,
  reviewSchema,
  updateSchema,
  canTransition,
} from "../../src/lib/error-reviews/contracts";

import { fixture } from "./fixtures";

test("Shanghai previous calendar day and exact half-open 24-hour window", () => {
  assert.equal(yesterday(new Date("2026-09-28T15:59:59Z")), "2026-09-27");
  assert.equal(yesterday(new Date("2026-09-28T16:00:00Z")), "2026-09-28");
  assert.deepEqual(reviewWindow("2026-09-27"), { start: "2026-09-26T16:00:00.000Z", end: "2026-09-27T16:00:00.000Z" });
  assert.throws(() => reviewWindow("2026-02-30"));
});
test("event timestamps override upload times; legacy upload fallback is explicit", () => {
  const o = { platform: "ios" as const, key: "ios_err_log_20260110/a.txt", size: 10, modified: "2026-01-10T03:00:00Z" };
  assert.equal(
    normalizeLog(o, JSON.stringify({ created_at_ms: Date.parse("2026-01-10T16:00:00Z") }), "2026-01-10", "key")
      .evidence,
    null,
  );
  assert.equal(
    normalizeLog(o, JSON.stringify({ created_at_ms: Date.parse("2026-01-09T16:00:00Z") }), "2026-01-10", "key").evidence
      ?.timeBasis,
    "event",
  );
  assert.equal(normalizeLog(o, "legacy text", "2026-01-10", "key").evidence?.timeBasis, "upload");
});
test("redaction and keyed identities preserve grouping without storing raw user IDs", () => {
  const r = fixture();
  const a = r.evidence[0];
  assert.notEqual(a.fingerprint, r.evidence[1].fingerprint);
  assert.equal(a.deviceHash?.length, 64);
  assert.ok(!JSON.stringify(a).includes("private-device"));
  assert.ok(
    !redact("token=secret-value https://example.com/a?secret=x user@example.com latitude=20.111").includes(
      "secret-value",
    ),
  );
});
test("strata include different errors before consuming repeat noise", () => {
  const sample = (key: string) => ({ platform: "android" as const, key, size: 12, modified: "" });
  const noisy = Array.from({ length: 20 }, (_, i) => sample(`folder/4.2_camera_error_A_${i}.txt`));
  const chosen = stratifiedObjects([...noisy, sample("folder/4.2_save_error_B_1.txt")]).slice(0, 2);
  assert.ok(chosen.some((o) => o.key.includes("save")));
});
test("publication rejects drafts, bad windows, duplicate evidence and mismatched attribution", () => {
  const r = fixture();
  assert.ok(reviewSchema.safeParse(r).success);
  assert.ok(!reviewSchema.safeParse({ ...r, reviewed: false }).success);
  assert.ok(!reviewSchema.safeParse({ ...r, window: { ...r.window, end: r.window.start } }).success);
  assert.ok(!reviewSchema.safeParse({ ...r, evidence: [...r.evidence, r.evidence[0]] }).success);
  const wrong = structuredClone(r);
  wrong.findings[0].evidenceIds = [r.evidence[1].id];
  assert.ok(!reviewSchema.safeParse(wrong).success);
});
test("workflow requires diagnosis, release verification and recorded reasons", () => {
  assert.equal(canTransition("new", "closed"), false);
  assert.equal(canTransition("closed", "investigating"), true);
  assert.equal(canTransition("verifying", "closed"), true);
  assert.ok(
    !updateSchema.safeParse({ version: 1, status: "closed", note: "", owner: "a", fixVersion: "", fixLink: "" })
      .success,
  );
  assert.ok(
    !updateSchema.safeParse({ version: 1, status: "fixed", note: "done", owner: "a", fixVersion: "", fixLink: "" })
      .success,
  );
});
