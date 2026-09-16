// Import all distinct country catalog brand names in source order.
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { createDatabase } from "./lib/prisma.mjs";
const root = resolve(process.argv.find((arg) => arg.startsWith("--source="))?.slice(9) ?? "../gps_map_camera");
const base = join(root, "tools/watermark_catalog");
const read = (path) => JSON.parse(readFileSync(path, "utf8"));
const coverage = read(join(base, "sources/matrix/coverage.json"));
const client = join(root, "iOSTimeGPS/UI/Watermark/Catalog");
const catalog = read(join(client, "TimeprintWatermarkCatalog.json"));
const names = new Intl.DisplayNames(["zh-Hans"], { type: "region" });
const english = new Intl.DisplayNames(["en"], { type: "region" });
const overrides = new Map();
// Current deployed catalogs take precedence over the source matrix and archived catalogs.
for (const dir of [
  join(base, "archive"),
  client,
  join(base, "deployment/watermark_catalog/v2/lists"),
  join(base, "deployment/watermark_catalog/v2/languages"),
]) {
  for (const file of readdirSync(dir)
    .sort()
    .filter((f) => f.endsWith(".json"))) {
    const data = read(join(dir, file));
    if (!data.country || !Array.isArray(data.entries)) continue;
    const terms = [
      ...new Set(
        data.entries
          .filter((e) => e.section === "brands")
          .map((e) => e.name.trim())
          .filter(Boolean),
      ),
    ];
    if (terms.length)
      overrides.set(data.country, { terms, language: data.language, source: join(dir, file).slice(root.length + 1) });
  }
}
const regions = coverage.countries.map((code) => {
  const language = new Intl.Locale(`und-${code}`).maximize().language;
  const preferred =
    code === "TW" || code === "HK" || code === "MO"
      ? "zh-Hant"
      : language === "zh"
        ? "zh-Hans"
        : language === "pt"
          ? "pt-PT"
          : language;
  const responses = coverage.responses.filter((r) => r.country === code && r.kind === "pgc" && r.url);
  const response = responses.find((r) => r.language === preferred) ?? responses.find((r) => r.language === "en");
  let terms = [],
    source = "",
    sourceLanguage = preferred;
  if (response) {
    const hash = createHash("sha256").update(response.url).digest("hex");
    const path = join(base, `sources/matrix/catalogs/${hash}.json`);
    const data = existsSync(path) ? read(path) : JSON.parse(gunzipSync(readFileSync(`${path}.gz`)).toString());
    terms = [
      ...new Set(
        data.categories
          .flatMap((c) => c.watermarkItems)
          .map((e) => e.name.trim())
          .filter(Boolean),
      ),
    ];
    source = `tools/watermark_catalog/sources/matrix/catalogs/${hash}.json.gz`;
    sourceLanguage = response.language;
  }
  const override = overrides.get(code);
  return {
    code,
    name: names.of(code),
    search: english.of(code),
    terms: override?.terms ?? terms,
    language: override?.language ?? sourceLanguage,
    source: override?.source ?? source,
  };
});
const localeRegions = Object.fromEntries(
  [...overrides].map(([country, data]) => [data.language.toLowerCase(), country]),
);
for (const [locale, route] of Object.entries(catalog.routes))
  if (route.country) localeRegions[locale.toLowerCase()] = route.country;
for (const [alias, locale] of Object.entries(catalog.localeAliases))
  if (localeRegions[locale.toLowerCase()]) localeRegions[alias.toLowerCase()] = localeRegions[locale.toLowerCase()];
const snapshot = { source: "gps_map_camera", localeRegions, regions };
for (const region of regions)
  if (region.terms.some((term) => [...term].length > 100)) throw new Error(`Term exceeds limit: ${region.code}`);
writeFileSync(resolve("src/lib/templates/trending-regions.json"), JSON.stringify(snapshot, null, 2) + "\n");
console.log(
  `Read ${regions.length} regions, ${regions.reduce((sum, r) => sum + r.terms.length, 0)} terms; ${regions.filter((r) => !r.terms.length).length} empty regions.`,
);
if (process.argv.includes("--apply")) {
  const db = createDatabase();
  try {
    const count = await db.$transaction(
      async (tx) => {
        const existing = await tx.template_trending_terms.findMany({
          where: { locale: { startsWith: "region:" } },
          select: { locale: true, term: true, sort_order: true },
        });
        const data = regions.flatMap((region) => {
          const locale = `region:${region.code}`;
          const saved = existing.filter((row) => row.locale.toUpperCase() === locale.toUpperCase());
          if (saved.length && !process.argv.includes("--append-missing")) return [];
          const savedTerms = new Set(saved.map((row) => row.term.toLowerCase()));
          const missing = region.terms.filter((term) => !savedTerms.has(term.toLowerCase()));
          const nextOrder = saved.reduce((max, row) => Math.max(max, row.sort_order + 1), 0);
          return missing.map((term, index) => ({
            id: randomUUID(),
            locale,
            term,
            sort_order: nextOrder + index,
            enabled: true,
          }));
        });
        return data.length ? (await tx.template_trending_terms.createMany({ data })).count : 0;
      },
      { timeout: 120000 },
    );
    console.log(`Imported ${count} terms. Existing country configurations preserved.`);
  } finally {
    await db.$disconnect();
  }
}
