"use client";

import { useState } from "react";

import { Check, ChevronDown, Globe, Search } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import clientLocales from "@/lib/templates/client-locales.json";
import { trendingConfigLocale } from "@/lib/templates/trending-locales";

const configLanguages = [
  ...new Map(
    clientLocales.languages.map((language) => {
      const code = trendingConfigLocale(language.code);
      return [
        code,
        code === "zh-Hans"
          ? {
              ...language,
              code,
              name: "简体中文",
              search: "简体中文 中国 新加坡 马来西亚 zh zh-CN zh-SG zh-MY zh-Hans",
            }
          : language,
      ] as const;
    }),
  ).values(),
];
const groups = ["亚洲", "欧洲", "美洲与大洋洲", "非洲"].map((name) => ({
  name,
  languages: configLanguages
    .filter((language) => language.group === name)
    .map((language) => [language.code, language.name, language.search] as [string, string, string]),
}));

export function LanguagePicker({ value, onChange }: { value: string; onChange: (locale: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const all = groups.flatMap((group) => group.languages);
  const selectedCode = trendingConfigLocale(value);
  const selected = all.find(([code]) => code === selectedCode);
  const search = query.trim().toLowerCase();
  const filtered = groups
    .map((group) => ({
      ...group,
      languages: group.languages.filter((language) =>
        `${group.name} ${language.join(" ")}`.toLowerCase().includes(search),
      ),
    }))
    .filter((group) => group.languages.length);
  const customCode = trendingConfigLocale(query.trim());
  const custom =
    /^[a-zA-Z0-9-]{2,35}$/.test(query.trim()) && !all.some(([code]) => code.toLowerCase() === customCode.toLowerCase());
  function select(code: string) {
    onChange(trendingConfigLocale(code));
    setOpen(false);
  }
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="bg-background hover:bg-accent inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm shadow-sm"
          aria-label={`选择语言：${selected?.[1] ?? value}`}
        >
          <Globe className="size-4" aria-hidden="true" />
          {selected?.[1] ?? value}
          <span className="text-muted-foreground text-xs">{selectedCode}</span>
          <ChevronDown className="text-muted-foreground size-4" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={10}
        collisionPadding={16}
        className="flex max-h-[min(75vh,var(--radix-popover-content-available-height))] w-[min(1100px,calc(100vw-2rem))] flex-col gap-4 overflow-hidden rounded-2xl border p-4 shadow-xl"
        aria-label="选择热门搜索词语言"
      >
        <div className="relative shrink-0">
          <Search className="text-muted-foreground absolute top-3 left-3 size-5" aria-hidden="true" />
          <input
            aria-label="搜索语言"
            placeholder="搜索语言、中文名称或语言代码"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-background focus-visible:ring-ring h-11 w-full rounded-xl border pr-3 pl-10 text-sm outline-none focus-visible:ring-2"
          />
        </div>
        <div className="min-h-0 space-y-5 overflow-y-auto pr-1">
          {filtered.map((group) => (
            <section key={group.name} aria-label={group.name}>
              <h3 className="mb-2 rounded-lg border-l-4 border-orange-500 bg-orange-50 px-4 py-2.5 font-semibold text-orange-950 dark:bg-orange-950/30 dark:text-orange-100">
                {group.name}
              </h3>
              <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-6">
                {group.languages.map(([code, name]) => (
                  <button
                    key={code}
                    type="button"
                    aria-pressed={selectedCode === code}
                    title={`${name} (${code})`}
                    onClick={() => select(code)}
                    className={`hover:bg-accent focus-visible:ring-ring flex min-w-0 items-center gap-2 rounded-lg px-3 py-3 text-left text-sm focus-visible:ring-2 focus-visible:outline-none ${selectedCode === code ? "bg-accent font-semibold" : ""}`}
                  >
                    <span className="min-w-0 flex-1 truncate" dir="auto">
                      {name}
                    </span>
                    {selectedCode === code && <Check className="size-4 shrink-0 text-orange-600" aria-hidden="true" />}
                  </button>
                ))}
              </div>
            </section>
          ))}
          {!filtered.length && <p className="text-muted-foreground py-4 text-center text-sm">未找到匹配的语言</p>}
          {custom && (
            <button
              type="button"
              className="hover:bg-accent w-full rounded-lg border px-3 py-3 text-left text-sm"
              onClick={() => select(query.trim())}
            >
              使用语言代码：{query.trim()}
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
