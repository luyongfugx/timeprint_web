import { z } from "zod";

import { reviewAuth } from "@/lib/error-reviews/auth";
import { reviewWindow, statuses, updateSchema } from "@/lib/error-reviews/contracts";
import { saveReview, listReviews, getReview, listIssues, issueHistory, updateIssue } from "@/lib/error-reviews/service";
import { TemplateError } from "@/lib/templates/errors";
import { boundedBytes, json, endpoint } from "@/lib/templates/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
type Context = { params: Promise<{ path?: string[] }> };
async function handle(req: Request, context: Context) {
  return endpoint(
    req,
    async () => {
      const actor = await reviewAuth(req, req.method === "PATCH");
      const path = (await context.params).path ?? [];
      const q = new URL(req.url).searchParams;
      try {
        if (req.method === "GET" && !path.length) {
          const date = q.get("date") ?? undefined;
          if (date) {
            try {
              reviewWindow(date);
            } catch {
              throw new TemplateError("INVALID_REQUEST", 400, "日期无效");
            }
          }
          return json({ items: await listReviews(date) });
        }
        if (req.method === "GET" && path[0] === "issues" && path.length === 1) {
          const status = q.get("status") ? z.enum(statuses).parse(q.get("status")) : undefined;
          const platform = q.get("platform") ? z.enum(["android", "ios"]).parse(q.get("platform")) : undefined;
          const page = z.coerce
            .number()
            .int()
            .min(1)
            .max(10000)
            .parse(q.get("page") ?? 1);
          return json(await listIssues(status, platform, page));
        }
        if (path[0] === "issues" && path.length === 2) {
          const id = z
            .string()
            .regex(/^[a-f0-9]{64}$/)
            .parse(path[1]);
          if (req.method === "GET") return json(await issueHistory(id));
          if (req.method === "PATCH")
            return json(await updateIssue(id, updateSchema.parse(await readBody(req, 8192)), actor));
        }
        if (req.method === "GET" && path.length === 1) return json(await getReview(z.string().uuid().parse(path[0])));
        if (req.method === "POST" && !path.length) {
          const saved = await saveReview(await readBody(req, 2 * 1024 * 1024), actor);
          return json(saved, saved.replay ? 200 : 201);
        }
        throw new TemplateError("NOT_FOUND", 404, "接口不存在");
      } catch (e) {
        if (e instanceof z.ZodError)
          throw new TemplateError("INVALID_REQUEST", 400, e.issues[0]?.message ?? "数据无效");
        throw e;
      }
    },
    false,
    true,
  );
}
async function readBody(req: Request, max: number) {
  if (!req.headers.get("content-type")?.startsWith("application/json"))
    throw new TemplateError("INVALID_REQUEST", 400, "需要 JSON 数据");
  try {
    return JSON.parse((await boundedBytes(req.body, max)).toString("utf8"));
  } catch (e) {
    if (e instanceof TemplateError) throw e;
    throw new TemplateError("INVALID_REQUEST", 400, "JSON 格式无效");
  }
}
export { handle as GET, handle as POST, handle as PATCH };
