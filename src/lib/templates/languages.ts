import clientLocales from "./client-locales.json";

export function canonicalTemplateLanguage(value: string) {
  const normalized = value.trim().replaceAll("_", "-").toLowerCase();
  const [base] = normalized.split("-");
  if (base === "en") return "en";
  if (base === "zh") {
    const traditional = normalized.includes("hant") || ["zh-tw", "zh-hk", "zh-mo"].includes(normalized);
    return traditional ? "zh-hant" : "zh-hans";
  }
  return normalized;
}

export function templateLanguageAliases(value: string) {
  const canonical = canonicalTemplateLanguage(value);
  if (canonical === "en") return ["en", "en-us", "en-gb", "en-au", "en-ca"];
  if (canonical === "zh-hans") return ["zh-hans", "zh", "zh-cn", "zh-sg"];
  if (canonical === "zh-hant") return ["zh-hant", "zh-tw", "zh-hk", "zh-mo"];
  return [canonical];
}

export function displayLanguageTag(value: string) {
  return canonicalTemplateLanguage(value)
    .split("-")
    .map((part, index) =>
      index === 0 ? part : part.length === 4 ? `${part[0]?.toUpperCase()}${part.slice(1)}` : part.toUpperCase(),
    )
    .join("-");
}

const optionNames: Record<string, { name: string; search: string; group: string }> = {
  "zh-hans": { name: "中文（简体）", search: "简体中文", group: "亚洲" },
  "zh-hant": { name: "繁體中文", search: "繁体中文 香港 台湾 澳门", group: "亚洲" },
};

export const templateLanguageOptions = [
  ...new Map(
    clientLocales.languages.map((item) => {
      const value = canonicalTemplateLanguage(item.code);
      return [
        value,
        {
          value,
          code: displayLanguageTag(value),
          ...(optionNames[value] ?? { name: item.name, search: item.search, group: item.group }),
        },
      ] as const;
    }),
  ).values(),
];
