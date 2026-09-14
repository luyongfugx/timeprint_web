import { databaseConfigured } from "../../../scripts/lib/database-config.mjs";

import { unavailable } from "./errors";

export function secret(name: string) {
  const value = process.env[name];
  if (!value || value.length < 32) unavailable();
  return value;
}
function origin(name: string, fallback: string) {
  const u = new URL(process.env[name] ?? fallback);
  if (u.protocol !== "https:" || u.username || u.password || u.port || u.pathname !== "/" || u.search || u.hash)
    unavailable();
  return u.origin;
}
export const apiOrigin = () => origin("TEMPLATE_API_ORIGIN", "https://team.timeprint.net");
export const shareOrigin = () => origin("TEMPLATE_SHARE_ORIGIN", "https://share.timeprint.net");
export const apiBase = () => `${apiOrigin()}/api/applink/v2`;
export const bucketName = () => process.env.TEMPLATE_ASSETS_BUCKET ?? "template-assets-v2";
export const enabled = (name: string) => process.env[`TEMPLATE_${name}_ENABLED`] === "true";
export const configured = () =>
  !!(
    databaseConfigured() &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    (process.env.TEMPLATE_ACTOR_HMAC_KEY?.length ?? 0) >= 32 &&
    (process.env.TEMPLATE_CURSOR_SIGNING_KEY?.length ?? 0) >= 32
  );
