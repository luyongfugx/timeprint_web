import { pathToFileURL } from "node:url";

import { cosConfig, createCOS } from "./lib/cos.mjs";

// Only the current objects under this prefix are changed; bytes are never rewritten.
export async function resetObjectACLs(client, { Bucket, Region, Prefix, apply = false }, log = console.log) {
  const counts = { scanned: 0, updated: 0, failed: 0 };
  let marker = "";
  for (;;) {
    const page = await client.getBucket({ Bucket, Region, Prefix, Marker: marker, MaxKeys: 1000 });
    const objects = page.Contents ?? [];
    for (let offset = 0; offset < objects.length; offset += 5) {
      await Promise.all(
        objects.slice(offset, offset + 5).map(async ({ Key }) => {
          if (typeof Key !== "string" || !Key.startsWith(Prefix)) throw new Error("Unexpected COS object key");
          counts.scanned++;
          if (!apply) {
            log(JSON.stringify({ action: "preview", key: Key }));
            return;
          }
          try {
            await client.putObjectAcl({ Bucket, Region, Key, ACL: "default" });
            counts.updated++;
          } catch (error) {
            counts.failed++;
            log(
              JSON.stringify({ action: "failed", key: Key, code: error.code ?? "UNKNOWN", status: error.statusCode }),
            );
          }
        }),
      );
    }
    log(JSON.stringify({ action: "progress", ...counts }));
    if (page.IsTruncated !== true && page.IsTruncated !== "true") break;
    const next = page.NextMarker || objects.at(-1)?.Key;
    if (!next || Buffer.compare(Buffer.from(next), Buffer.from(marker)) <= 0)
      throw new Error("COS pagination did not advance; rerun to continue safely.");
    marker = next;
  }
  return counts;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log(
      "Usage: node --env-file=.env.local scripts/reset-template-object-acls.mjs [--apply] [--prefix=template-assets-v2/]",
    );
    console.log("Without --apply, only list objects. --prefix= explicitly selects the entire bucket.");
    return;
  }
  if (args.some((arg) => arg !== "--apply" && !arg.startsWith("--prefix=")))
    throw new Error("Unknown argument; use --help.");
  const { Bucket, Region, Prefix } = cosConfig();
  const prefix = args.find((arg) => arg.startsWith("--prefix="))?.slice("--prefix=".length) ?? `${Prefix}/`;
  const apply = args.includes("--apply");
  console.log(
    JSON.stringify({ bucket: Bucket, region: Region, prefix, mode: apply ? "apply" : "preview", acl: "default" }),
  );
  const counts = await resetObjectACLs(createCOS(), { Bucket, Region, Prefix: prefix, apply });
  console.log(JSON.stringify({ action: "complete", ...counts }));
  if (counts.failed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
