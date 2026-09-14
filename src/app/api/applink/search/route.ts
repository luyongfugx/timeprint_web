import { z } from "zod";

import { checkReadable, legacyDTO } from "@/lib/templates/access-service";
import { text, type TemplateRow } from "@/lib/templates/contracts";
import { rows } from "@/lib/templates/database";
import { body, endpoint, json } from "@/lib/templates/http";
import { requestLimit } from "@/lib/templates/routes";
import { candidates } from "@/lib/templates/search-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function OPTIONS(req: Request) {
  return endpoint(req, async () => new Response(null, { status: 204 }), true);
}
export async function POST(req: Request) {
  return endpoint(
    req,
    async () => {
      await requestLimit(req, "legacy-search");
      const input = await body(
        req,
        z
          .object({
            keyword: text(100).default(""),
            page: z.number().int().min(1).max(10000).default(1),
            limit: z.number().int().min(1).max(50).default(20),
          })
          .strict(),
      );
      const ids = (await candidates(input.keyword, !input.keyword, [])).slice(
        (input.page - 1) * input.limit,
        input.page * input.limit,
      );
      const data = ids.length
        ? await rows<TemplateRow>(
            `SELECT * FROM template_records WHERE id IN (${ids.map(() => "?").join(",")}) AND visibility='public' AND discovery_state='eligible'`,
            ids,
          )
        : [];
      const results = ids.flatMap((id) => {
        const t = data.find((r) => r.id === id);
        if (!t || !t.cover_asset_id) return [];
        try {
          checkReadable(t);
          return [legacyDTO(t)];
        } catch {
          return [];
        }
      });
      return json({ results, page: input.page, perPage: input.limit });
    },
    true,
  );
}
