// 复现旧版 POST /api/applink 的资源快照链路（不写库、不依赖 COS 凭据）。
// 用法：node --conditions=react-server --import tsx scripts/diagnose-legacy-applink.ts
import { resolve4 } from "node:dns/promises";

import { imageMetadata, referenceURL } from "../src/lib/templates/asset-service";
import { TemplateError } from "../src/lib/templates/errors";
import { fetchLegacy, legacyURL, publicIPv4 } from "../src/lib/templates/legacy-assets";
import { imageFields, parsePayload } from "../src/lib/templates/payload";

const coverImageUrl =
  "https://wm-1330977225.cos.ap-singapore.myqcloud.com/android/ugc_cover/20260915_y7Al_1080_464.jpg";
const jsonDownloadUrl = "https://wm-1330977225.cos.ap-singapore.myqcloud.com/android/ugc_json/20260915_Pmzn.json";

function describe(e: unknown) {
  if (e instanceof TemplateError) return `TemplateError code=${e.code} status=${e.status} message="${e.message}"`;
  return `${e instanceof Error ? e.name : typeof e}: ${e instanceof Error ? e.message : String(e)}`;
}
async function step<T>(name: string, fn: () => T | Promise<T>): Promise<T | undefined> {
  try {
    const v = await fn();
    console.log(`PASS  ${name} :: ${typeof v === "string" ? v : JSON.stringify(v)}`);
    return v;
  } catch (e) {
    console.log(`FAIL  ${name} :: ${describe(e)}`);
    return undefined;
  }
}

async function main() {
  console.log("== 环境 ==");
  console.log("TEMPLATE_API_ORIGIN =", process.env.TEMPLATE_API_ORIGIN ?? "(default https://wm.timeprint.net)");
  console.log("TEMPLATE_ALLOWED_LEGACY_ASSET_HOSTS =", process.env.TEMPLATE_ALLOWED_LEGACY_ASSET_HOSTS ?? "(empty)");
  console.log("TEMPLATE_PUBLIC_ENABLED =", process.env.TEMPLATE_PUBLIC_ENABLED);
  console.log("");

  await step("1. legacyURL(cover, kind=cover)", () => legacyURL(coverImageUrl, "cover").href);
  await step("2. legacyURL(json, kind=payload)", () => legacyURL(jsonDownloadUrl, "payload").href);
  await step("3. DNS resolve4 COS 主机", async () => {
    const hosts = [...new Set([new URL(coverImageUrl).hostname, new URL(jsonDownloadUrl).hostname])];
    const out: Record<string, unknown> = {};
    for (const h of hosts) {
      const a = await resolve4(h);
      out[h] = { addresses: a, publicIPv4: a.map((x) => `${x}=${publicIPv4(x)}`) };
    }
    return out;
  });
  await step("4. fetchLegacy(cover)", async () => {
    const b = await fetchLegacy(coverImageUrl, "cover");
    const meta = await imageMetadata(b);
    return { bytes: b.length, mime: meta.mime, width: meta.width, height: meta.height };
  });
  let payloadText = "";
  await step("5. fetchLegacy(json)", async () => {
    const b = await fetchLegacy(jsonDownloadUrl, "payload");
    payloadText = b.toString("utf8");
    return { bytes: b.length, head: payloadText.slice(0, 120) };
  });
  await step("6. parsePayload(json, visibility=public)", () => {
    const p = parsePayload(Buffer.from(payloadText, "utf8"), "public") as Record<string, any>;
    return {
      topKeys: Object.keys(p).slice(0, 40),
      schemaVersion: p.schemaVersion ?? null,
      items: p.watermarkModel?.items?.length ?? null,
      itemIDs: (p.watermarkModel?.items ?? []).map((i: any) => i?.id),
    };
  });
  await step("7. imageFields 中的资源 URL 是否满足 legacyURL 规则", () => {
    const p = parsePayload(Buffer.from(payloadText, "utf8"), "public") as Record<string, any>;
    const out: unknown[] = [];
    for (const f of imageFields(p)) {
      const value = f.parent[f.key] as string | undefined;
      if (value == null || value === "") {
        out.push({ field: `${f.kind}.${f.key}`, value: value ?? null, ok: "empty-skip" });
        continue;
      }
      try {
        legacyURL(value, f.kind);
        out.push({ field: `${f.kind}.${f.key}`, value, ok: true });
      } catch (e) {
        out.push({ field: `${f.kind}.${f.key}`, value, ok: false, error: describe(e) });
      }
    }
    return out;
  });
  await step("8. fetchLegacy(每个 logo) 是否可下载", async () => {
    const p = parsePayload(Buffer.from(payloadText, "utf8"), "public") as Record<string, any>;
    const out: unknown[] = [];
    for (const f of imageFields(p)) {
      const value = f.parent[f.key] as string | undefined;
      if (!value || f.kind !== "logo") continue;
      try {
        const b = await fetchLegacy(value, "logo");
        out.push({ value, bytes: b.length });
      } catch (e) {
        out.push({ value, error: describe(e) });
      }
    }
    return out;
  });
  console.log("");
  console.log("== 参考：referenceURL 形态 ==");
  console.log(referenceURL("00000000-0000-4000-8000-000000000000", "11111111-1111-4111-8111-111111111111"));
}

main().catch((e) => {
  console.error("诊断脚本异常：", describe(e));
  process.exitCode = 1;
});
