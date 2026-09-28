import { createHash, createHmac } from "node:crypto";

import { z } from "zod";

import { redact } from "./collect";
import { reviewWindow, type Review } from "./contracts";

const frame = z.object({ symbol: z.string().optional(), file: z.string().optional(), line: z.string().optional() });
const trace = z.object({
  title: z.string().optional(),
  name: z.string().optional(),
  type: z.string().optional(),
  exceptionMessage: z.string().optional(),
  threadState: z.string().optional(),
  blamed: z.boolean().optional(),
  crashed: z.boolean().optional(),
  frames: z.array(frame).optional(),
});
const schema = z.object({
  name: z.string(),
  eventTime: z.string(),
  platform: z.string(),
  issue: z.object({
    id: z.string(),
    errorType: z.enum(["FATAL", "ANR"]),
    title: z.string().optional(),
    subtitle: z.string().optional(),
  }),
  installationUuid: z.string().optional(),
  sessionId: z.string().optional(),
  version: z.object({ displayName: z.string().optional() }).optional(),
  device: z.object({ displayName: z.string().optional() }).optional(),
  operatingSystem: z.object({ displayName: z.string().optional() }).optional(),
  threads: z.array(trace).optional(),
  exceptions: z.array(trace).optional(),
});
export function normalizeFirebaseEvent(
  input: unknown,
  platform: "android" | "ios",
  appResource: string,
  date: string,
  key: string,
): Review["evidence"][number] | null {
  const e = schema.parse(input);
  const window = reviewWindow(date);
  const at = Date.parse(e.eventTime);
  const configured = /^projects\/([\w-]+)\/apps\/(1:(\d+):(android|ios):[\w-]+)$/.exec(appResource);
  const actual = /^projects\/([\w-]+)\/apps\/(1:(\d+):(android|ios):[\w-]+)\/events\/[\w:-]+$/.exec(e.name);
  // Firebase may canonicalize a project ID to the project number embedded in its app ID.
  const matchesSource =
    configured &&
    actual &&
    actual[2] === configured[2] &&
    configured[4] === platform &&
    (actual[1] === configured[1] || actual[1] === configured[3]);
  if (e.platform.toLowerCase() !== platform || !matchesSource || !Number.isFinite(at))
    throw new Error("Firebase event source mismatch");
  if (at < Date.parse(window.start) || at >= Date.parse(window.end)) return null;
  const sha = (s: string) => createHash("sha256").update(s).digest("hex");
  const hmac = (s?: string) =>
    s ? createHmac("sha256", key).update(`firebase|${appResource}|${s}`).digest("hex") : null;
  const threads = [...(e.threads ?? [])].sort(
    (a, b) =>
      Number(Boolean(b.blamed === true || b.crashed === true || b.name === "main")) -
      Number(Boolean(a.blamed === true || a.crashed === true || a.name === "main")),
  );
  const traces = [...(e.exceptions ?? []), ...threads];
  const stack = traces
    .slice(0, 8)
    .map((t) =>
      [
        t.title ?? t.name ?? t.type ?? "thread",
        t.exceptionMessage ?? t.threadState ?? "",
        ...(t.frames ?? []).slice(0, 30).map((f) => `${f.symbol ?? "?"} (${f.file ?? "?"}:${f.line ?? "?"})`),
      ].join("\n"),
    )
    .join("\n\n");
  return {
    id: sha("firebase|" + e.name),
    source: "firebase",
    platform,
    fingerprint: sha(`firebase|${appResource}|${e.issue.id}`),
    objectKey: e.name,
    at: new Date(at).toISOString(),
    timeBasis: "event",
    errorCode: "firebase_" + e.issue.errorType.toLowerCase(),
    version: redact(e.version?.displayName ?? "unknown").slice(0, 80),
    model: redact(e.device?.displayName ?? "unknown").slice(0, 120),
    os: redact(e.operatingSystem?.displayName ?? "unknown").slice(0, 80),
    deviceHash: hmac(e.installationUuid),
    sessionHash: hmac(e.sessionId),
    severity: e.issue.errorType === "FATAL" ? "fatal" : "error",
    summary: redact([e.issue.title, e.issue.subtitle].filter(Boolean).join(": ")).slice(0, 1200),
    stack: redact(stack).slice(0, 6000),
    diagnostics: { firebase_issue_id: e.issue.id.slice(0, 300), error_type: e.issue.errorType },
  };
}
