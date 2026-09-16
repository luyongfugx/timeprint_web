"use client";

import { useState } from "react";

import { Check, ChevronDown, Globe, Search } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { trendingRegions } from "@/lib/templates/trending-regions";

const groups = [
  {
    name: "国家／地区",
    languages: trendingRegions.map((region) => [region.code, region.name, region.search] as [string, string, string]),
  },
];

export function RegionPicker({ value, onChange }: { value: string[]; onChange: (regions: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const all = groups.flatMap((group) => group.languages);
  const selectedNames = value.map((code) => all.find(([item]) => item === code)?.[1] ?? code);
  const search = query.trim().toLowerCase();
  const filtered = groups
    .map((group) => ({
      ...group,
      languages: group.languages.filter((language) =>
        `${group.name} ${language.join(" ")}`.toLowerCase().includes(search),
      ),
    }))
    .filter((group) => group.languages.length);
  function select(code: string) {
    onChange(value.includes(code) ? value.filter((item) => item !== code) : [...value, code].slice(-8));
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
          aria-label={`选择国家／地区：${selectedNames.join("、") || "未选择"}`}
        >
          <Globe className="size-4" aria-hidden="true" />
          选择国家／地区
          <span className="text-muted-foreground text-xs">{value.length}/8</span>
          <ChevronDown className="text-muted-foreground size-4" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={10}
        collisionPadding={16}
        className="flex max-h-[min(75vh,var(--radix-popover-content-available-height))] w-[min(1100px,calc(100vw-2rem))] flex-col gap-4 overflow-hidden rounded-2xl border p-4 shadow-xl"
        aria-label="选择热门搜索词国家／地区"
      >
        <p className="text-muted-foreground text-sm">
          最多选择 8 个；继续选择会移除最早选中的国家／地区。再次点击可取消选择。
        </p>
        <div className="relative shrink-0">
          <Search className="text-muted-foreground absolute top-3 left-3 size-5" aria-hidden="true" />
          <input
            aria-label="搜索国家／地区"
            placeholder="搜索国家／地区名称或代码"
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
                    aria-pressed={value.includes(code)}
                    title={`${name} (${code})`}
                    onClick={() => select(code)}
                    className={`hover:bg-accent focus-visible:ring-ring flex min-w-0 items-center gap-2 rounded-lg px-3 py-3 text-left text-sm focus-visible:ring-2 focus-visible:outline-none ${value.includes(code) ? "bg-accent font-semibold" : ""}`}
                  >
                    <span className="min-w-0 flex-1 truncate" dir="auto">
                      {name}
                    </span>
                    {value.includes(code) && <Check className="size-4 shrink-0 text-orange-600" aria-hidden="true" />}
                  </button>
                ))}
              </div>
            </section>
          ))}
          {!filtered.length && <p className="text-muted-foreground py-4 text-center text-sm">未找到匹配的国家／地区</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
