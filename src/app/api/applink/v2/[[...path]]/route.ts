import { v2Route } from "@/lib/templates/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
type Context = { params: Promise<{ path?: string[] }> };
async function handle(req: Request, context: Context) {
  return v2Route(req, (await context.params).path ?? []);
}
export { handle as GET, handle as POST, handle as PUT, handle as OPTIONS };
