import "server-only";
import { assertOrigin, readSession, tokenFromRequest } from "../auth/session";

import { TemplateError } from "./errors";

export async function adminAuth(req: Request, requireOwner = false) {
  if (!["GET", "HEAD"].includes(req.method)) assertOrigin(req);
  const user = await readSession(tokenFromRequest(req));
  if (!user) throw new TemplateError("UNAUTHORIZED", 401, "请先登录");
  if (requireOwner && user.role !== "admin") throw new TemplateError("FORBIDDEN", 403, "需要管理员权限");
  return user.id;
}
