import { adminRoute } from "@/lib/templates/admin-routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
type Context = { params: Promise<{ path?: string[] }> };
async function handle(req: Request, context: Context) {
  return adminRoute(req, (await context.params).path ?? []);
}
export { handle as GET, handle as POST, handle as PATCH, handle as PUT, handle as DELETE };
