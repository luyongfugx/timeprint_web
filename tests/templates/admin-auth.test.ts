import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test, before, after } from "node:test";

import { databaseURL } from "../../scripts/lib/database-config.mjs";
import { hashPassword, verifyPassword } from "../../scripts/lib/password.mjs";
import { POST as login } from "../../src/app/api/auth/login/route";
import { POST as logout } from "../../src/app/api/auth/logout/route";
import { GET as session } from "../../src/app/api/auth/session/route";
import { assertOrigin, digest, readSession, sessionCookie } from "../../src/lib/auth/session";
import { database } from "../../src/lib/prisma";
import { adminAuth } from "../../src/lib/templates/admin-auth";

const active = process.env.TEMPLATE_MYSQL_TEST === "true";
if (active && (new URL(databaseURL()).hostname !== "127.0.0.1" || !new URL(databaseURL()).pathname.endsWith("_test")))
  throw new Error("Authentication tests require a disposable local *_test database.");
const origin = "https://admin.test.invalid";
process.env.TEMPLATE_ADMIN_ORIGIN = origin;
const id = randomUUID();
const email = `${id}@example.com`;
const password = "local-auth-test-password";
function request(path: string, body?: unknown, cookie?: string, from = origin) {
  return new Request(`${origin}/api/auth/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { origin: from, "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function signIn() {
  const response = await login(request("login", { email: email.toUpperCase(), password }));
  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie")!;
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  return { response, cookie: cookie.split(";")[0], token: cookie.split(";")[0].split("=")[1] };
}
before(async () => {
  if (!active) return;
  await database().admin_accounts.create({ data: { id, email, password_hash: await hashPassword(password) } });
});
after(async () => {
  if (active) {
    await database().admin_accounts.delete({ where: { id } });
    await database().$disconnect();
  }
});
test("admin: scrypt verifies passwords without plaintext storage", async () => {
  const hash = await hashPassword(password);
  assert.ok(!hash.includes(password));
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword("wrong", hash), false);
  assert.equal(await verifyPassword(password, "malformed"), false);
});
test("admin: production supports both admin domains and rejects foreign or missing origins", () => {
  const previousOrigin = process.env.TEMPLATE_ADMIN_ORIGIN;
  const previousMode = process.env.NODE_ENV;
  try {
    Object.assign(process.env, { NODE_ENV: "production" });
    delete process.env.TEMPLATE_ADMIN_ORIGIN;
    assert.doesNotThrow(() => assertOrigin(request("login", {}, undefined, "https://wm.timeprint.net")));
    assert.doesNotThrow(() => assertOrigin(request("login", {}, undefined, "https://team.timeprint.net")));
    assert.throws(() => assertOrigin(request("login", {}, undefined, "https://evil.invalid")), { code: "FORBIDDEN" });
    assert.throws(() => assertOrigin(new Request("https://wm.timeprint.net/api/auth/login")), { code: "FORBIDDEN" });
    process.env.TEMPLATE_ADMIN_ORIGIN = " https://wm.timeprint.net/ , https://team.timeprint.net/ ";
    assert.doesNotThrow(() => assertOrigin(request("login", {}, undefined, "https://wm.timeprint.net")));
    assert.doesNotThrow(() => assertOrigin(request("login", {}, undefined, "https://team.timeprint.net")));
    assert.throws(() => assertOrigin(request("login", {}, undefined, "https://wm.timeprint.net.evil.invalid")), {
      code: "FORBIDDEN",
    });
    process.env.TEMPLATE_ADMIN_ORIGIN = origin;
    assert.throws(() => assertOrigin(request("login", {}, undefined, "https://wm.timeprint.net")), {
      code: "FORBIDDEN",
    });
  } finally {
    if (previousOrigin === undefined) delete process.env.TEMPLATE_ADMIN_ORIGIN;
    else process.env.TEMPLATE_ADMIN_ORIGIN = previousOrigin;
    if (previousMode === undefined) Reflect.deleteProperty(process.env, "NODE_ENV");
    else Object.assign(process.env, { NODE_ENV: previousMode });
  }
});
test("admin: login, normalized email, hashed session, logout and origin checks", { skip: !active }, async () => {
  assert.equal((await login(request("login", { email, password }, undefined, "https://evil.invalid"))).status, 403);
  const wrong = await login(request("login", { email, password: "wrong" }));
  assert.equal(wrong.status, 401);
  assert.equal((await login(request("login", { email: "missing@example.com", password: "wrong" }))).status, 401);
  const { response, cookie, token } = await signIn();
  assert.deepEqual(await response.json(), { user: { id, email, role: "admin" } });
  const stored = await database().admin_sessions.findUnique({ where: { token_hash: digest(token) } });
  assert.ok(stored);
  assert.notEqual(stored.token_hash, token);
  assert.equal(await adminAuth(request("session", undefined, cookie), true), id);
  assert.equal((await (await session(request("session", undefined, cookie))).json()).user.email, email);
  const out = await logout(request("logout", {}, cookie));
  assert.equal(out.status, 200);
  assert.match(out.headers.get("set-cookie")!, /Max-Age=0/);
  assert.equal(await readSession(token), null);
  assert.equal(await readSession("a".repeat(64)), null);
});
test(
  "admin: expired/disabled/password-changed sessions are rejected and moderator cannot administer",
  { skip: !active },
  async () => {
    const { cookie, token } = await signIn();
    await database().admin_accounts.update({ where: { id }, data: { role: "moderator" } });
    await assert.rejects(adminAuth(request("session", undefined, cookie), true), (e: any) => e.status === 403);
    assert.equal(await adminAuth(request("session", undefined, cookie)), id);
    await database().admin_accounts.update({ where: { id }, data: { enabled: false } });
    assert.equal(await readSession(token), null);
    await database().admin_accounts.update({ where: { id }, data: { enabled: true, role: "admin" } });
    await database().admin_sessions.update({ where: { token_hash: digest(token) }, data: { expires_at: new Date(0) } });
    assert.equal(await readSession(token), null);
    const fresh = await signIn();
    await database().admin_accounts.update({ where: { id }, data: { password_hash: await hashPassword(password) } });
    assert.equal(await readSession(fresh.token), null);
  },
);
test("admin: login attempts are throttled", { skip: !active }, async () => {
  const limitedEmail = `${randomUUID()}@example.com`;
  const key = digest(`admin-login:${limitedEmail}`);
  await database().template_rate_limits.create({
    data: {
      key,
      action: "admin-login",
      window_start: BigInt(Math.floor(Date.now() / 1000 / 900)),
      count: 10,
    },
  });
  assert.equal((await login(request("login", { email: limitedEmail, password }))).status, 429);
  await database().template_rate_limits.deleteMany({ where: { key } });
  const old = process.env.NODE_ENV;
  Object.assign(process.env, { NODE_ENV: "production" });
  assert.match(sessionCookie("a".repeat(64)), /; Secure/);
  if (old === undefined) Reflect.deleteProperty(process.env, "NODE_ENV");
  else Object.assign(process.env, { NODE_ENV: old });
});
