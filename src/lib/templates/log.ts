import "server-only";

import { TemplateError } from "./errors";

// Never log share codes for private shares, upload tokens, or user file bytes.
// Only the failing code/message/reason and non-sensitive resource context go out.
export function errorDetails(error: unknown) {
  if (error instanceof TemplateError)
    return {
      name: "TemplateError",
      code: error.code,
      status: error.status,
      retryable: error.retryable,
      message: error.message,
    };
  if (error instanceof Error) return { name: error.name, message: error.message, stack: error.stack };
  return { name: typeof error, message: String(error) };
}
export function logFailure(scope: string, context: Record<string, unknown>, error: unknown) {
  console.error(`[applink] ${scope} failed ${JSON.stringify({ ...context, error: errorDetails(error) })}`);
}
