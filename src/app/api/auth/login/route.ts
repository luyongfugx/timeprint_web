import { z } from "zod";

import { assertOrigin, createSession, digest, publicUser, sessionCookie, tokenFromRequest } from "@/lib/auth/session";
import { database } from "@/lib/prisma";
import { TemplateError } from "@/lib/templates/errors";
import { body, endpoint, json } from "@/lib/templates/http";
import { rateLimit } from "@/lib/templates/repository";

import { verifyPassword } from "../../../../../scripts/lib/password.mjs";

export const runtime = "nodejs";
const schema = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((s) => s.toLowerCase()),
    password: z.string().min(1).max(256),
  })
  .strict();
const dummyHash = `scrypt$32768$8$3$${"0".repeat(32)}$${"0".repeat(128)}`;
export async function POST(req: Request) {
  return endpoint(
    req,
    async () => {
      assertOrigin(req);
      const input = await body(req, schema);
      await rateLimit(digest("admin-login-global"), "admin-login", 200, 900);
      await rateLimit(digest(`admin-login:${input.email}`), "admin-login", 10, 900);
      const account = await database().admin_accounts.findUnique({ where: { email: input.email } });
      const valid = await verifyPassword(input.password, account?.password_hash ?? dummyHash);
      if (!account?.enabled || !valid) throw new TemplateError("INVALID_CREDENTIALS", 401, "邮箱或密码错误");
      const token = await createSession(account, tokenFromRequest(req));
      const response = json({ user: publicUser(account) });
      response.headers.set("Set-Cookie", sessionCookie(token));
      return response;
    },
    false,
    true,
  );
}
