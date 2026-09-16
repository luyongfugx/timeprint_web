"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { X } from "lucide-react";

import { trendingRegions } from "@/lib/templates/trending-regions";

import { RegionPicker } from "./region-picker";

const regionsStorageKey = "timeprint.admin.trending.regions.v1";
const validRegionCodes = new Set(trendingRegions.map((region) => region.code));

const subscribeToHydration = () => () => {};

function readSavedRegions(): string[] {
  try {
    const saved = localStorage.getItem(regionsStorageKey);
    if (saved !== null) {
      const parsed: unknown = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        const restored = [
          ...new Set(parsed.filter((code): code is string => typeof code === "string" && validRegionCodes.has(code))),
        ].slice(-8);
        if (parsed.length === 0 || restored.length > 0) return restored;
      }
    }
  } catch {
    // Invalid or unavailable storage falls back to the default selection.
  }
  return ["CN"];
}

export function TrendingEditors() {
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  return hydrated ? <SavedTrendingEditors /> : null;
}

function SavedTrendingEditors() {
  const [regions, setRegions] = useState(readSavedRegions);
  // Keep drafts when the oldest selection is displaced or a country is temporarily deselected.
  const [drafts, setDrafts] = useState<Partial<Record<string, string>>>({});

  useEffect(() => {
    try {
      localStorage.setItem(regionsStorageKey, JSON.stringify(regions));
    } catch {
      // Selection remains usable when the browser blocks local storage.
    }
  }, [regions]);

  return (
    <section className="space-y-4" aria-label="国家／地区热门搜索词">
      <div className="flex flex-wrap items-center gap-3">
        <RegionPicker value={regions} onChange={setRegions} />
        <p className="text-muted-foreground text-sm">按选择顺序显示，各国家／地区独立保存。</p>
      </div>
      {regions.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border border-dashed p-8 text-center">
          请选择要编辑的国家／地区
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {regions.map((region) => (
            <RegionEditor
              key={region}
              region={region}
              draft={drafts[region]}
              onDraft={(value) => setDrafts((previous) => ({ ...previous, [region]: value }))}
              onRemove={() => setRegions((previous) => previous.filter((code) => code !== region))}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function RegionEditor({
  region,
  draft,
  onDraft,
  onRemove,
}: {
  region: string;
  draft: string | undefined;
  onDraft: (value: string) => void;
  onRemove: () => void;
}) {
  const name = trendingRegions.find((item) => item.code === region)?.name ?? region;
  const [loading, setLoading] = useState(draft === undefined);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (draft !== undefined) return;
    const controller = new AbortController();
    fetch(`/api/admin/templates/trending?region=${encodeURIComponent(region)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error?.message ?? "加载失败");
        if (!controller.signal.aborted) {
          onDraft(
            result.terms
              .filter((term: { enabled: boolean }) => term.enabled)
              .map((term: { term: string }) => term.term)
              .join("\n"),
          );
          setLoading(false);
        }
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : "加载失败");
          setLoading(false);
        }
      });
    return () => controller.abort();
    // onDraft only writes this country's draft; changing another editor must not restart this request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region, draft, retry]);

  async function save() {
    if (draft === undefined) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const response = await fetch(`/api/admin/templates/trending?region=${encodeURIComponent(region)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          terms: draft
            .split("\n")
            .map((term) => term.trim())
            .filter(Boolean)
            .map((term) => ({ term, enabled: true })),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? "保存失败");
      setSaved(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="min-w-0 space-y-3 rounded-xl border p-4" aria-label={`${name}热门搜索词`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">
          {name} <span className="text-muted-foreground text-xs font-normal">{region}</span>
        </h3>
        <button type="button" aria-label={`移除${name}`} onClick={onRemove} className="hover:bg-accent rounded-lg p-2">
          <X className="size-4" />
        </button>
      </div>
      <label className="block text-sm">
        搜索词（每行一个，不限数量）
        <textarea
          rows={10}
          value={draft ?? ""}
          disabled={loading || saving || draft === undefined}
          aria-label={`${name}搜索词`}
          onChange={(event) => {
            onDraft(event.target.value);
            setSaved(false);
          }}
          className="mt-2 w-full rounded-xl border bg-transparent p-3 disabled:opacity-50"
        />
      </label>
      {loading && (
        <p role="status" className="text-muted-foreground text-sm">
          加载中…
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3">
        {draft === undefined && !loading ? (
          <button
            type="button"
            className="rounded-lg border px-3 py-2 text-sm"
            onClick={() => {
              setError("");
              setLoading(true);
              setRetry((value) => value + 1);
            }}
          >
            重试加载
          </button>
        ) : (
          <button
            type="button"
            disabled={loading || saving || draft === undefined}
            onClick={save}
            className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
          >
            {saving ? "保存中…" : "保存搜索词"}
          </button>
        )}
        {saved && (
          <span role="status" className="text-sm text-green-600">
            已保存
          </span>
        )}
      </div>
    </article>
  );
}
