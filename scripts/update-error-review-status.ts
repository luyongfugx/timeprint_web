import { readFile } from "node:fs/promises";

import { z } from "zod";

import { updateSchema } from "../src/lib/error-reviews/contracts";

import { gitOperatorFromArgs } from "./lib/review-git-operator";

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Usage: error-reviews:status -- change.json [--validate]");
  const bytes = await readFile(file);
  if (bytes.length > 8192) throw new Error("Status payload exceeds 8 KiB");
  const parsed = z
    .object({ issueId: z.string().regex(/^[a-f0-9]{64}$/), change: updateSchema })
    .strict()
    .parse(JSON.parse(bytes.toString("utf8")));
  const { issueId, change } = parsed;
  if (process.argv.includes("--validate")) {
    console.log("Status payload validated");
    return;
  }
  const operator = gitOperatorFromArgs();
  const origin = process.env.ERROR_REVIEW_WEB_ORIGIN;
  const token = process.env.ERROR_REVIEW_API_TOKEN;
  if (!origin || !token || token.length < 32) throw new Error("Configure review origin and API token");
  const url = new URL(`/api/admin/error-reviews/issues/${issueId}`, origin);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))
    throw new Error("Use HTTPS except localhost");
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...operator.headers };
  const get = async () => {
    const res = await fetch(url, { headers, redirect: "error", signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`Read issue failed (${res.status})`);
    return res.json();
  };
  const before = await get();
  if (before.issue.version !== change.version)
    throw new Error("Version conflict; reread history and reassess, do not overwrite");
  const res = await fetch(url, {
    method: "PATCH",
    headers,
    body: JSON.stringify(change),
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Status update failed (${res.status}); reread history before any retry`);
  const after = await get();
  if (
    after.issue.version !== change.version + 1 ||
    after.issue.status !== change.status ||
    !after.actions.some(
      (a: { note: string; actor: string; after_state: { version: number } }) =>
        a.note === change.note && a.actor === operator.actor && a.after_state.version === change.version + 1,
    )
  )
    throw new Error("Update sent but readback differs; inspect history before retrying");
  console.log(JSON.stringify({ issueId, status: after.issue.status, version: after.issue.version, verified: true }));
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Status update failed");
  process.exitCode = 1;
});
