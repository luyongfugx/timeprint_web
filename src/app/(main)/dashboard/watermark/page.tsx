"use client";

import { useEffect, useState } from "react";

type LinkItem = {
  id: string;
  watermark_name: string;
  company_name: string;
  cover_image_url?: string | null;
  json_download_url?: string | null;
  status?: number;
  created_at?: string;
  share_code?: string;
  expire_time?: number | null;
};

export default function Page() {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<LinkItem[]>([]);
  const [page, setPage] = useState<number>(1);
  const perPage = 20;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // create form
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    watermarkName: "",
    companyName: "",
    coverImageUrl: "",
    jsonDownloadUrl: "",
    status: 0,
    userId: "",
    expireType: 0 as 0 | 1 | 2 | 3,
  });

  const [showCreate, setShowCreate] = useState(false);

  // edit state
  const [editing, setEditing] = useState<LinkItem | null>(null);
  const [editForm, setEditForm] = useState({
    watermarkName: "",
    companyName: "",
    coverImageUrl: "",
    jsonDownloadUrl: "",
    status: 0,
    expireType: 0 as 0 | 1 | 2 | 3,
  });

  const doSearch = async (kw?: string, pageNum?: number) => {
    const q = kw ?? keyword;
    const p = pageNum ?? page;

    setLoading(true);
    setError(null);
    try {
      const body: any = { page: p, limit: perPage };
      if (q && typeof q === "string" && q.trim() !== "") body.keyword = q;

      const res = await fetch("/api/applink/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json?.results) {
        setResults(json.results);
        setPage(json.page ?? p);
      } else if (json?.error) {
        setError(json.error);
      } else {
        setError("Unexpected response");
      }
    } catch (err: any) {
      setError(err?.message || "Network error");
    } finally {
      setLoading(false);
    }
  };

  // initial load: if user hasn't searched, load first page of all watermarks
  useEffect(() => {
    doSearch(undefined, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createItem = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/applink", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json?.success) {
        // refresh current page
        await doSearch(undefined, 1);
        setForm({
          watermarkName: "",
          companyName: "",
          coverImageUrl: "",
          jsonDownloadUrl: "",
          status: 0,
          userId: "",
          expireType: 0,
        });
      } else {
        setError(json?.error || "Create failed");
      }
    } catch (err: any) {
      setError(err?.message || "Network error");
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (item: LinkItem) => {
    setEditing(item);
    setEditForm({
      watermarkName: item.watermark_name,
      companyName: item.company_name,
      coverImageUrl: item.cover_image_url || "",
      jsonDownloadUrl: item.json_download_url || "",
      status: item.status ?? 0,
      expireType: (() => {
        if (!item.expire_time || item.expire_time === 0) return 0;
        const nowSec = Math.floor(Date.now() / 1000);
        const delta = item.expire_time - nowSec;
        // 近似还原：如果在 1 小时以内选 3；1 天以内选 2；30 天以内选 1；否则默认 1
        if (delta <= 60 * 60) return 3;
        if (delta <= 24 * 60 * 60) return 2;
        return 1;
      })(),
    });
  };

  const cancelEdit = () => {
    setEditing(null);
  };

  const saveEdit = async () => {
    if (!editing?.share_code) return setError("Missing share code for edit");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/applink/${encodeURIComponent(editing.share_code)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          watermarkName: editForm.watermarkName,
          companyName: editForm.companyName,
          coverImageUrl: editForm.coverImageUrl,
          jsonDownloadUrl: editForm.jsonDownloadUrl,
          status: editForm.status,
          expireType: editForm.expireType,
        }),
      });
      const json = await res.json();
      if (json?.success) {
        await doSearch(undefined, page);
        setEditing(null);
      } else {
        setError(json?.error || "Update failed");
      }
    } catch (err: any) {
      setError(err?.message || "Network error");
    } finally {
      setLoading(false);
    }
  };

  const deleteItem = async (item: LinkItem) => {
    if (!confirm(`确认删除分享 "${item.watermark_name}" ?`)) return;
    if (!item.share_code) return setError("Missing share code for delete");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/applink/${encodeURIComponent(item.share_code)}`, { method: "DELETE" });
      const json = await res.json();
      if (json?.success) {
        // after deletion, refresh current page (if last item removed, backend will return shorter list)
        await doSearch(undefined, page);
      } else {
        setError(json?.error || "Delete failed");
      }
    } catch (err: any) {
      setError(err?.message || "Network error");
    } finally {
      setLoading(false);
    }
  };

  const unpublishItem = async (item: LinkItem) => {
    if (!item.share_code) return setError("Missing share code for unpublish");
    if (!confirm(`确认${item.status === -1 ? "上架" : "下架"}水印 "${item.watermark_name}" ?`)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/applink/${encodeURIComponent(item.share_code)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: item.status === -1 ? 0 : -1 }),
      });
      const json = await res.json();
      if (json?.success) {
        await doSearch(undefined, page);
      } else {
        setError(json?.error || "Unpublish failed");
      }
    } catch (err: any) {
      setError(err?.message || "Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <h2 className="mb-4 text-xl font-semibold">水印分享管理</h2>

      <section className="mb-6">
        <div className="flex gap-2">
          <input
            className="flex-1 rounded border px-3 py-2"
            placeholder="搜索公司名或水印名称"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <button className="rounded bg-yellow-500 px-3 py-2 text-white" onClick={() => doSearch(keyword)}>
            搜索
          </button>
          <button className="rounded bg-yellow-600 px-3 py-2 text-white" onClick={() => setShowCreate(true)}>
            新建水印
          </button>
        </div>
      </section>

      {/* 创建表单已移入弹窗：点击“新建水印”打开 */}

      {error && <div className="mb-4 text-red-600">{error}</div>}

      <section>
        <h3 className="mb-2 font-medium">搜索结果</h3>
        {loading ? (
          <div>加载中...</div>
        ) : results.length === 0 ? (
          <div className="text-muted-foreground text-sm">无结果</div>
        ) : (
          <ul className="space-y-3">
            {results.map((it) => (
              <li key={it.id} className="flex items-start gap-3 rounded border p-3">
                <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded bg-gray-100">
                  {it.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.cover_image_url} alt={it.watermark_name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="text-muted-foreground flex h-full items-center justify-center text-sm">无图</div>
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold">{it.watermark_name}</div>
                      <div className="text-muted-foreground text-sm">{it.company_name}</div>
                      <div className="text-muted-foreground mt-1 text-xs">code: {it.share_code}</div>
                      <div className="mt-1 text-xs">
                        状态:{" "}
                        <span className={it.status === -1 ? "text-red-600" : "text-green-600"}>
                          {it.status === -1 ? "已下架" : "正常"}
                        </span>
                      </div>
                      <div className="text-muted-foreground mt-1 text-xs">
                        过期时间:{" "}
                        {it.expire_time && it.expire_time > 0
                          ? new Date((it.expire_time as number) * 1000).toLocaleString()
                          : "永不过期"}{" "}
                        {(() => {
                          const nowSec = Math.floor(Date.now() / 1000);
                          const expired = !!(it.expire_time && it.expire_time > 0 && it.expire_time <= nowSec);
                          return (
                            <span className={expired ? "text-red-600" : "text-green-600"}>
                              ({expired ? "已过期" : "未过期"})
                            </span>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <button
                        className="text-sm text-blue-600"
                        onClick={() => window.open(`/share?code=${encodeURIComponent(it.share_code || "")}`)}
                      >
                        查看
                      </button>
                      <button className="text-sm text-yellow-600" onClick={() => startEdit(it)}>
                        编辑
                      </button>
                      <button className="text-sm text-amber-600" onClick={() => unpublishItem(it)}>
                        {it.status === -1 ? "上架" : "下架"}
                      </button>
                      <button className="text-sm text-red-600" onClick={() => deleteItem(it)}>
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {/* pagination controls */}
        <div className="mt-4 flex items-center justify-between">
          <button
            className="rounded border px-3 py-1"
            onClick={() => {
              if (page > 1) doSearch(undefined, page - 1);
            }}
            disabled={page <= 1 || loading}
          >
            上一页
          </button>
          <div className="text-muted-foreground text-sm">第 {page} 页</div>
          <button
            className="rounded border px-3 py-1"
            onClick={() => {
              // attempt to fetch next page; backend will return empty if no more
              doSearch(undefined, page + 1);
            }}
            disabled={loading || results.length < perPage}
          >
            下一页
          </button>
        </div>
      </section>

      {/* create modal area */}
      {showCreate && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded bg-white p-4">
            <h4 className="mb-2 font-medium">新建分享</h4>
            <div className="grid gap-2">
              <input
                placeholder="水印名称"
                className="rounded border px-2 py-1"
                value={form.watermarkName}
                onChange={(e) => setForm({ ...form, watermarkName: e.target.value })}
              />
              <input
                placeholder="公司名"
                className="rounded border px-2 py-1"
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
              />
              <input
                placeholder="封面图片 URL"
                className="rounded border px-2 py-1"
                value={form.coverImageUrl}
                onChange={(e) => setForm({ ...form, coverImageUrl: e.target.value })}
              />
              <input
                placeholder="JSON 下载链接"
                className="rounded border px-2 py-1"
                value={form.jsonDownloadUrl}
                onChange={(e) => setForm({ ...form, jsonDownloadUrl: e.target.value })}
              />
              <input
                placeholder="用户 ID (userId)"
                className="rounded border px-2 py-1"
                value={form.userId}
                onChange={(e) => setForm({ ...form, userId: e.target.value })}
              />
              <select
                className="rounded border px-2 py-1"
                value={form.expireType}
                onChange={(e) => setForm({ ...form, expireType: Number(e.target.value) as 0 | 1 | 2 | 3 })}
              >
                <option value={0}>永不过期</option>
                <option value={1}>1个月过期</option>
                <option value={2}>1天过期</option>
                <option value={3}>1小时过期</option>
              </select>
              <div className="mt-2 flex gap-2">
                <button
                  className="rounded bg-green-600 px-3 py-2 text-white"
                  onClick={async () => {
                    await createItem();
                    setShowCreate(false);
                  }}
                  disabled={creating}
                >
                  {creating ? "创建中..." : "创建"}
                </button>
                <button className="rounded border px-3 py-2" onClick={() => setShowCreate(false)}>
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* edit modal area */}
      {editing && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded bg-white p-4">
            <h4 className="mb-2 font-medium">编辑分享</h4>
            <div className="grid gap-2">
              <input
                className="rounded border px-2 py-1"
                value={editForm.watermarkName}
                onChange={(e) => setEditForm({ ...editForm, watermarkName: e.target.value })}
              />
              <input
                className="rounded border px-2 py-1"
                value={editForm.companyName}
                onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })}
              />
              <input
                className="rounded border px-2 py-1"
                value={editForm.coverImageUrl}
                onChange={(e) => setEditForm({ ...editForm, coverImageUrl: e.target.value })}
              />
              <input
                className="rounded border px-2 py-1"
                value={editForm.jsonDownloadUrl}
                onChange={(e) => setEditForm({ ...editForm, jsonDownloadUrl: e.target.value })}
              />
              <select
                className="rounded border px-2 py-1"
                value={editForm.expireType}
                onChange={(e) => setEditForm({ ...editForm, expireType: Number(e.target.value) as 0 | 1 | 2 | 3 })}
              >
                <option value={0}>永不过期</option>
                <option value={1}>1个月过期</option>
                <option value={2}>1天过期</option>
                <option value={3}>1小时过期</option>
              </select>
              <div className="mt-2 flex gap-2">
                <button className="rounded bg-yellow-600 px-3 py-2 text-white" onClick={saveEdit}>
                  保存
                </button>
                <button className="rounded border px-3 py-2" onClick={cancelEdit}>
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
