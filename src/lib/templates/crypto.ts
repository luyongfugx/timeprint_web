import { createHash, createHmac, randomInt, timingSafeEqual } from "node:crypto";

import { secret } from "./config";

export const sha256 = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
export const actorHash = (value: string) =>
  createHmac("sha256", secret("TEMPLATE_ACTOR_HMAC_KEY")).update(value).digest("hex");
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export function equalSecret(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function shareCode() {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  // Reject single-category codes so automatic search always recognizes the code.
  // Sampling the whole code preserves a uniform distribution over valid codes.
  let code: string;
  do {
    code = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join("");
  } while (!/[A-Z]/.test(code) || !/[2-9]/.test(code));
  return code;
}
