import "server-only";
import { createHash, randomBytes } from "node:crypto";

import { cookies } from "next/headers";

import { database } from "../prisma";
import { TemplateError } from "../templates/errors";

export const SESSION_COOKIE = "timeprint_admin_session";
export const SESSION_SECONDS = 12 * 60 * 60;
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export const publicUser = (account: { id: string; email: string; role: string }) => ({
  id: account.id,
  email: account.email,
  role: account.role,
});
export function assertOrigin(req: Request) {
  const expected =
    process.env.TEMPLATE_ADMIN_ORIGIN ??
    (process.env.NODE_ENV === "production" ? "https://team.timeprint.net" : new URL(req.url).origin);
  if (req.headers.get("origin") !== expected) throw new TemplateError("FORBIDDEN", 403, "请求来源无效");
}
export function tokenFromRequest(req: Request) {
  return req.headers
    .get("cookie")
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
}
export async function readSession(token?: string) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const session = await database().admin_sessions.findUnique({
    where: { token_hash: digest(token) },
    include: { account: true },
  });
  if (
    !session ||
    session.expires_at <= new Date() ||
    !session.account.enabled ||
    session.password_version !== digest(session.account.password_hash)
  )
    return null;
  return publicUser(session.account);
}
export async function currentUser() {
  return readSession((await cookies()).get(SESSION_COOKIE)?.value);
}
export async function createSession(account: { id: string; password_hash: string }, oldToken?: string) {
  const token = randomBytes(32).toString("hex");
  await database().$transaction(async (tx) => {
    if (oldToken) await tx.admin_sessions.deleteMany({ where: { token_hash: digest(oldToken) } });
    await tx.admin_sessions.deleteMany({ where: { admin_id: account.id, expires_at: { lte: new Date() } } });
    await tx.admin_sessions.create({
      data: {
        token_hash: digest(token),
        admin_id: account.id,
        password_version: digest(account.password_hash),
        expires_at: new Date(Date.now() + SESSION_SECONDS * 1000),
      },
    });
  });
  return token;
}
export function sessionCookie(token: string, maxAge = SESSION_SECONDS) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}
