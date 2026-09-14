import { type TemplateRow } from "./contracts";
import { TemplateError } from "./errors";

export function normalizeCode(value: string) {
  const code = value.replace(/\s/g, "").replace(/[a-z]/g, (v) => v.toUpperCase());
  if (!/^[A-Z0-9]{6,10}$/.test(code) || ![6, 8, 10].includes(code.length))
    throw new TemplateError("INVALID_CODE", 400, "This share code is invalid.");
  return code;
}
export function checkReadable(t: TemplateRow, code?: string | null, now = Date.now()) {
  if (t.visibility !== "public" && (!code || normalizeCode(code) !== t.share_code.toUpperCase()))
    throw new TemplateError("TEMPLATE_NOT_FOUND", 404, "Template not found.");
  if (t.status !== 0 || t.removed_at)
    throw new TemplateError("TEMPLATE_REMOVED", 410, "This template is no longer available.");
  const expiry =
    t.contract_version === 1
      ? Number(t.expire_time) > 0
        ? Number(t.expire_time) * 1000
        : null
      : t.expires_at
        ? Date.parse(t.expires_at)
        : null;
  if (expiry !== null && expiry <= now)
    throw new TemplateError("TEMPLATE_EXPIRED", 410, "This template link has expired.");
}
