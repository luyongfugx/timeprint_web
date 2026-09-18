import "server-only";
import { cosLocation, objectKey, objectUploadHeaders, signedObjectURL } from "../../../scripts/lib/cos.mjs";

import { TemplateError } from "./errors";
import { boundedBytes } from "./http";

export async function signedUpload(key: string, mime: string, sessionExpiresAt: string) {
  const expires = Math.min(3600, Math.floor((Date.parse(sessionExpiresAt) - Date.now()) / 1000));
  if (!(expires > 0)) throw new TemplateError("UPLOAD_SESSION_EXPIRED", 410);
  const uploadHeaders = objectUploadHeaders(mime);
  const uploadURL = await signedObjectURL(key, "PUT", uploadHeaders, expires);
  return { uploadURL, uploadHeaders, uploadExpiresAt: new Date(Date.now() + expires * 1000).toISOString() };
}
export async function uploadObject(key: string, bytes: Buffer, mime: string) {
  const headers = objectUploadHeaders(mime);
  const url = await signedObjectURL(key, "PUT", headers);
  const response = await fetch(url, {
    method: "PUT",
    headers,
    body: new Uint8Array(bytes),
    redirect: "error",
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  await response.body?.cancel();
  if (!response.ok) throw new TemplateError("RESOURCE_NOT_READY", 503, "COS resource upload failed.", true);
}
export async function downloadObject(key: string, max: number) {
  const url = await signedObjectURL(key, "GET");
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(15000), cache: "no-store" });
  if (!response.ok) {
    await response.body?.cancel();
    throw new TemplateError("RESOURCE_NOT_READY", 503, "A template resource is not ready.", true);
  }
  if (Number(response.headers.get("content-length")) > max) {
    await response.body?.cancel();
    throw new TemplateError("PAYLOAD_TOO_LARGE", 413);
  }
  return boundedBytes(response.body, max);
}

/** Unsigned COS address; the object's ACL determines whether it can be read directly. */
export function cosObjectReference(key: string) {
  const { Bucket, Region } = cosLocation();
  return `https://${Bucket}.cos.${Region}.myqcloud.com/${objectKey(key)}`;
}

/** Same immutable client bytes may be PUT again after an ambiguous network failure. */
export async function signedDeferredUpload(key: string, mime: string) {
  const expires = 3600;
  const uploadHeaders = { "Content-Type": mime };
  const uploadURL = await signedObjectURL(key, "PUT", uploadHeaders, expires);
  return { uploadURL, uploadHeaders, uploadExpiresAt: new Date(Date.now() + expires * 1000).toISOString() };
}
