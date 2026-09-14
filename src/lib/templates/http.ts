import { randomUUID } from "node:crypto";

import { z } from "zod";

import { apiOrigin, shareOrigin } from "./config";
import { TemplateError } from "./errors";

export const privateHeaders = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
};
export function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: privateHeaders });
}
export async function boundedBytes(stream: ReadableStream<Uint8Array> | null, max: number) {
  if (!stream) throw new TemplateError("INVALID_REQUEST");
  const reader = stream.getReader();
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) {
        await reader.cancel();
        throw new TemplateError("PAYLOAD_TOO_LARGE", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, size);
}
export async function body<T extends z.ZodTypeAny>(req: Request, schema: T): Promise<z.infer<T>> {
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
    throw new TemplateError("INVALID_REQUEST");
  try {
    return schema.parse(JSON.parse((await boundedBytes(req.body, 32 * 1024)).toString("utf8")));
  } catch (e) {
    if (e instanceof TemplateError) throw e;
    throw new TemplateError("INVALID_REQUEST", 400, "Please check the request fields.");
  }
}
export async function endpoint(req: Request, handler: () => Promise<Response>, legacy = false, admin = false) {
  let response: Response;
  try {
    response = await handler();
  } catch (e) {
    const err =
      e instanceof TemplateError
        ? e
        : new TemplateError("SERVICE_UNAVAILABLE", 503, "Template service is temporarily unavailable.", true);
    response = json(
      legacy
        ? { error: err.message }
        : { error: { code: err.code, message: err.message, retryable: err.retryable, requestID: randomUUID() } },
      err.status,
    );
    if (err.retryable) response.headers.set("Retry-After", err.status === 429 ? "60" : "2");
  }
  for (const [k, v] of Object.entries(privateHeaders)) response.headers.set(k, v);
  if (!admin) {
    const origin = req.headers.get("origin");
    if (origin && [shareOrigin(), apiOrigin()].includes(origin))
      response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Vary", "Origin");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Idempotency-Key, X-Template-Upload-Protocol, X-Template-Upload-Session, X-Template-Upload-Token",
    );
    response.headers.set("Access-Control-Expose-Headers", "Retry-After, X-Payload-SHA256");
  }
  return response;
}
