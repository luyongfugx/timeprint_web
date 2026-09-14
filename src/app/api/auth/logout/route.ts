import { assertOrigin, digest, sessionCookie, tokenFromRequest } from "@/lib/auth/session";
import { database } from "@/lib/prisma";
import { endpoint, json } from "@/lib/templates/http";

export const runtime = "nodejs";
export async function POST(req: Request) {
  return endpoint(
    req,
    async () => {
      assertOrigin(req);
      const token = tokenFromRequest(req);
      if (token) await database().admin_sessions.deleteMany({ where: { token_hash: digest(token) } });
      const response = json({ success: true });
      response.headers.set("Set-Cookie", sessionCookie("", 0));
      return response;
    },
    false,
    true,
  );
}
