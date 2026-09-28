import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

import { adminAuth } from "../templates/admin-auth";
import { TemplateError } from "../templates/errors";

export async function reviewAuth(req: Request, workflowMutation = false) {
  const supplied = req.headers.get("authorization");
  if (supplied) {
    const token = process.env.ERROR_REVIEW_API_TOKEN ?? "";
    const candidate = supplied.startsWith("Bearer ") ? supplied.slice(7) : "";
    const digest = (s: string) => createHash("sha256").update(s).digest();
    if (workflowMutation || token.length < 32 || !timingSafeEqual(digest(token), digest(candidate)))
      throw new TemplateError("UNAUTHORIZED", 401, "Review 凭证无效或无状态维护权限");
    return "skill:" + digest(token).toString("hex").slice(0, 12);
  }
  return adminAuth(req, !["GET", "HEAD"].includes(req.method));
}
