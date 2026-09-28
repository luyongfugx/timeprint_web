import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

import { adminAuth } from "../templates/admin-auth";
import { TemplateError } from "../templates/errors";

import { decodeGitOperator } from "./operator";

export async function reviewAuth(req: Request) {
  const supplied = req.headers.get("authorization");
  if (supplied) {
    const token = process.env.ERROR_REVIEW_API_TOKEN ?? "";
    const candidate = supplied.startsWith("Bearer ") ? supplied.slice(7) : "";
    const digest = (s: string) => createHash("sha256").update(s).digest();
    if (token.length < 32 || !timingSafeEqual(digest(token), digest(candidate)))
      throw new TemplateError("UNAUTHORIZED", 401, "Review 凭证无效");
    if (!["GET", "HEAD"].includes(req.method)) {
      try {
        return decodeGitOperator(req.headers.get("x-review-git-operator"));
      } catch {
        throw new TemplateError("INVALID_REQUEST", 400, "需要有效的 Git 用户名和邮箱");
      }
    }
    return "skill:" + digest(token).toString("hex").slice(0, 12);
  }
  return adminAuth(req, !["GET", "HEAD"].includes(req.method));
}
