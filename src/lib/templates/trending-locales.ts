// Product fallback rules: keep regional overrides first and Chinese scripts separate.
const simplified = ["zh-hans", "zh-cn", "zh-sg", "zh-my", "zh"];
const traditional = ["zh-hant", "zh-tw", "zh-hk", "zh-mo"];

// Configuration has one simplified Chinese entry; incoming client aliases remain supported.
export function trendingConfigLocale(locale: string): string {
  return simplified.includes(locale.toLowerCase()) ? "zh-Hans" : locale;
}
const aliases = [
  ["he", "iw"],
  ["id", "in"],
  ["yi", "ji"],
  ["fil", "fil-ph", "tl"],
  ["es", "es-es"],
  ["pl", "pl-pl"],
  ["pt", "pt-pt"],
  ["sv", "sv-se"],
  ["zu", "zu-za"],
  ["nb", "no"],
];
const regionalDefaults = new Map([
  ["kk", "kk-kz"],
  ["km", "km-kh"],
  ["lo", "lo-la"],
]);

export function trendingLocaleCandidates(locale: string): string[] {
  const exact = locale.toLowerCase();
  const parts = exact.split("-");
  const language = parts[0];
  const result = [exact];
  if (language === "zh") {
    // Explicit script takes precedence over region, e.g. zh-Hant-CN stays traditional.
    const isTraditional =
      parts.includes("hant") || (!parts.includes("hans") && parts.some((part) => ["tw", "hk", "mo"].includes(part)));
    result.push(...(isTraditional ? traditional : simplified));
  } else {
    const group = aliases.find((values) => values.includes(language));
    const canonicalParts = [group?.[0] ?? language, ...parts.slice(1)];
    // en-AU → en; sr-Latn-RS → sr-Latn → sr; regional variants never jump to siblings.
    for (let length = canonicalParts.length; length > 0; length--)
      result.push(canonicalParts.slice(0, length).join("-"));
    if (group) result.push(...group);
    const regional = regionalDefaults.get(language);
    if (regional) result.push(regional);
  }
  return [...new Set([...result, "en"])];
}
