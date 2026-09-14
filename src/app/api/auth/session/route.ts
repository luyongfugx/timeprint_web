import { readSession, tokenFromRequest } from "@/lib/auth/session";
import { endpoint, json } from "@/lib/templates/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  return endpoint(req, async () => json({ user: await readSession(tokenFromRequest(req)) }), false, true);
}
