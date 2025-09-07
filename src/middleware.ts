// ⚠️ This middleware has been temporarily disabled to avoid unnecessary edge function executions.
// To re-enable, rename this file to `middleware.ts`.
import { NextRequest, NextResponse } from "next/server";

import { authMiddleware } from "./middleware/auth-middleware";

export async function middleware(req: NextRequest) {


  // authMiddleware
  const response = await authMiddleware(req);
  if (response) {
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/auth/v1/login"],
};
