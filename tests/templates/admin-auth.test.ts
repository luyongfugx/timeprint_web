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

test("admin: Chinese and emoji search work with ASCII share codes and ignore locale", { skip: !active }, async () => {
  const { adminRoute } = await import("../../src/lib/templates/admin-routes");
  const { cookie } = await signIn();
  const [column] = await database().$queryRawUnsafe<{ DATA_TYPE: string }[]>(
    "SELECT DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='watermarks_share_links' AND COLUMN_NAME='id'",
  );
  const templateID = column.DATA_TYPE === "char" ? randomUUID() : String(Date.now());
  const code = randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
  const name = `哈😀-${randomUUID()}`;
  await database().$executeRawUnsafe(
    "INSERT INTO watermarks_share_links(id,watermark_name,company_name,cover_image_url,json_download_url,share_code) VALUES (?,?,?,'https://example.invalid/cover','https://example.invalid/payload',?)",
    templateID,
    name,
    "中文公司",
    code,
  );
  try {
    for (const query of [name, "中文公司", code]) {
      const responses = [];
      for (const suffix of ["", "&locale=en", "&locale=zh-Hans"]) {
        const response = await adminRoute(
          new Request(`${origin}/api/admin/templates?page=1&pageSize=20&query=${encodeURIComponent(query)}${suffix}`, {
            headers: { cookie },
          }),
          [],
        );
        assert.equal(response.status, 200);
        const result = await response.json();
        assert.ok(result.results.some((row: { id: string }) => row.id === templateID));
        responses.push(result);
      }
      assert.deepEqual(responses[0], responses[1]);
      assert.deepEqual(responses[0], responses[2]);
    }
  } finally {
    await database().$executeRawUnsafe("DELETE FROM watermarks_share_links WHERE id=?", templateID);
  }
});

test(
  "admin: reports include reviewable watermark metadata without private internal fields",
  { skip: !active },
  async () => {
    const { adminRoute } = await import("../../src/lib/templates/admin-routes");
    const { cookie } = await signIn();
    const templateID = randomUUID(),
      reportID = randomUUID();
    const code = randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
    await database().$executeRawUnsafe(
      "INSERT INTO watermarks_share_links(id,watermark_name,company_name,cover_image_url,json_download_url,share_code,status) VALUES (?,?,?,'https://example.invalid/cover','https://example.invalid/payload',?,-1)",
      templateID,
      "被举报水印",
      "示例创建者",
      code,
    );
    try {
      await database().$executeRawUnsafe(
        "INSERT INTO template_reports(id,template_id,actor_hash,client_request_id,request_hash,reason,source) VALUES (?,?,?,?,?,'intellectual_property','template_detail')",
        reportID,
        templateID,
        "a".repeat(64),
        randomUUID(),
        "b".repeat(64),
      );
      const url = `${origin}/api/admin/templates/reports?pageSize=100`;
      assert.equal((await adminRoute(new Request(url), ["reports"])).status, 401);
      for (const status of [-1, -2]) {
        await database().$executeRawUnsafe("UPDATE watermarks_share_links SET status=? WHERE id=?", status, templateID);
        const response = await adminRoute(new Request(url, { headers: { cookie } }), ["reports"]);
        assert.equal(response.status, 200);
        const result = await response.json();
        const report = result.results.find((row: { id: string }) => row.id === reportID);
        assert.equal(report.reason, "intellectual_property");
        assert.equal(report.source, "template_detail");
        assert.equal(report.template.id, templateID);
        assert.equal(report.template.watermark_name, "被举报水印");
        assert.equal(report.template.company_name, "示例创建者");
        assert.equal(report.template.share_code, code);
        assert.equal(report.template.status, status);
        assert.equal(report.template.coverPreviewURL, `/api/admin/templates/${templateID}/cover`);
        assert.equal(report.template.payloadDownloadURL, `/api/admin/templates/${templateID}/payload`);
        assert.equal("actor_hash" in report, false);
        assert.equal("cover_image_url" in report.template, false);
      }
    } finally {
      await database().$executeRawUnsafe("DELETE FROM template_reports WHERE id=?", reportID);
      await database().$executeRawUnsafe("DELETE FROM watermarks_share_links WHERE id=?", templateID);
    }
  },
);
