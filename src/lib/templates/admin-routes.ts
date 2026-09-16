import "server-only";
import { randomUUID } from "node:crypto";

import sharp from "sharp";
import { z } from "zod";

import { readRow, checkReadable } from "./access-service";
import { adminAuth } from "./admin-auth";
import { getAsset, downloadObject } from "./asset-service";
import {
  createSchema,
  moderationSchema,
  text,
  MAX_IMAGE_BYTES,
  MAX_PAYLOAD_BYTES,
  identifier,
  type TemplateRow,
} from "./contracts";
import { rows, write, transaction } from "./database";
import { TemplateError } from "./errors";
import { endpoint, json, body, privateHeaders } from "./http";
import { fetchLegacy, legacyURL, snapshotForLegacyApproval } from "./legacy-assets";
import { publish } from "./publish-service";
import {
  editTemplateMetadata,
  deleteTemplate,
  moderateInTransaction,
  resolveReport,
  resolveRequest,
  attachLegacy,
} from "./transactions";
import { normalizeTrendingRegion } from "./trending-regions";

export async function adminRoute(req: Request, path: string[]) {
  return endpoint(
    req,
    async () => {
      const admin = await adminAuth(
        req,
        req.method === "DELETE" ||
          (path[0] === "trending" && req.method === "PUT") ||
          path[1] === "approve-legacy-public",
      );
      if (req.method === "POST" && !path.length) {
        const result = await publish(req, await body(req, createSchema));
        return json(result.receipt, result.replay ? 200 : 201);
      }
      const q = new URL(req.url).searchParams;
      const page = z.coerce
        .number()
        .int()
        .min(1)
        .max(10000)
        .safeParse(q.get("page") ?? 1);
      if (!page.success) throw new TemplateError("INVALID_REQUEST");
      const pageSize = z.coerce
        .number()
        .int()
        .min(1)
        .max(100)
        .safeParse(q.get("pageSize") ?? 20);
      if (!pageSize.success) throw new TemplateError("INVALID_REQUEST");
      const offset = (page.data - 1) * pageSize.data;
      if (req.method === "GET" && !path.length) {
        const kw = text(100).safeParse(q.get("query") ?? "");
        if (!kw.success) throw new TemplateError("INVALID_REQUEST");
        const values: unknown[] = [kw.data, kw.data, kw.data, kw.data];
        let filter = " AND status<>-2";
        if (q.has("visibility")) {
          const v = z.enum(["public", "private", "legacy"]).safeParse(q.get("visibility"));
          if (!v.success) throw new TemplateError("INVALID_REQUEST");
          filter += v.data === "legacy" ? " AND visibility IS NULL" : " AND visibility=?";
          if (v.data !== "legacy") values.push(v.data);
        }
        if (q.has("status")) {
          const status = z.enum(["0", "-1"]).safeParse(q.get("status"));
          if (!status.success) throw new TemplateError("INVALID_REQUEST");
          filter += " AND status=?";
          values.push(Number(status.data));
        }
        if (q.has("expired")) {
          const expiry = z.enum(["true", "false"]).safeParse(q.get("expired"));
          if (!expiry.success) throw new TemplateError("INVALID_REQUEST");
          filter +=
            " AND (CASE WHEN contract_version=1 THEN expire_time>0 AND expire_time<=UNIX_TIMESTAMP() ELSE COALESCE(expires_at<=UTC_TIMESTAMP(3),FALSE) END)=?";
          values.push(expiry.data === "true");
        }
        const where = `WHERE (?='' OR LOCATE(LOWER(?),LOWER(watermark_name))>0 OR LOCATE(LOWER(?),LOWER(COALESCE(company_name,'')))>0 OR UPPER(CONVERT(share_code USING utf8mb4))=UPPER(?)) ${filter}`;
        const [count] = await rows<{ total: string }>(
          `SELECT COUNT(*) AS total FROM template_records ${where}`,
          values,
        );
        const results = await rows<TemplateRow>(
          `SELECT * FROM template_records ${where} ORDER BY created_at DESC,id DESC LIMIT ${pageSize.data} OFFSET ${offset}`,
          values,
        );
        // Source URLs and internal credentials are never serialized by admin lists.
        return json({
          results: results.map(({ cover_image_url: _cover, json_download_url: _payload, ...t }) => ({
            ...t,
            coverPreviewURL: `/api/admin/templates/${encodeURIComponent(t.id)}/cover`,
            payloadDownloadURL: `/api/admin/templates/${encodeURIComponent(t.id)}/payload`,
          })),
          page: page.data,
          pageSize: pageSize.data,
          total: Number(count.total),
        });
      }
      // Admin review can inspect removed/expired shares without publishing them.
      if (req.method === "GET" && path.length === 2 && ["cover", "payload"].includes(path[1])) {
        if (!identifier.safeParse(path[0]).success) throw new TemplateError("INVALID_REQUEST");
        const template = await readRow(path[0]);
        const kind = path[1] === "cover" ? "cover" : "payload";
        const assetID = kind === "cover" ? template.cover_asset_id : template.payload_asset_id;
        let bytes: Buffer;
        if (assetID) {
          const asset = await getAsset(assetID);
          if (asset.template_id !== template.id || asset.kind !== kind || asset.state !== "sealed" || !asset.sealed_key)
            throw new TemplateError("RESOURCE_INVALID", 422);
          bytes = await downloadObject(asset.sealed_key, kind === "cover" ? MAX_IMAGE_BYTES : MAX_PAYLOAD_BYTES);
        } else {
          if (template.contract_version !== 1) throw new TemplateError("RESOURCE_INVALID", 422);
          // Public legacy objects bypass server-side proxy DNS only after authentication
          // and exact host/path checks. Sealed private assets remain streamed above.
          const url = legacyURL(kind === "cover" ? template.cover_image_url : template.json_download_url, kind);
          if (kind === "cover" && !/\.(?:png|jpe?g|webp)$/i.test(url.pathname))
            throw new TemplateError("RESOURCE_INVALID", 422);
          if (kind === "cover")
            return new Response(null, { status: 302, headers: { ...privateHeaders, Location: url.href } });
          bytes = await fetchLegacy(url.href, "payload");
        }
        if (kind === "payload") {
          try {
            JSON.parse(bytes.toString("utf8"));
          } catch {
            throw new TemplateError("RESOURCE_INVALID", 422);
          }
          return new Response(new Uint8Array(bytes), {
            headers: {
              ...privateHeaders,
              "Content-Type": "application/json",
              "Content-Disposition": `attachment; filename="watermark-${template.id}.json"`,
            },
          });
        }
        try {
          let image = sharp(bytes, { limitInputPixels: 25_000_000 });
          if (q.get("variant") === "thumb")
            image = image.resize({ width: 480, height: 360, fit: "inside", withoutEnlargement: true });
          const output = await image.png().toBuffer();
          return new Response(new Uint8Array(output), { headers: { ...privateHeaders, "Content-Type": "image/png" } });
        } catch {
          throw new TemplateError("RESOURCE_INVALID", 422);
        }
      }
      if (path.length === 1 && ["PATCH", "DELETE"].includes(req.method)) {
        if (!identifier.safeParse(path[0]).success) throw new TemplateError("INVALID_REQUEST");
        const common = z.object({ reason: text(2000, 1), expectedUpdatedAt: z.string().datetime({ offset: true }) });
        if (req.method === "DELETE")
          return json(await deleteTemplate(path[0], admin, await body(req, common.strict())));
        const input = await body(req, common.extend({ watermarkName: text(255), companyName: text(100) }).strict());
        return json(await editTemplateMetadata(path[0], admin, input));
      }
      if (path.length === 2 && path[1] === "moderation" && req.method === "POST") {
        const input = await body(req, moderationSchema);
        return json(
          await transaction((c) =>
            moderateInTransaction(c, path[0], admin, input.action, input.reason, input.expectedUpdatedAt),
          ),
        );
      }
      if (path.length === 1 && path[0] === "reports" && req.method === "GET") {
        const [count] = await rows<{ total: string }>("SELECT COUNT(*) AS total FROM template_reports");
        const reports = await rows<Record<string, any>>(
          `SELECT r.id,CAST(r.template_id AS CHAR) AS template_id,r.reason,r.source,r.status,r.created_at,r.resolved_at,r.resolution,
            t.id AS watermark_id,t.watermark_name,t.company_name,t.share_code,t.status AS watermark_status,t.created_at AS watermark_created_at,
            t.contract_version,t.visibility,t.expire_time,t.expires_at,t.use_count
           FROM template_reports r LEFT JOIN template_records t ON t.id=r.template_id
           ORDER BY r.created_at DESC,r.id DESC LIMIT ${pageSize.data} OFFSET ${offset}`,
        );
        return json({
          results: reports.map(
            ({
              watermark_id,
              watermark_name,
              company_name,
              share_code,
              watermark_status,
              watermark_created_at,
              contract_version,
              visibility,
              expire_time,
              expires_at,
              use_count,
              ...report
            }) => ({
              ...report,
              template:
                watermark_id == null
                  ? null
                  : {
                      id: String(watermark_id),
                      watermark_name,
                      company_name,
                      share_code,
                      status: watermark_status,
                      created_at: watermark_created_at,
                      contract_version,
                      visibility,
                      expire_time,
                      expires_at,
                      use_count,
                      coverPreviewURL: `/api/admin/templates/${encodeURIComponent(watermark_id)}/cover`,
                      payloadDownloadURL: `/api/admin/templates/${encodeURIComponent(watermark_id)}/payload`,
                    },
            }),
          ),
          page: page.data,
          pageSize: pageSize.data,
          total: Number(count.total),
        });
      }
      if (path.length === 1 && path[0] === "requests" && req.method === "GET") {
        const table = "template_requests";
        const columns =
          "id,kind,CAST(template_id AS CHAR) AS template_id,submitted_code,company_name,description,contact,required_fields,attachment_ids,status,created_at,resolved_at,resolution";
        const [count] = await rows<{ total: string }>(`SELECT COUNT(*) AS total FROM ${table}`);
        return json({
          results: await rows(
            `SELECT ${columns} FROM ${table} ORDER BY created_at DESC,id DESC LIMIT ${pageSize.data} OFFSET ${offset}`,
          ),
          page: page.data,
          pageSize: pageSize.data,
          total: Number(count.total),
        });
      }
      if (path[0] === "reports" && path.length === 3 && path[2] === "resolve" && req.method === "POST") {
        const input = await body(req, z.object({ decision: z.enum(["remove", "keep"]), note: text(2000, 1) }).strict());
        return json(await resolveReport(path[1], admin, input.decision, input.note));
      }
      if (path[0] === "requests" && path.length === 2 && req.method === "PATCH") {
        const input = await body(
          req,
          z
            .object({
              status: z.enum(["in_review", "resolved", "rejected"]),
              note: text(2000, 1),
              decision: z.enum(["remove", "keep"]).optional(),
            })
            .strict(),
        );
        return json(await resolveRequest(path[1], admin, input));
      }
      if (path[0] === "request-assets" && path.length === 2 && req.method === "GET") {
        const asset = await getAsset(path[1]);
        if (!asset.request_id || asset.kind !== "evidence" || !asset.sealed_key || asset.state !== "sealed")
          throw new TemplateError("TEMPLATE_NOT_FOUND", 404);
        return new Response(await downloadObject(asset.sealed_key, 5_242_880), {
          headers: { ...privateHeaders, "Content-Type": asset.mime },
        });
      }
      if (path.join("/") === "trending") {
        const region = normalizeTrendingRegion(q.get("region") ?? "");
        if (!region) throw new TemplateError("INVALID_REQUEST");
        const locale = `region:${region}`;
        if (req.method === "GET")
          return json({
            terms: await rows("SELECT term,enabled FROM template_trending_terms WHERE locale=? ORDER BY sort_order", [
              locale,
            ]),
          });
        if (req.method === "PUT") {
          const input = await body(
            req,
            z.object({ terms: z.array(z.object({ term: text(100, 1), enabled: z.boolean() }).strict()) }).strict(),
          );
          if (new Set(input.terms.map((t) => t.term.toLowerCase())).size !== input.terms.length)
            throw new TemplateError("INVALID_REQUEST");
          await transaction(async (c) => {
            await write("DELETE FROM template_trending_terms WHERE locale=?", [locale], c);
            for (const [i, t] of input.terms.entries())
              await write(
                "INSERT INTO template_trending_terms(id,term,locale,sort_order,enabled) VALUES (?,?,?,?,?)",
                [randomUUID(), t.term, locale, i, t.enabled],
                c,
              );
            await write(
              "INSERT INTO template_moderation_actions(id,admin_user_id,action,reason) VALUES (?,?,'trending',?)",
              [randomUUID(), admin, locale],
              c,
            );
          });
          return json({ terms: input.terms });
        }
      }
      if (path.length === 2 && path[1] === "approve-legacy-public" && req.method === "POST") {
        const input = await body(
          req,
          z
            .object({
              dryRun: z.boolean(),
              reason: text(2000, 1),
              expectedUpdatedAt: z.string().datetime({ offset: true }),
            })
            .strict(),
        );
        const t = await readRow(path[0]);
        checkReadable(t, t.share_code);
        if (t.contract_version !== 1) throw new TemplateError("INVALID_REQUEST");
        const snapshot = await snapshotForLegacyApproval(t, admin);
        if (!input.dryRun)
          await attachLegacy(t.id, snapshot.uploadSessionID, input.expectedUpdatedAt, { admin, reason: input.reason });
        return json({ valid: true, dryRun: input.dryRun, templateID: t.id, preservesOriginalExpiry: true });
      }
      throw new TemplateError("TEMPLATE_NOT_FOUND", 404);
    },
    false,
    true,
  );
}
