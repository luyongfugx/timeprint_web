"use client";

import { useMemo, useState } from "react";

import { Check, ChevronDown, Globe2, Search } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { templateLanguageOptions } from "@/lib/templates/languages";

const groupOrder = ["亚洲", "欧洲", "非洲", "北美洲", "南美洲", "大洋洲"];
const languages = templateLanguageOptions;

function languageName(code: string) {
  const item = languages.find((language) => language.value === code.toLowerCase());
  return item ? `${item.name} (${item.code})` : code;
}

export function LanguagePicker({ value, onChange }: { value: string; onChange: (language: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const groups = useMemo(() => {
    const names = [...groupOrder, ...new Set(languages.map((language) => language.group))].filter(
      (name, index, all) => all.indexOf(name) === index,
    );
    return names
      .map((name) => ({
        name,
        languages: languages.filter(
          (language) =>
            language.group === name &&
            (!normalizedQuery ||
              `${language.name} ${language.search} ${language.code}`.toLocaleLowerCase().includes(normalizedQuery)),
        ),
      }))
      .filter((group) => group.languages.length);
  }, [normalizedQuery]);

  function select(language: string) {
    onChange(language);
    setOpen(false);
    setQuery("");
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
          className="bg-background hover:bg-accent inline-flex min-h-10 min-w-48 items-center justify-between gap-2 rounded-lg border px-3 text-sm"
          aria-label={`选择分享水印语言：${value ? languageName(value) : "全部语言"}`}
        >
          <span className="flex min-w-0 items-center gap-2">
            <Globe2 className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{value ? languageName(value) : "全部语言"}</span>
          </span>
          <ChevronDown className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        collisionPadding={16}
        className="flex max-h-[min(75vh,var(--radix-popover-content-available-height))] w-[min(680px,calc(100vw-2rem))] flex-col gap-3 overflow-hidden rounded-xl border p-3 shadow-xl"
        aria-label="选择分享水印语言"
      >
        <div className="relative shrink-0">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索语言名称或代码"
            aria-label="搜索语言"
            className="bg-background focus-visible:ring-ring h-10 w-full rounded-lg border pr-3 pl-9 text-sm outline-none focus-visible:ring-2"
            autoFocus
          />
        </div>
        <div className="min-h-0 space-y-3 overflow-y-auto pr-1">
          {!normalizedQuery && (
            <button
              type="button"
              onClick={() => select("")}
              className={`hover:bg-accent focus-visible:ring-ring flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm focus-visible:ring-2 focus-visible:outline-none ${!value ? "bg-accent font-semibold" : ""}`}
            >
              <span className="flex-1">全部语言</span>
              {!value && <Check className="size-4 text-blue-600" aria-hidden="true" />}
            </button>
          )}
          {groups.map((group) => (
            <section key={group.name} aria-label={group.name}>
              <h3 className="mb-1 rounded-md border-l-4 border-blue-500 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-950 dark:bg-blue-950/30 dark:text-blue-100">
                {group.name}
              </h3>
              <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-4">
                {group.languages.map((language) => {
                  const selected = value.toLowerCase() === language.value;
                  return (
                    <button
                      key={language.value}
                      type="button"
                      onClick={() => select(language.value)}
                      aria-pressed={selected}
                      title={`${language.name} (${language.code})`}
                      className={`hover:bg-accent focus-visible:ring-ring flex min-w-0 items-center gap-2 rounded-md px-2 py-2.5 text-left text-sm focus-visible:ring-2 focus-visible:outline-none ${selected ? "bg-accent font-semibold" : ""}`}
                    >
                      <span className="min-w-0 flex-1 truncate" dir="auto">
                        {language.name}
                      </span>
                      {selected && <Check className="size-4 shrink-0 text-blue-600" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
          {!groups.length && <p className="text-muted-foreground py-5 text-center text-sm">未找到匹配的语言</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
