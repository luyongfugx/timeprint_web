import { randomUUID } from "node:crypto";
import { cosConfig, createCOS, objectKey, objectUploadHeaders, signedObjectURL } from "./lib/cos.mjs";
const { Bucket, Region, Prefix } = cosConfig();
const client = createCOS();
await client.headBucket({ Bucket, Region });
console.log(JSON.stringify({ bucket: Bucket, region: Region, prefix: Prefix, reachable: true }));
if (process.argv.includes("--apply")) {
  // Probe only our dedicated directory. Never change the existing bucket ACL.
  const key = `staging/${randomUUID()}/${randomUUID()}`;
  const headers = objectUploadHeaders("application/json");
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
    if (!read.ok) throw new Error(`COS signed read probe failed (${read.status})`);
    const anonymous = new URL(signed);
    anonymous.search = "";
    const publicRead = await fetch(anonymous, { redirect: "error", signal: AbortSignal.timeout(15000) });
    await publicRead.body?.cancel();
    if (!publicRead.ok)
      throw new Error(`Anonymous access must succeed; got ${publicRead.status}. Check bucket permissions.`);
    console.log("COS upload/read passed; anonymous access is allowed.");
  } finally {
    if (uploaded) await client.deleteObject({ Bucket, Region, Key: objectKey(key) });
  }
} else console.log("Run with --apply to verify upload and anonymous read using one temporary object, then remove it.");
