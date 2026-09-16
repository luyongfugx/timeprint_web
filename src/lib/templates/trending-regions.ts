import snapshot from "./trending-regions.json";

export const trendingRegions = snapshot.regions;
export function normalizeTrendingRegion(value: string): string | undefined {
  const code = value.toUpperCase();
  return trendingRegions.some((region) => region.code === code) ? code : undefined;
}
export function trendingRegionForLocale(locale: string): string {
  try {
    const parsed = new Intl.Locale(locale);
    if (parsed.region) return normalizeTrendingRegion(parsed.region) ?? "US";
    const mapped = (snapshot.localeRegions as Partial<Record<string, string>>)[locale.toLowerCase()];
    return mapped ?? normalizeTrendingRegion(parsed.maximize().region ?? "US") ?? "US";
  } catch {
    return "US";
  }
}

// Empty regional lists fall directly back to the English (US) country list.
export function trendingRegionCandidates(locale: string, region?: string): string[] {
  return [...new Set([`region:${region ?? trendingRegionForLocale(locale)}`.toLowerCase(), "region:us", "en"])];
}
