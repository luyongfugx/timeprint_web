import assert from "node:assert/strict";
import { test } from "node:test";

import { reviewSchema } from "../../src/lib/error-reviews/contracts";
import { normalizeFirebaseEvent } from "../../src/lib/error-reviews/firebase";

import { fixture } from "./fixtures";

const app = "projects/test-project/apps/1:123:android:abcdef";
const raw = {
  name: app + "/events/event123",
  eventTime: "2026-01-10T02:00:00Z",
  platform: "ANDROID",
  issue: { id: "issue123", errorType: "ANR", title: "Main thread blocked" },
  installationUuid: "private-install",
  sessionId: "private-session",
  threads: [
    {
      name: "main",
      threadState: "THREAD_STATE_BLOCKED",
      frames: [{ symbol: "Work.run", file: "Work.kt", line: "12" }],
    },
  ],
  customKeys: { secret: "dont-store" },
  user: { email: "dont-store@example.test" },
};
test("Firebase accepts canonical project numbers but rejects unrelated sources", () => {
  const normalize = (name: string) =>
    normalizeFirebaseEvent({ ...raw, name }, "android", app, "2026-01-10", "test-key");
  assert.ok(normalize("projects/123/apps/1:123:android:abcdef/events/event123"));
  assert.throws(() => normalize("projects/456/apps/1:123:android:abcdef/events/event123"));
  assert.throws(() => normalize("projects/123/apps/1:123:android:other/events/event123"));
});
test("Firebase ANR normalization preserves blamed stack and isolates identity/source", () => {
  const e = normalizeFirebaseEvent(raw, "android", app, "2026-01-10", "test-key")!;
  assert.equal(e.errorCode, "firebase_anr");
  assert.equal(e.source, "firebase");
  assert.match(e.stack, /THREAD_STATE_BLOCKED/);
  assert.ok(!JSON.stringify(e).includes("private-install"));
  assert.ok(!JSON.stringify(e).includes("dont-store"));
  assert.equal(
    normalizeFirebaseEvent({ ...raw, eventTime: "2026-01-10T16:00:00Z" }, "android", app, "2026-01-10", "test-key"),
    null,
  );
  assert.throws(() => normalizeFirebaseEvent({ ...raw, platform: "IOS" }, "android", app, "2026-01-10", "test-key"));
  const r = fixture();
  r.evidence.push(e);
  assert.equal(reviewSchema.safeParse(r).success, false);
  r.firebaseCoverage = {
    android: {
      listed: 1,
      downloaded: 1,
      failed: 0,
      excluded: 0,
      unparsed: 0,
      limited: true,
      listingComplete: false,
      notes: [],
    },
    ios: {
      listed: 0,
      downloaded: 0,
      failed: 1,
      excluded: 0,
      unparsed: 0,
      limited: false,
      listingComplete: false,
      notes: ["Permission denied"],
    },
  };
  assert.equal(reviewSchema.safeParse(r).success, true);
  r.firebaseCoverage.android.downloaded = 0;
  assert.equal(reviewSchema.safeParse(r).success, false);
});
