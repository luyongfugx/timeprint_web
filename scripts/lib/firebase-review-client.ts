import { createSign } from "node:crypto";
import { readFile } from "node:fs/promises";

export async function firebaseReviewClient(path = process.env.ERROR_REVIEW_FIREBASE_CREDENTIALS) {
  if (!path) throw new Error("Configure ERROR_REVIEW_FIREBASE_CREDENTIALS");
  const c = JSON.parse(await readFile(path, "utf8"));
  if (c.type !== "service_account" || !c.client_email || !c.private_key)
    throw new Error("Invalid service account file");
  const b = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const data =
    b({ alg: "RS256", typ: "JWT" }) +
    "." +
    b({
      iss: c.client_email,
      scope: "https://www.googleapis.com/auth/firebase",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    });
  const signature = createSign("RSA-SHA256").update(data).sign(c.private_key, "base64url");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    redirect: "error",
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: data + "." + signature,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`Firebase OAuth failed (${r.status})`);
  const t = await r.json();
  if (!t.access_token) throw new Error("Firebase token missing");
  return async (path: string, params: Record<string, string>) => {
    if (!/^projects\/[\w-]+\/apps\/[\w:-]+\/(events|reports\/topIssues)$/.test(path))
      throw new Error("Invalid read resource");
    const url = new URL("https://firebasecrashlytics.googleapis.com/v1alpha/" + path);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${t.access_token}` },
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      const reasons = e.error?.details
        ?.map((x: { reason?: string }) => x.reason)
        .filter((s: unknown) => typeof s === "string" && /^[A-Z_]+$/.test(s))
        .join(",");
      throw new Error(`Crashlytics HTTP ${res.status}${reasons ? " " + reasons : ""}`);
    }
    // Bound response memory. Custom logs, breadcrumbs and user fields are excluded with readMask.
    const reader = res.body?.getReader();
    if (!reader) throw new Error("Empty Firebase response");
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > 4 * 1024 * 1024) {
        await reader.cancel();
        throw new Error("Firebase response exceeds 4 MiB");
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  };
}
