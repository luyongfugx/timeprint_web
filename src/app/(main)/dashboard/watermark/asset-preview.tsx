"use client";

import { useEffect, useState } from "react";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function AssetPreview({
  kind,
  url,
  name,
  onClose,
}: {
  kind: "cover" | "json";
  url: string;
  name: string;
  onClose: () => void;
}) {
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (kind !== "json") return;
    const controller = new AbortController();
    fetch(url, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message ?? "JSON 加载失败");
        if (!controller.signal.aborted) setContent(JSON.stringify(data, null, 2));
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "JSON 加载失败");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [kind, url, attempt]);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="flex max-h-[90dvh] flex-col sm:max-w-5xl">
        <DialogHeader className="shrink-0 pr-6">
          <DialogTitle>{kind === "cover" ? "完整封面" : "模板 JSON"}</DialogTitle>
          <DialogDescription className="break-all">{name}</DialogDescription>
        </DialogHeader>
        <div className="bg-muted/30 min-h-0 flex-1 overflow-auto rounded-xl border p-3">
          {loading && !error && (
            <p role="status" className="text-muted-foreground p-4 text-center text-sm">
              加载中…
            </p>
          )}
          {error ? (
            <div className="space-y-3 p-4 text-center">
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
              <button
                type="button"
                className="rounded-lg border px-3 py-2 text-sm"
                onClick={() => {
                  setError("");
                  setLoading(true);
                  setAttempt((v) => v + 1);
                }}
              >
                重新加载
              </button>
            </div>
          ) : kind === "cover" ? (
            // Authenticated cover endpoint preserves access checks and legacy redirects.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={attempt}
              src={`${url}${url.includes("?") ? "&" : "?"}retry=${attempt}`}
              alt={name}
              referrerPolicy="no-referrer"
              onLoad={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setError("封面加载失败，请重试");
              }}
              className="mx-auto max-h-[65dvh] max-w-full object-contain"
            />
          ) : (
            !loading && (
              <pre className="text-xs leading-6 sm:text-sm" tabIndex={0} aria-label="格式化 JSON">
                <code>{content}</code>
              </pre>
            )
          )}
        </div>
        <div className="flex shrink-0 justify-end">
          <button type="button" className="hover:bg-accent rounded-lg border px-4 py-2 text-sm" onClick={onClose}>
            关闭
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
