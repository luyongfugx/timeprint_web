// Replays the legacy POST /api/applink resource chain without touching MySQL or
// requiring COS credentials. Usage:
//   TEMPLATE_ALLOWED_LEGACY_ASSET_HOSTS=<host> node --conditions=react-server \
//     --import tsx scripts/diagnose-legacy-applink.ts <coverURL> <jsonURL>
import { resolve4 } from "node:dns/promises";

import { imageMetadata, referenceURL } from "../src/lib/templates/asset-service";
import { TemplateError } from "../src/lib/templates/errors";
import { fetchLegacy, legacyURL, publicIPv4 } from "../src/lib/templates/legacy-assets";
import { imageFields, parsePayload } from "../src/lib/templates/payload";

const [coverImageUrl = "", jsonDownloadUrl = ""] = process.argv.slice(2);
type Payload = Record<string, unknown>;

function describe(e: unknown) {
  if (e instanceof TemplateError) return `TemplateError code=${e.code} status=${e.status} message="${e.message}"`;
  return `${e instanceof Error ? e.name : typeof e}: ${e instanceof Error ? e.message : String(e)}`;
}
async function step<T>(name: string, fn: () => T | Promise<T>): Promise<T | undefined> {
  try {
    const value = await fn();
    console.log(`PASS  ${name} :: ${typeof value === "string" ? value : JSON.stringify(value)}`);
    return value;
  } catch (e) {
    console.log(`FAIL  ${name} :: ${describe(e)}`);
    return undefined;
  }
}
function items(payload: Payload) {
  const model = payload.watermarkModel as { items?: unknown[] } | undefined;
  return Array.isArray(model?.items) ? model.items : [];
}
async function main() {
  if (!coverImageUrl || !jsonDownloadUrl) {
    console.error("用法: ... diagnose-legacy-applink.ts <coverURL> <jsonURL>");
    process.exitCode = 2;
    return;
  }
  console.log("== 环境 ==");
  console.log("TEMPLATE_API_ORIGIN =", process.env.TEMPLATE_API_ORIGIN ?? "(default https://wm.timeprint.net)");
  console.log("TEMPLATE_ALLOWED_LEGACY_ASSET_HOSTS =", process.env.TEMPLATE_ALLOWED_LEGACY_ASSET_HOSTS ?? "(empty)");
  console.log("");
  await step("1. legacyURL(cover, kind=cover)", () => legacyURL(coverImageUrl, "cover").href);
  await step("2. legacyURL(json, kind=payload)", () => legacyURL(jsonDownloadUrl, "payload").href);
  await step("3. DNS resolve4 主机", async () => {
    const host = new URL(coverImageUrl).hostname;
    const addresses = await resolve4(host);
    return { host, addresses, publicIPv4: addresses.map((a) => `${a}=${publicIPv4(a)}`) };
  });
  await step("4. fetchLegacy(cover)", async () => {
    const bytes = await fetchLegacy(coverImageUrl, "cover");
    const meta = await imageMetadata(bytes);
    return { bytes: bytes.length, mime: meta.mime, width: meta.width, height: meta.height };
  });
  let payloadText = "";
  await step("5. fetchLegacy(json)", async () => {
    const bytes = await fetchLegacy(jsonDownloadUrl, "payload");
    payloadText = bytes.toString("utf8");
    return { bytes: bytes.length, head: payloadText.slice(0, 120) };
  });
  await step("6. parsePayload(json, visibility=public)", () => {
    const payload = parsePayload(Buffer.from(payloadText, "utf8"), "public");
    return {
      topKeys: Object.keys(payload),
      schemaVersion: payload.schemaVersion ?? null,
      itemCount: items(payload).length,
      itemIDs: items(payload).map((item) => (item as { id?: unknown }).id),
    };
  });
  await step("7. imageFields 中的资源 URL 是否满足 legacyURL 规则", () => {
    const payload = parsePayload(Buffer.from(payloadText, "utf8"), "public");
    return imageFields(payload).map((field) => {
      const value = field.parent[field.key];
      if (value == null || value === "") return { field: `${field.kind}.${field.key}`, ok: "empty-skip" };
      try {
        legacyURL(value as string, field.kind);
        return { field: `${field.kind}.${field.key}`, url: value, ok: true };
      } catch (e) {
        return { field: `${field.kind}.${field.key}`, url: value, ok: false, error: describe(e) };
      }
    });
  });
  await step("8. fetchLegacy(每个 logo)", async () => {
    const payload = parsePayload(Buffer.from(payloadText, "utf8"), "public");
    const logos = imageFields(payload)
      .filter((field) => field.kind === "logo")
      .map((field) => field.parent[field.key])
      .filter((value): value is string => typeof value === "string" && value !== "");
    const results = [];
    for (const url of logos) {
      try {
        const bytes = await fetchLegacy(url, "logo");
        results.push({ url, bytes: bytes.length });
      } catch (e) {
        results.push({ url, error: describe(e) });
      }
    }
    return results;
  });
  console.log("");
  console.log("== 参考：referenceURL 形态 ==");
  console.log(referenceURL("00000000-0000-4000-8000-000000000000", "11111111-1111-4111-8111-111111111111"));
}

main().catch((e) => {
  console.error("诊断脚本异常：", describe(e));
  process.exitCode = 1;
});
