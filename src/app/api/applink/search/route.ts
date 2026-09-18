import { z } from "zod";

import { checkReadable, legacyDTO } from "@/lib/templates/access-service";
import { text, type TemplateRow } from "@/lib/templates/contracts";
import { rows } from "@/lib/templates/database";
import { body, endpoint, json } from "@/lib/templates/http";
import { legacyURL } from "@/lib/templates/legacy-assets";
import { requestLimit } from "@/lib/templates/routes";

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
            limit: z.number().int().min(1).max(500).default(20),
          })
          .strict(),
      );
      const offset = (input.page - 1) * input.limit;
      const data = await rows<TemplateRow>(
        `SELECT * FROM template_records WHERE status=0 AND removed_at IS NULL
         AND ((contract_version=1 AND visibility IS NULL) OR (visibility='public' AND discovery_state='eligible'))
         AND (CASE WHEN contract_version=1 THEN expire_time IS NULL OR expire_time=0 OR expire_time>UNIX_TIMESTAMP()
              ELSE expires_at IS NULL OR expires_at>UTC_TIMESTAMP(3) END)
         AND (?='' OR LOCATE(LOWER(?),LOWER(watermark_name))>0 OR LOCATE(LOWER(?),LOWER(COALESCE(company_name,'')))>0)
         ORDER BY created_at DESC,id DESC LIMIT ${input.limit} OFFSET ${offset}`,
        [input.keyword, input.keyword, input.keyword],
      );
      const results = [];
      for (const t of data) {
        try {
          checkReadable(t, t.share_code);
          if (t.contract_version === 1 && !t.cover_asset_id && !t.payload_asset_id) {
            // Preserve the old public catalog without admitting v2 private shares into search.
            results.push({
              id: t.id,
              watermark_name: t.watermark_name,
              company_name: t.company_name ?? "",
              cover_image_url: legacyURL(t.cover_image_url, "cover").href,
              json_download_url: legacyURL(t.json_download_url, "payload").href,
              status: t.status,
              created_at: t.created_at,
              share_code: t.share_code,
              expire_time: t.expire_time,
            });
            continue;
          }
          results.push(await legacyDTO(t));
        } catch {
          // Skip unreadable rows.
        }
      }
      return json({ results, page: input.page, perPage: input.limit });
    },
    true,
  );
}
