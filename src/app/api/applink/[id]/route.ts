import { z } from "zod";

import { normalizeCode } from "@/lib/templates/access-policy";
import { byCode, legacyDownloadDTO } from "@/lib/templates/access-service";
import { adminAuth } from "@/lib/templates/admin-auth";
import { type TemplateRow } from "@/lib/templates/contracts";
import { transaction, rows } from "@/lib/templates/database";
import { TemplateError } from "@/lib/templates/errors";
import { endpoint, body, json } from "@/lib/templates/http";
import { requestLimit } from "@/lib/templates/routes";
import { moderateInTransaction } from "@/lib/templates/transactions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
type Context = { params: Promise<{ id: string }> };
export async function OPTIONS(req: Request) {
  return endpoint(req, async () => new Response(null, { status: 204 }), true);
}
export async function GET(req: Request, ctx: Context) {
  return endpoint(
    req,
    async () => {
      const code = normalizeCode((await ctx.params).id);
      const [, template] = await Promise.all([requestLimit(req, "legacy-code"), byCode(code)]);
      return json({ shareLink: await legacyDownloadDTO(template) });
    },
    true,
  );
}
async function manage(req: Request, ctx: Context) {
  return endpoint(
    req,
    async () => {
      const admin = await adminAuth(req);
      const code = normalizeCode((await ctx.params).id);
      const [t] = await rows<TemplateRow>("SELECT * FROM template_records WHERE UPPER(share_code)=?", [code]);
      if (!t) throw new TemplateError("TEMPLATE_NOT_FOUND", 404);
      // Published snapshots and expiry are immutable, including through the old API.
      const status =
        req.method === "DELETE"
          ? -1
          : (await body(req, z.object({ status: z.union([z.literal(0), z.literal(-1)]) }).strict())).status;
      const result = await transaction((c) =>
        moderateInTransaction(
          c,
          t.id,
          admin,
          status === -1 ? "remove" : "restore",
          "Legacy administrator action",
          t.updated_at,
        ),
      );
      return json({ success: true, updated: result });
    },
    true,
    true,
  );
}
export const PUT = manage;
export const DELETE = manage;
