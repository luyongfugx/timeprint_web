import { createHash, createHmac } from "node:crypto";

import type { z } from "zod";

import { reviewWindow, type evidenceSchema } from "./contracts";

export type Evidence = z.infer<typeof evidenceSchema>;
export type LogObject = { key: string; size: number; modified: string; platform: "android" | "ios" };
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
export function redact(input: string) {
  return input
    .replace(/https?:\/\/[^\s"<>]+/gi, "[url]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "[id]")
    .replace(
      /((?:token|secret|password|authorization|latitude|longitude|lat|lng|device_id|user_id)\s*[:=]\s*)[^\s,;]+/gi,
      "$1[redacted]",
    );
}
const allowedDiagnostics = new Set([
  "activity_route",
  "camera_state",
  "preview_stream_state",
  "available_camera_count",
  "recovery_attempt",
  "recovery_action",
  "recovery_flow_id",
  "bind_generation",
  "lens_facing",
  "capture_mode",
  "frame_received",
  "lifecycle",
  "gl_visible",
  "safe_stream_config",
  "provider_reset_used",
  "provider_reset_pending",
  "provider_reset_timed_out",
  "preview_view_size",
]);
export function normalizeLog(
  object: LogObject,
  body: string,
  date: string,
  hashKey: string,
): { evidence: Evidence | null; unparsed: boolean } {
  let raw: Record<string, unknown> = {};
  let unparsed = false;
  try {
    const parsed = JSON.parse(body);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error();
    raw = parsed;
  } catch {
    unparsed = true;
  }
  const get = (key: string, fallback = "") =>
    typeof raw[key] === "string" || typeof raw[key] === "number" ? String(raw[key]) : fallback;
  const created = Number(raw.created_at_ms);
  const event = Number.isFinite(created) && created > 0 ? new Date(created) : null;
  const occurred = event && Number.isFinite(event.getTime()) ? event : new Date(object.modified);
  const { start, end } = reviewWindow(date);
  if (
    !Number.isFinite(occurred.getTime()) ||
    occurred.getTime() < Date.parse(start) ||
    occurred.getTime() >= Date.parse(end)
  )
    return { evidence: null, unparsed };
  const errorCode = get("error_code", unparsed ? "legacy_text" : "unknown_error").slice(0, 180);
  const stack = redact(get("stack_trace")).slice(0, 6000);
  const summary = redact(get("exception_message", get("error_note", unparsed ? body : errorCode))).slice(0, 1200);
  const diagnosticSource =
    typeof raw.diagnostics === "object" && raw.diagnostics !== null ? (raw.diagnostics as Record<string, unknown>) : {};
  const diagnostics: Evidence["diagnostics"] = {};
  for (const [k, v] of Object.entries(diagnosticSource))
    if (allowedDiagnostics.has(k)) {
      if (typeof v === "string") diagnostics[k] = redact(v).slice(0, 300);
      else if ((typeof v === "number" && Number.isFinite(v)) || typeof v === "boolean" || v === null)
        diagnostics[k] = v;
    }
  const stableStack = stack
    .replace(/:\d+/g, ":#")
    .replace(/0x[0-9a-f]+/gi, "0x#")
    .slice(0, 800);
  const legacyKind =
    object.key
      .split("/")
      .pop()
      ?.replace(/\d{4,}.*$/, "")
      .slice(0, 100) ?? "legacy";
  const fingerprint = sha(
    [
      "v1",
      object.platform,
      get("business"),
      get("stage"),
      errorCode,
      get("exception_type"),
      get("error_fingerprint", unparsed ? legacyKind : stableStack),
    ].join("|"),
  );
  const privateHash = (value: string) =>
    value ? createHmac("sha256", hashKey).update(`${object.platform}|${value}`).digest("hex") : null;
  return {
    unparsed,
    evidence: {
      id: sha(`${object.platform}|${get("error_id", object.key)}`),
      platform: object.platform,
      fingerprint,
      objectKey: object.key,
      at: occurred.toISOString(),
      timeBasis: event ? "event" : "upload",
      errorCode,
      version: get("app_version", "unknown").slice(0, 80),
      model: get("device_model", get("device_model_identifier", "unknown")).slice(0, 120),
      os: get("android_release", get("os_version", get("ios_version", "unknown"))).slice(0, 80),
      deviceHash: privateHash(get("feedback_user_id", get("installation_hash", get("device_id")))),
      sessionHash: privateHash(get("session_id")),
      severity: get("severity", "unknown").slice(0, 32),
      summary,
      stack,
      diagnostics,
    },
  };
}
/** Deterministic round-robin strata prevents one noisy filename/version consuming every sample. */
export function stratifiedObjects(objects: LogObject[]) {
  const strata = new Map<string, LogObject[]>();
  for (const o of objects) {
    const kind = o.key.split("/").pop()?.split("_").slice(0, 4).join("_") ?? "unknown";
    const key = `${o.platform}|${kind}`;
    const list = strata.get(key) ?? [];
    list.push(o);
    strata.set(key, list);
  }
  const lists = [...strata.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v.sort((a, b) => sha(a.key).localeCompare(sha(b.key))));
  const out: LogObject[] = [];
  for (let i = 0; lists.some((l) => i < l.length); i++) for (const list of lists) if (list[i]) out.push(list[i]);
  return out;
}
