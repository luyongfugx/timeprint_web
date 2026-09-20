"use client";
import { useEffect, useState } from "react";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { reportReasonLabel } from "@/lib/templates/report-reasons";

import { AssetPreview } from "./asset-preview";
import { LanguagePicker } from "./language-picker";
import { TrendingEditors } from "./trending-editors";

type Row = {
  id: string;
  coverPreviewURL?: string;
  payloadDownloadURL?: string;
  cover_width?: number | null;
  cover_height?: number | null;
  cover_kind?: string;
  contract_version?: number;
  watermark_name?: string;
  company_name?: string;
  language?: string;
  visibility?: string | null;
  status: number | string;
  updated_at?: string;
  created_at: string;
  share_code?: string;
  expires_at?: string | null;
  expire_time?: number;
  use_count?: number;
  template_id?: string;
  template?: Row | null;
  reason?: string;
  kind?: string;
  description?: string;
  contact?: string;
  submitted_code?: string;
  attachment_ids?: string[];
  required_fields?: string[];
  resolution?: string;
};
type Tab = "templates" | "reports" | "requests" | "trending";
// Temporarily hide the requests entry from the dashboard navigation.
const tabLabels = { templates: "分享水印", trending: "热门搜索词", reports: "举报审核" };
function Expiry({ row }: { row: Row }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const expiry =
    row.contract_version === 1
      ? Number(row.expire_time) > 0
        ? Number(row.expire_time) * 1000
        : null
      : row.expires_at
        ? Date.parse(row.expires_at)
        : null;
  if (expiry === null) return <p className="text-sm">过期时间: 永久有效（未过期）</p>;
  if (!Number.isFinite(expiry)) return <p className="text-sm">过期时间: 未知</p>;
  const expired = expiry <= now;
  return (
    <p className="text-sm">
      过期时间: {new Date(expiry).toLocaleString("zh-CN", { hour12: false })}{" "}
      <span className={expired ? "text-red-600" : "text-emerald-600"}>({expired ? "已过期" : "未过期"})</span>
    </p>
  );
}
function CoverPreview({ row, onOpen }: { row: Row; onOpen: () => void }) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  if (!row.coverPreviewURL) return <div className="text-muted-foreground p-6 text-sm">暂无封面</div>;
  // COS direct links support CI thumbnails; the authenticated proxy keeps its own variant.
  const cos = /myqcloud\.com\//.test(row.coverPreviewURL);
  const thumbnail = cos
    ? `${row.coverPreviewURL}?imageMogr2/thumbnail/480x640&retry=${attempt}`
    : `${row.coverPreviewURL}?variant=thumb&retry=${attempt}`;
  return (
    <div
      className="flex min-h-44 items-center justify-center rounded-lg border p-3"
      // Transparent covers composite on the same clean backdrop the apps use.
      style={{
        backgroundImage: "url(/template_share/clean.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {failed ? (
        <div className="space-y-2 text-center text-sm">
          <p className="text-muted-foreground">封面加载失败</p>
          <button
            className="text-blue-600 underline"
            onClick={() => {
              setFailed(false);
              setAttempt((v) => v + 1);
            }}
          >
            重新加载
          </button>
        </div>
      ) : (
        <button type="button" onClick={onOpen} aria-label="查看大图" className="block w-full">
          {/* Authenticated images must load directly with the administrator cookie. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={thumbnail}
            src={thumbnail}
            alt={`${row.watermark_name?.trim() ? row.watermark_name : "分享水印"}封面`}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
            className="mx-auto h-44 w-full object-contain"
          />
        </button>
      )}
    </div>
  );
}
function watermarkName(row?: Row | null) {
  return row?.watermark_name?.trim() ? row.watermark_name : "未填写";
}
function WatermarkDetails({ row, onPreview }: { row: Row; onPreview: (row: Row, kind: "cover" | "json") => void }) {
  return (
    <div className="grid items-start gap-4 sm:grid-cols-[240px_minmax(0,1fr)]">
      <CoverPreview row={row} onOpen={() => onPreview(row, "cover")} />
      <div className="space-y-2 text-sm break-words">
        <p>公司名／创建者：{row.company_name?.trim() ? row.company_name : "未填写"}</p>
        <p>语言：{row.language ?? "en"}</p>
        <p className="font-mono">code: {row.share_code}</p>
        <p className="text-sm">
          状态:{" "}
          <span className={Number(row.status) === 0 ? "text-emerald-600" : "text-red-600"}>
            {Number(row.status) === 0 ? "正常" : "已下架"}
          </span>
        </p>
        <p className="text-muted-foreground text-sm">
          {row.visibility === "public" ? "公开 · " : row.visibility === "private" ? "私密 · " : ""}
          使用 {row.use_count ?? 0} 次
        </p>
        <p className="text-sm">创建时间: {new Date(row.created_at).toLocaleString("zh-CN", { hour12: false })}</p>
        <Expiry row={row} />
        <div className="flex flex-wrap gap-3 pt-2">
          {row.coverPreviewURL && (
            <button
              type="button"
              onClick={() => onPreview(row, "cover")}
              className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
            >
              查看大图
            </button>
          )}
          {row.payloadDownloadURL && (
            <button
              type="button"
              onClick={() => onPreview(row, "json")}
              className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
            >
              查看模板 JSON
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
export default function Page() {
  const [preview, setPreview] = useState<{ kind: "cover" | "json"; url: string; name: string } | null>(null);
  function openPreview(row: Row, kind: "cover" | "json") {
    const url = kind === "cover" ? row.coverPreviewURL : row.payloadDownloadURL;
    if (url)
      setPreview({ kind, url, name: row.watermark_name?.trim() ? row.watermark_name : (row.share_code ?? row.id) });
  }
  const [tab, setTab] = useState<Tab>("templates"),
    [rows, setRows] = useState<Row[]>([]),
    [page, setPage] = useState(1),
    [pageSize, setPageSize] = useState(20),
    [total, setTotal] = useState(0),
    [jumpPage, setJumpPage] = useState(""),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState(""),
    [selectedLanguage, setSelectedLanguage] = useState(""),
    [submittedQuery, setSubmittedQuery] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [note, setNote] = useState(""),
    [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<{ row: Row; kind: "edit" | "remove" | "restore" | "delete" } | null>(null);
  const [editName, setEditName] = useState("");
  const [editCompany, setEditCompany] = useState("");
  const [operationNote, setOperationNote] = useState("");
  const [operationError, setOperationError] = useState("");
  const [saving, setSaving] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [batchConfirm, setBatchConfirm] = useState(false);
  const [batchNote, setBatchNote] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [batchError, setBatchError] = useState("");
  const [batchResult, setBatchResult] = useState("");
  const [review, setReview] = useState<{
    row: Row;
    title: string;
    isReport: boolean;
    path: string;
    method: "POST" | "PATCH";
    data: { decision?: "remove" | "keep"; status?: string };
  } | null>(null);
  function openReview(row: Row, data: { decision?: "remove" | "keep"; status?: string }) {
    const report = tab === "reports";
    const title =
      data.decision === "remove"
        ? "下架并结案"
        : data.decision === "keep"
          ? "保留并结案"
          : data.status === "in_review"
            ? "开始处理"
            : data.status === "rejected"
              ? "驳回"
              : "完成需求";
    setReview({
      row,
      title,
      isReport: report,
      data,
      path: report ? `/reports/${encodeURIComponent(row.id)}/resolve` : `/requests/${encodeURIComponent(row.id)}`,
      method: report ? "POST" : "PATCH",
    });
    setNote("");
    setOperationError("");
  }
  async function saveReview() {
    if (!review || saving || !note.trim()) return;
    setSaving(true);
    setOperationError("");
    try {
      await api(review.path, review.method, { ...review.data, note: note.trim() });
      setReview(null);
      setNote("");
      setRevision((v) => v + 1);
    } catch (e) {
      setOperationError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setSaving(false);
    }
  }
  function openOperation(row: Row, kind: "edit" | "remove" | "restore" | "delete") {
    setSelected({ row, kind });
    setEditName(row.watermark_name ?? "");
    setEditCompany(row.company_name ?? "");
    setOperationNote("");
    setOperationError("");
  }
  async function saveOperation() {
    if (!selected || saving) return;
    setSaving(true);
    setOperationError("");
    const { row, kind } = selected;
    const reason =
      operationNote.trim() ||
      { edit: "后台编辑名称和公司", remove: "后台下架分享", restore: "后台恢复上架", delete: "后台删除分享" }[kind];
    const common = { reason, expectedUpdatedAt: row.updated_at };
    try {
      if (kind === "edit")
        await api(`/${encodeURIComponent(row.id)}`, "PATCH", {
          ...common,
          watermarkName: editName,
          companyName: editCompany,
        });
      else if (kind === "delete") await api(`/${encodeURIComponent(row.id)}`, "DELETE", common);
      else await api(`/${encodeURIComponent(row.id)}/moderation`, "POST", { ...common, action: kind });
      setSelected(null);
      setRevision((v) => v + 1);
    } catch (e) {
      setOperationError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setSaving(false);
    }
  }
  const api = async (path: string, method: string, data: unknown) => {
    const res = await fetch(`/api/admin/templates${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error?.message ?? "操作失败");
    return result;
  };
  function toggleChecked(id: string, value: boolean) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
  }
  async function deleteChecked() {
    if (!checked.size || deleting) return;
    setDeleting(true);
    setBatchError("");
    let ok = 0;
    const failures: string[] = [];
    for (const id of checked) {
      const row = rows.find((r) => r.id === id);
      if (!row) continue;
      try {
        await api(`/${encodeURIComponent(row.id)}`, "DELETE", {
          reason: batchNote.trim() || "后台批量删除分享",
          expectedUpdatedAt: row.updated_at,
        });
        ok++;
      } catch (e) {
        failures.push(`${row.share_code ?? row.id}（${e instanceof Error ? e.message : "操作失败"}）`);
      }
    }
    setDeleting(false);
    setBatchConfirm(false);
    setBatchNote("");
    setChecked(new Set());
    setRevision((v) => v + 1);
    if (!ok && failures.length) setBatchError(`批量删除失败：${failures.join("；")}`);
    else
      setBatchResult(
        failures.length
          ? `已删除 ${ok} 条，失败 ${failures.length} 条：${failures.join("；")}`
          : `已删除 ${ok} 条水印分享`,
      );
  }
  useEffect(() => {
    if (tab === "trending") return;
    const controller = new AbortController();
    // Reset the prior query while synchronizing this view with the remote list.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBusy(true);
    setError("");
    setRows([]);
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), query: submittedQuery });
    if (filter && tab === "templates") params.set("visibility", filter);
    if (selectedLanguage && tab === "templates") params.set("language", selectedLanguage);
    fetch(`/api/admin/templates${tab === "templates" ? "" : `/${tab}`}?${params}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (res) => {
        const result = await res.json();
        if (!res.ok) throw new Error(result.error?.message ?? "加载失败");
        if (controller.signal.aborted) return;
        setRows(result.results);
        setTotal(result.total);
        // Keep only selections that still exist in the freshly loaded list.
        setChecked((prev) => {
          const next = new Set<string>();
          for (const row of result.results as Row[]) if (prev.has(row.id)) next.add(row.id);
          return next;
        });
        const lastPage = Math.min(10000, Math.max(1, Math.ceil(result.total / pageSize)));
        if (page > lastPage) setPage(lastPage);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [tab, page, pageSize, submittedQuery, filter, selectedLanguage, revision]);
  const totalPages = Math.min(10000, Math.max(1, Math.ceil(total / pageSize)));
  const button = "rounded-lg border px-3 py-2 text-sm disabled:opacity-40";
  return (
    <div className="space-y-6">
      {preview && <AssetPreview key={`${preview.kind}:${preview.url}`} {...preview} onClose={() => setPreview(null)} />}
      <Dialog
        open={review !== null}
        onOpenChange={(open) => {
          if (!open && !saving) setReview(null);
        }}
      >
        <DialogContent showCloseButton={!saving} className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{review?.title} · 处理说明</DialogTitle>
            <DialogDescription>填写本条记录的处理依据或结果，确认后将操作与说明一起提交。</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void saveReview();
            }}
          >
            {review?.row.template && (
              <section className="space-y-3" aria-label="被举报水印">
                <h3 className="font-semibold break-words">名称：{watermarkName(review.row.template)}</h3>
                <WatermarkDetails row={review.row.template} onPreview={openPreview} />
              </section>
            )}
            <div className="bg-muted space-y-2 rounded-lg p-3 text-sm">
              <p className="break-all">记录 ID：{review?.row.id}</p>
              {(review?.row.submitted_code ?? review?.row.template_id) && (
                <p className="break-all">关联水印：{review?.row.submitted_code ?? review?.row.template_id}</p>
              )}
              <p className="max-h-32 overflow-y-auto break-words whitespace-pre-wrap">
                {review?.isReport ? `举报理由：${reportReasonLabel(review.row.reason)}` : review?.row.description}
              </p>
            </div>
            {review?.data.decision && review.row.template === null && (
              <p className="text-muted-foreground text-sm">关联水印已不存在，无法预览。</p>
            )}
            {review?.data.decision === "remove" && (
              <p className="text-sm text-orange-600">确认后将下架对应水印，分享链接停止访问。</p>
            )}
            <label className="block space-y-2 text-sm">
              <span>处理说明（必填）</span>
              <textarea
                className="w-full rounded-xl border bg-transparent p-3"
                rows={4}
                maxLength={2000}
                required
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={saving}
                placeholder="填写处理依据、进展或结果"
              />
            </label>
            {operationError && (
              <p role="alert" className="text-sm text-red-600">
                {operationError}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button type="button" className={button} disabled={saving} onClick={() => setReview(null)}>
                取消
              </button>
              <button
                type="submit"
                className={`${button} ${review?.data.decision === "remove" ? "bg-red-600 text-white" : "bg-blue-600 text-white"}`}
                disabled={saving || !note.trim()}
              >
                {saving ? "提交中…" : `确认${review?.title ?? "提交"}`}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open && !saving) setSelected(null);
        }}
      >
        <DialogContent showCloseButton={!saving}>
          <DialogHeader>
            <DialogTitle>
              {selected
                ? { edit: "编辑水印信息", remove: "下架分享", restore: "恢复上架", delete: "删除分享" }[selected.kind]
                : "操作分享"}
            </DialogTitle>
            <DialogDescription>
              {selected?.kind === "delete"
                ? "删除后将从列表隐藏，分享链接停止访问。保留历史记录和文件关联，不会删除原始文件。"
                : selected?.kind === "edit"
                  ? "修改名称和公司信息；分享码、文件内容和有效期保持原值。"
                  : selected?.kind === "restore"
                    ? "恢复上架不会延长原有效期。"
                    : "下架后，用户将不能继续通过分享链接获取水印。"}
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void saveOperation();
            }}
          >
            <p className="font-mono text-sm break-all">code: {selected?.row.share_code}</p>
            {selected?.kind === "edit" && (
              <>
                <label className="block space-y-1 text-sm">
                  <span>水印名称</span>
                  <input
                    className="w-full rounded border bg-transparent p-2"
                    value={editName}
                    maxLength={selected.row.contract_version === 1 ? 255 : 100}
                    required={selected.row.visibility === "public" && selected.row.contract_version === 2}
                    onChange={(e) => setEditName(e.target.value)}
                    disabled={saving}
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <span>公司名称</span>
                  <input
                    className="w-full rounded border bg-transparent p-2"
                    value={editCompany}
                    maxLength={100}
                    onChange={(e) => setEditCompany(e.target.value)}
                    disabled={saving}
                  />
                </label>
              </>
            )}
            <label className="block space-y-1 text-sm">
              <span>操作说明（可选）</span>
              <textarea
                className="w-full rounded border bg-transparent p-2"
                value={operationNote}
                maxLength={2000}
                onChange={(e) => setOperationNote(e.target.value)}
                disabled={saving}
              />
            </label>
            {operationError && (
              <p role="alert" className="text-sm text-red-600">
                {operationError}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button type="button" className={button} disabled={saving} onClick={() => setSelected(null)}>
                取消
              </button>
              <button
                className={`${button} ${selected?.kind === "delete" ? "bg-red-600 text-white" : "bg-blue-600 text-white"}`}
                disabled={saving}
              >
                {saving
                  ? "处理中…"
                  : selected?.kind === "edit"
                    ? "确认保存修改"
                    : selected?.kind === "delete"
                      ? "确认删除"
                      : selected?.kind === "remove"
                        ? "确认下架"
                        : "确认恢复上架"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={batchConfirm}
        onOpenChange={(open) => {
          if (!open && !deleting) setBatchConfirm(false);
        }}
      >
        <DialogContent showCloseButton={!deleting}>
          <DialogHeader>
            <DialogTitle>批量删除选中的水印</DialogTitle>
            <DialogDescription>
              将删除 {checked.size} 条选中的水印分享，删除后分享链接停止访问；保留历史记录和文件关联，不会删除原始文件。
            </DialogDescription>
          </DialogHeader>
          <label className="block space-y-1 text-sm">
            <span>操作说明（可选）</span>
            <textarea
              className="w-full rounded border bg-transparent p-2"
              value={batchNote}
              maxLength={2000}
              onChange={(e) => setBatchNote(e.target.value)}
              disabled={deleting}
            />
          </label>
          {batchError && (
            <p role="alert" className="text-sm text-red-600">
              {batchError}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <button type="button" className={button} disabled={deleting} onClick={() => setBatchConfirm(false)}>
              取消
            </button>
            <button
              type="button"
              className={`${button} bg-red-600 text-white`}
              disabled={deleting}
              onClick={() => {
                void deleteChecked();
              }}
            >
              {deleting ? "处理中…" : `确认删除（${checked.size}）`}
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <header>
        <h1 className="text-2xl font-semibold">水印分享管理</h1>
        <p className="text-muted-foreground mt-2 text-sm">管理公开分享、私密码分享、举报与公司模板需求。</p>
      </header>
      <nav className="flex flex-wrap gap-2" aria-label="管理分类">
        {(Object.keys(tabLabels) as (keyof typeof tabLabels)[]).map((t) => (
          <button
            key={t}
            className={`${button} ${t === tab ? "bg-blue-600 text-white" : ""}`}
            onClick={() => {
              setTab(t);
              setPage(1);
              setNote("");
            }}
          >
            {tabLabels[t]}
          </button>
        ))}
      </nav>
      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700" role="alert">
          {error}
        </p>
      )}
      {tab === "templates" && (
        <form
          className="flex flex-wrap gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setSubmittedQuery(query);
            setPage(1);
            setRevision((v) => v + 1);
          }}
        >
          <input
            aria-label="搜索"
            placeholder="名称、公司或完整分享码"
            className="min-w-60 flex-1 rounded-lg border bg-transparent px-3 py-2"
            value={query}
            maxLength={100}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            aria-label="分享范围"
            className="rounded-lg border bg-transparent px-3"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">全部范围</option>
            <option value="public">公开</option>
            <option value="private">私密</option>
          </select>
          <LanguagePicker
            value={selectedLanguage}
            onChange={(language) => {
              setSelectedLanguage(language);
              setPage(1);
            }}
          />
          <button className={button} disabled={busy}>
            搜索
          </button>
        </form>
      )}
      {tab === "templates" && !busy && rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              aria-label="全选本页"
              checked={rows.length > 0 && rows.every((row) => checked.has(row.id))}
              onChange={(e) =>
                setChecked((prev) => {
                  const next = new Set(prev);
                  for (const row of rows) {
                    if (e.target.checked) next.add(row.id);
                    else next.delete(row.id);
                  }
                  return next;
                })
              }
            />
            全选本页
          </label>
          <button
            type="button"
            className={`${button} bg-red-600 text-white`}
            disabled={busy || checked.size === 0}
            onClick={() => {
              setBatchError("");
              setBatchResult("");
              setBatchConfirm(true);
            }}
          >
            删除选中（{checked.size}）
          </button>
          {batchResult && <p className="text-sm text-emerald-700">{batchResult}</p>}
          {batchError && (
            <p role="alert" className="text-sm text-red-600">
              {batchError}
            </p>
          )}
        </div>
      )}
      {tab === "trending" ? (
        <TrendingEditors />
      ) : busy ? (
        <p role="status">加载中…</p>
      ) : rows.length === 0 ? (
        <div className="text-muted-foreground rounded-xl border border-dashed p-10 text-center">暂无记录</div>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <article key={row.id} className="space-y-3 rounded-xl border p-5">
              <div className="flex flex-wrap justify-between gap-3">
                <div className="flex items-start gap-2">
                  {tab === "templates" && (
                    <input
                      type="checkbox"
                      aria-label={`选择 ${row.watermark_name?.trim() ? row.watermark_name : "未填写"}`}
                      className="mt-1 size-4 shrink-0"
                      checked={checked.has(row.id)}
                      onChange={(e) => toggleChecked(row.id, e.target.checked)}
                    />
                  )}
                  <h2 className="font-semibold break-words">
                    {tab === "templates"
                      ? `名称：${row.watermark_name?.trim() ? row.watermark_name : "未填写"}`
                      : tab === "reports"
                        ? `名称：${watermarkName(row.template)}`
                        : ([row.watermark_name, row.company_name].find(Boolean) ??
                          (row.kind === "company" ? "公司模板需求" : "内容审核"))}
                  </h2>
                </div>
                {tab !== "templates" && (
                  <span className="text-muted-foreground text-sm">
                    {tab === "reports" ? "举报时间：" : ""}
                    {new Date(row.created_at).toLocaleString()}
                  </span>
                )}
              </div>
              {tab === "templates" ? (
                <>
                  <WatermarkDetails row={row} onPreview={openPreview} />
                  <div className="flex flex-wrap gap-2 border-t pt-3 text-sm">
                    <a
                      className="inline-flex min-h-9 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 font-medium text-blue-700 transition-colors hover:bg-blue-100 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/60"
                      href={`https://share.timeprint.net/zh-Hans/share?code=${encodeURIComponent(row.share_code ?? "")}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      查看
                    </a>
                    <button
                      type="button"
                      className="inline-flex min-h-9 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 font-medium text-amber-700 transition-colors hover:bg-amber-100 focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-900/60"
                      onClick={() => openOperation(row, "edit")}
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      className="inline-flex min-h-9 items-center justify-center rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 font-medium text-orange-700 transition-colors hover:bg-orange-100 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300 dark:hover:bg-orange-900/60"
                      onClick={() => openOperation(row, Number(row.status) === 0 ? "remove" : "restore")}
                    >
                      {Number(row.status) === 0 ? "下架" : "恢复上架"}
                    </button>
                    <button
                      type="button"
                      className="inline-flex min-h-9 items-center justify-center rounded-lg border border-red-200 bg-red-50 px-4 py-2 font-medium text-red-700 transition-colors hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none dark:border-red-800 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-900/60"
                      onClick={() => openOperation(row, "delete")}
                    >
                      删除
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {tab === "reports" &&
                    (row.template ? (
                      <WatermarkDetails row={row.template} onPreview={openPreview} />
                    ) : (
                      <p className="text-muted-foreground text-sm">关联水印已不存在，无法预览。</p>
                    ))}
                  <p className="text-sm">
                    {tab === "reports"
                      ? `举报状态：${row.status === "resolved" ? "已处理" : "待处理"}`
                      : `状态：${row.status}`}
                  </p>
                  <p className="break-words whitespace-pre-wrap">
                    {tab === "reports" ? `举报理由：${reportReasonLabel(row.reason)}` : row.description}
                  </p>
                  {row.contact && <p className="text-sm">联系方式：{row.contact}</p>}
                  {row.submitted_code && <p className="font-mono">分享码：{row.submitted_code}</p>}
                  {row.required_fields?.length ? <p>所需字段：{row.required_fields.join("、")}</p> : null}
                  {row.attachment_ids?.map((id, i) => (
                    <a
                      key={id}
                      className="mr-3 text-blue-600 underline"
                      href={`/api/admin/templates/request-assets/${encodeURIComponent(id)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      参考图片 {i + 1}
                    </a>
                  ))}
                  {row.resolution && <p className="text-muted-foreground text-sm">处理结果：{row.resolution}</p>}
                  {tab === "reports" ? (
                    <div className="flex gap-3">
                      {(["remove", "keep"] as const).map((decision) => (
                        <button
                          key={decision}
                          className={button}
                          disabled={row.status === "resolved" || busy}
                          onClick={() => openReview(row, { decision })}
                        >
                          {decision === "remove" ? "下架并结案" : "保留并结案"}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      <button
                        className={button}
                        disabled={busy}
                        onClick={() => openReview(row, { status: "in_review" })}
                      >
                        开始处理
                      </button>
                      <button
                        className={button}
                        disabled={busy}
                        onClick={() =>
                          openReview(row, {
                            status: "resolved",
                            ...(row.kind === "removal" ? { decision: "keep" } : {}),
                          })
                        }
                      >
                        {row.kind === "removal" ? "保留并结案" : "完成需求"}
                      </button>
                      {row.kind === "removal" && (
                        <button
                          className={button}
                          disabled={busy}
                          onClick={() => openReview(row, { status: "resolved", decision: "remove" })}
                        >
                          下架并结案
                        </button>
                      )}
                      <button
                        className={button}
                        disabled={busy}
                        onClick={() => openReview(row, { status: "rejected" })}
                      >
                        驳回
                      </button>
                    </div>
                  )}
                </>
              )}
            </article>
          ))}
        </div>
      )}
      {tab !== "trending" && (
        <div className="flex flex-wrap items-center gap-3">
          <button className={button} disabled={page === 1 || busy} onClick={() => setPage((p) => p - 1)}>
            上一页
          </button>
          <span className="text-sm">
            第 {page} / {totalPages} 页，共 {total} 条
          </span>
          <button
            className={button}
            disabled={page >= totalPages || busy || !!error}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
          </button>
          <label className="flex items-center gap-2 text-sm">
            每页
            <select
              aria-label="每页条数"
              className="bg-background rounded-lg border px-2 py-2"
              value={pageSize}
              disabled={busy}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
                setJumpPage("");
              }}
            >
              {[10, 20, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size} 条
                </option>
              ))}
            </select>
          </label>
          <form
            className="flex items-center gap-2 text-sm"
            onSubmit={(e) => {
              e.preventDefault();
              const target = Number(jumpPage);
              if (Number.isInteger(target) && target >= 1 && target <= totalPages) {
                setPage(target);
                setJumpPage("");
              }
            }}
          >
            <label className="flex items-center gap-2">
              跳至
              <input
                aria-label="跳转页码"
                type="number"
                min={1}
                max={totalPages}
                step={1}
                required
                value={jumpPage}
                onChange={(e) => setJumpPage(e.target.value)}
                disabled={busy || !!error}
                className="bg-background w-20 rounded-lg border px-2 py-2"
              />
              页
            </label>
            <button type="submit" className={button} disabled={busy || !!error || !jumpPage.trim()}>
              跳转
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
