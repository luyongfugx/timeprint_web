import { randomUUID } from "node:crypto";
import { cosConfig, createCOS, objectKey, privateUploadHeaders, signedObjectURL } from "./lib/cos.mjs";
const { Bucket, Region, Prefix } = cosConfig();
const client = createCOS();
await client.headBucket({ Bucket, Region });
console.log(JSON.stringify({ bucket: Bucket, region: Region, prefix: Prefix, reachable: true }));
if (process.argv.includes("--apply")) {
  // Probe only our dedicated directory. Never change the existing bucket ACL.
  const key = `staging/${randomUUID()}/${randomUUID()}`;
  const headers = privateUploadHeaders("application/json");
  const upload = await signedObjectURL(key, "PUT", headers);
  let uploaded = false;
  try {
    const put = await fetch(upload, {
      method: "PUT",
      headers,
      body: "{}",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    await put.body?.cancel();
    if (!put.ok) throw new Error(`COS upload probe failed (${put.status})`);
    uploaded = true;
    const signed = await signedObjectURL(key, "GET");
    const read = await fetch(signed, { redirect: "error", signal: AbortSignal.timeout(15000) });
    await read.body?.cancel();
    if (!read.ok) throw new Error(`COS private read probe failed (${read.status})`);
    const anonymous = new URL(signed);
    anonymous.search = "";
    const denied = await fetch(anonymous, { redirect: "error", signal: AbortSignal.timeout(15000) });
    await denied.body?.cancel();
    if (denied.status !== 403)
      throw new Error(
        `Anonymous access must return 403; got ${denied.status}. Check bucket policy before enabling shares.`,
      );
    console.log("COS upload/read passed; anonymous access is denied.");
  } finally {
    if (uploaded) await client.deleteObject({ Bucket, Region, Key: objectKey(key) });
  }
} else console.log("Run with --apply to verify private upload/read using one temporary object, then remove it.");
