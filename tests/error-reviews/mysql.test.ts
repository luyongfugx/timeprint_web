import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test, before, after } from "node:test";

import { databaseURL } from "../../scripts/lib/database-config.mjs";
import { POST, GET, PATCH } from "../../src/app/api/admin/error-reviews/[[...path]]/route";
import { saveReview, getReview, issueHistory, updateIssue } from "../../src/lib/error-reviews/service";
import { database } from "../../src/lib/prisma";

import { fixture } from "./fixtures";

const active = process.env.ERROR_REVIEW_MYSQL_TEST === "true";
if (active && (new URL(databaseURL()).hostname !== "127.0.0.1" || !new URL(databaseURL()).pathname.endsWith("_test")))
  throw new Error("Use a disposable localhost *_test database");
before(async () => {
  if (!active) return;
  for (const file of ["002_admin_login.sql", "006_error_reviews.sql"]) {
    const sql = await readFile(new URL(`../../mysql/migrations/${file}`, import.meta.url), "utf8");
    for (const statement of sql
      .replace(/^--.*$/gm, "")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean))
      await database().$executeRawUnsafe(statement);
  }
});
after(async () => {
  if (active) await database().$disconnect();
});
test(
  "durable reviews: replay, concurrent import, immutable revisions, workflow audit and optimistic locking",
  { skip: !active },
  async () => {
    const r = fixture();
    const results = await Promise.all(Array.from({ length: 4 }, () => saveReview(r, "test")));
    assert.equal(results.filter((x) => !x.replay).length, 1);
    assert.equal((await getReview(r.runId)).report.runId, r.runId);
    await assert.rejects(() => saveReview({ ...r, summary: "changed" }, "test"));
    const id = r.findings[0].fingerprint;
    const patch = {
      version: 1,
      status: "investigating" as const,
      owner: "tester",
      fixVersion: "",
      fixLink: "",
      note: "Investigating with evidence",
    };
    await updateIssue(id, patch, "admin-test");
    await assert.rejects(() => updateIssue(id, patch, "admin-test"));
    await saveReview({ ...r, runId: randomUUID() }, "test");
    const history = await issueHistory(id);
    assert.equal(history.issue.status, "investigating");
    assert.equal(history.issue.owner, "tester");
    assert.equal(history.actions.length, 1);
    assert.equal(history.sightings.length, 2);
    await assert.rejects(() =>
      updateIssue(id, { ...patch, version: 2, status: "closed", fixVersion: "4.3" }, "admin-test"),
    );
  },
);
test(
  "API rejects invalid credentials and audits token workflow updates with optimistic locking",
  { skip: !active },
  async () => {
    process.env.ERROR_REVIEW_API_TOKEN = "test-service-token-with-at-least-32-characters";
    const context = { params: Promise.resolve({ path: [] as string[] }) };
    const url = "http://localhost/api/admin/error-reviews";
    assert.equal((await GET(new Request(url), context)).status, 401);
    assert.equal((await GET(new Request(url, { headers: { authorization: "Bearer wrong" } }), context)).status, 401);
    const headers = {
      authorization: `Bearer ${process.env.ERROR_REVIEW_API_TOKEN}`,
      "content-type": "application/json",
      "x-review-git-operator": encodeURIComponent(JSON.stringify({ name: "测试开发者", email: "dev@example.test" })),
    };
    const report = fixture();
    assert.equal(
      (await POST(new Request(url, { method: "POST", headers, body: JSON.stringify(report) }), context)).status,
      201,
    );
    assert.equal((await GET(new Request(url, { headers }), context)).status, 200);
    const patchContext = { params: Promise.resolve({ path: ["issues", report.findings[0].fingerprint] }) };
    assert.equal((await PATCH(new Request(url, { method: "PATCH", headers, body: "{}" }), patchContext)).status, 400);
    const change = {
      version: 1,
      status: "investigating",
      owner: "Codex",
      fixVersion: "",
      fixLink: "",
      note: "Review evidence, begin diagnosis",
    };
    const send = (authorization: string) =>
      PATCH(
        new Request(url, { method: "PATCH", headers: { ...headers, authorization }, body: JSON.stringify(change) }),
        patchContext,
      );
    assert.equal((await send("Bearer invalid")).status, 401);
    assert.equal((await send(headers.authorization)).status, 200);
    assert.equal((await send(headers.authorization)).status, 409);
    const history = await issueHistory(report.findings[0].fingerprint);
    assert.equal(history.issue.status, "investigating");
    assert.equal(history.actions[0].note, change.note);
    assert.equal(history.actions[0].actor, "git:测试开发者 <dev@example.test>");
  },
);
