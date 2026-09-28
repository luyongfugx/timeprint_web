"use client";
import { Suspense, useEffect, useState } from "react";

import { useSearchParams } from "next/navigation";

import { statusLabels, transitions, yesterday, type Review, type IssueStatus } from "@/lib/error-reviews/contracts";
import type { Issue } from "@/lib/error-reviews/service";

const base = "/api/admin/error-reviews";
const control = "rounded-md border bg-background px-3 py-2 text-sm";
const button = `${control} disabled:opacity-50`;
type Run = { id: string; review_date: string; summary: string; created_at: string };
type History = {
  issue: Issue;
  sightings: { run_id: string; review_date: string }[];
  actions: {
    id: string;
    actor: string;
    note: string;
    created_at: string;
    after_state: { status: IssueStatus; fix_version: string };
  }[];
};
async function api<T>(path = "", options?: RequestInit): Promise<T> {
  const res = await fetch(base + path, {
    ...options,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error?.message ?? "请求失败，请稍后重试");
  return result;
}
const time = (v: string) => new Date(v).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
export default function ErrorReviewsPage() {
  return (
    <Suspense fallback={<p>正在加载…</p>}>
      <ReviewPage />
    </Suspense>
  );
}
function ReviewPage() {
  const params = useSearchParams();
  const [tab, setTab] = useState<"daily" | "issues">("daily");
  const [date, setDate] = useState(params.get("date") ?? yesterday());
  const [runs, setRuns] = useState<Run[]>([]);
  const [runId, setRunId] = useState(params.get("run") ?? "");
  const [loadedDetail, setDetail] = useState<{ report: Review; issues: Issue[] } | null>(null);
  const [status, setStatus] = useState("");
  const [platform, setPlatform] = useState("");
  const [page, setPage] = useState(1);
  const [issues, setIssues] = useState<{ items: Issue[]; total: number }>({ items: [], total: 0 });
  const [issueId, setIssueId] = useState("");
  const [loadedHistory, setHistory] = useState<History | null>(null);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [loadedKey, setLoadedKey] = useState("");
  const queryKey = [date, status, platform, page, revision].join("|");
  const loading = loadedKey !== queryKey;
  const detail = loadedDetail?.report.runId === runId ? loadedDetail : null;
  const history = loadedHistory?.issue.id === issueId ? loadedHistory : null;
  const [importing, setImporting] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      api<{ items: Run[] }>(`?date=${date}`, { signal: controller.signal }),
      api<{ items: Issue[]; total: number }>(`/issues?status=${status}&platform=${platform}&page=${page}`, {
        signal: controller.signal,
      }),
    ])
      .then(([r, i]) => {
        setError("");
        setRuns(r.items);
        setIssues(i);
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(e.message);
          setRuns([]);
          setIssues({ items: [], total: 0 });
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedKey(queryKey);
      });
    return () => controller.abort();
  }, [date, status, platform, page, revision, queryKey]);
  useEffect(() => {
    const controller = new AbortController();
    if (runId)
      api<{ report: Review; issues: Issue[] }>(`/${runId}`, { signal: controller.signal })
        .then(setDetail)
        .catch((e) => {
          if (!controller.signal.aborted) setError(e.message);
        });
    return () => controller.abort();
  }, [runId, revision]);
  useEffect(() => {
    const controller = new AbortController();
    if (issueId)
      api<History>(`/issues/${issueId}`, { signal: controller.signal })
        .then(setHistory)
        .catch((e) => {
          if (!controller.signal.aborted) setError(e.message);
        });
    return () => controller.abort();
  }, [issueId, revision]);
  async function importReport(file?: File) {
    if (!file || importing) return;
    setImporting(true);
    setError("");
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error("日报文件不能超过 2 MiB");
      const content = JSON.parse(await file.text());
      const result = await api<{ id: string }>("", { method: "POST", body: JSON.stringify(content) });
      setDate(content.date);
      setRunId(result.id);
      setTab("daily");
      setRevision((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "导入失败");
    } finally {
      setImporting(false);
    }
  }
  function openIssue(id: string) {
    setIssueId(id);
    setTab("issues");
  }
  return (
    <main className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">错误日志 Review</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            iOS / Android · 北京时间昨日 00:00–24:00 · 手动 review，按日期归档
          </p>
        </div>
        <label className={button}>
          {importing ? "正在导入…" : "导入日报 JSON"}
          <input
            aria-label="导入日报 JSON"
            type="file"
            accept=".json,application/json"
            className="sr-only"
            disabled={importing}
            onChange={(e) => {
              void importReport(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      </header>
      {error && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button className={button} aria-pressed={tab === "daily"} onClick={() => setTab("daily")}>
          每日 review
        </button>
        <button className={button} aria-pressed={tab === "issues"} onClick={() => setTab("issues")}>
          问题台账
        </button>
        <button className={button} onClick={() => setRevision((v) => v + 1)}>
          刷新
        </button>
      </div>
      {tab === "daily" ? (
        <>
          <label className="flex items-center gap-3 text-sm">
            查看日期
            <input
              className={control}
              type="date"
              value={date}
              max={yesterday()}
              onChange={(e) => {
                setDate(e.target.value);
                setRunId("");
              }}
            />
          </label>
          {loading ? (
            <p role="status">正在加载…</p>
          ) : runs.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm">
              该日期尚无 review。手动运行日志 review 技能后，发布或导入日报即可查看。
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {runs.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRunId(r.id)}
                  className={`rounded-lg border p-4 text-left ${r.id === runId ? "border-primary bg-muted" : ""}`}
                >
                  <div className="font-medium">
                    {r.review_date} <span className="text-muted-foreground text-xs">发布于 {time(r.created_at)}</span>
                  </div>
                  <p className="mt-2 line-clamp-3 text-sm whitespace-pre-wrap">{r.summary}</p>
                  <p className="text-muted-foreground mt-2 font-mono text-xs">{r.id}</p>
                </button>
              ))}
            </div>
          )}
          {detail && (
            <section className="space-y-5 rounded-lg border p-5">
              <div>
                <h2 className="text-xl font-semibold">{detail.report.date} 日报</h2>
                {detail.report.firebaseCoverage && (
                  <div className="mt-3 text-sm">
                    {(["android", "ios"] as const).map((p) => {
                      const c = detail.report.firebaseCoverage![p];
                      return (
                        <p key={p}>
                          Firebase {p}：下载 {c.downloaded} · 失败请求 {c.failed} ·{" "}
                          {c.listingComplete ? "本次请求完成" : "存在采集缺口"} ·{" "}
                          {c.limited ? "有限抽样" : "无分页截断"} {c.notes.join("；")}
                        </p>
                      );
                    })}
                  </div>
                )}
                <p className="text-muted-foreground mt-1 text-xs">
                  每份日报保留原始分析快照；下方处理状态显示当前台账状态。
                </p>
                <p className="mt-3 whitespace-pre-wrap">{detail.report.summary}</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {(["android", "ios"] as const).map((p) => {
                  const c = detail.report.coverage[p];
                  const records = detail.report.evidence.filter((e) => e.platform === p && e.source !== "firebase");
                  return (
                    <div key={p} className="bg-muted rounded-md p-4 text-sm">
                      <strong>{p === "ios" ? "iOS" : "Android"}</strong>
                      <p>
                        列举 {c.listed} · 下载 {c.downloaded} · 窗口内样本 {records.length} · 下载失败 {c.failed}
                      </p>
                      <p>
                        元数据扫描：{c.listingComplete ? "完成" : "不完整"}；
                        {c.limited ? "已达到采样上限" : "未触及采样上限"}
                      </p>
                      <p>
                        排除窗口外 {c.excluded} · 旧式文本 {c.unparsed} · 上传时间代替事件时间{" "}
                        {records.filter((e) => e.timeBasis === "upload").length}
                      </p>
                      {c.notes.map((n, i) => (
                        <p key={i} className="mt-1">
                          {n}
                        </p>
                      ))}
                    </div>
                  );
                })}
              </div>
              <p className="text-muted-foreground text-sm">
                抽样日志数不等于用户数或故障率；元数据列举包含相邻日期目录，用于覆盖客户端时区差异。
              </p>
              {detail.report.notes.map((n, i) => (
                <p key={i} className="text-sm">
                  • {n}
                </p>
              ))}
              {detail.report.findings.length === 0 && <p>本次未登记问题；请结合覆盖范围判断，不能视为双端无故障。</p>}
              {detail.report.findings.map((f) => {
                const issue = detail.issues.find((i) => i.id === f.fingerprint);
                const evidence = detail.report.evidence.filter((e) => f.evidenceIds.includes(e.id));
                const devices = new Set(evidence.flatMap((e) => (e.deviceHash ? [e.deviceHash] : [])));
                return (
                  <article key={f.fingerprint} className="space-y-3 border-t pt-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="bg-muted rounded px-2 py-1 text-xs">
                        {f.priority} · {f.platform}
                      </span>
                      <h3 className="font-semibold">{f.title}</h3>
                      <button className={button} onClick={() => openIssue(f.fingerprint)}>
                        {issue ? statusLabels[issue.status] : "查看台账"} →
                      </button>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {evidence.length} 份引用样本 · 已识别设备 {devices.size} ·{" "}
                      {f.confidence === "confirmed" ? "证据支持" : "待验证推测"}
                    </p>
                    <p className="text-sm whitespace-pre-wrap">{f.conclusion}</p>
                    {f.hypothesis && <p className="text-sm whitespace-pre-wrap">待验证：{f.hypothesis}</p>}
                    <p className="text-sm whitespace-pre-wrap">下一步：{f.nextStep}</p>
                    {issue && ["closed", "ignored"].includes(issue.status) && (
                      <p className="text-sm text-amber-700">
                        该问题已有关闭或忽略记录，请核对样本时间和修复版本，必要时重新打开。
                      </p>
                    )}
                    <details>
                      <summary className="cursor-pointer text-sm">查看证据与来源定位信息（{evidence.length}）</summary>
                      <div className="mt-2 space-y-3">
                        {evidence.map((e) => (
                          <div key={e.id} className="bg-muted rounded p-3 text-xs">
                            <p>
                              {time(e.at)} · {e.timeBasis === "event" ? "事件时间" : "上传时间（事件时间未知）"} ·{" "}
                              {e.version} · {e.model} · {e.os}
                            </p>
                            <p className="mt-1 font-mono break-all">
                              {e.source === "firebase" ? "Firebase" : "COS"} · {e.objectKey}
                            </p>
                            <p className="mt-2">{e.summary}</p>
                            <pre className="mt-2 overflow-x-auto break-all whitespace-pre-wrap">{e.stack}</pre>
                            <pre className="mt-2 whitespace-pre-wrap">{JSON.stringify(e.diagnostics, null, 2)}</pre>
                          </div>
                        ))}
                      </div>
                    </details>
                  </article>
                );
              })}
            </section>
          )}
        </>
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            <label className="text-sm">
              状态{" "}
              <select
                className={control}
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">全部</option>
                {Object.entries(statusLabels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              平台{" "}
              <select
                className={control}
                value={platform}
                onChange={(e) => {
                  setPlatform(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">全部</option>
                <option value="android">Android</option>
                <option value="ios">iOS</option>
              </select>
            </label>
          </div>
          <p className="text-muted-foreground text-sm">
            新发现 → 待定位 → 已定位 → 代码已修复。完成代码修改即可标记修复，填写修改位置及原因；复发时改回“待定位”。
          </p>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted">
                <tr>
                  {["问题", "优先级", "状态", "负责人", "修复版本", "最近出现", "操作"].map((v) => (
                    <th key={v} className="p-3">
                      {v}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {issues.items.map((i) => (
                  <tr key={i.id} className="border-t">
                    <td className="p-3">
                      {i.title}
                      <p className="text-muted-foreground text-xs">
                        {i.platform} · {i.id.slice(0, 12)}
                      </p>
                    </td>
                    <td>{i.priority}</td>
                    <td>{statusLabels[i.status]}</td>
                    <td>{i.owner || "未分配"}</td>
                    <td>{i.fix_version || "—"}</td>
                    <td>{i.last_seen}</td>
                    <td>
                      <button className={button} onClick={() => setIssueId(i.id)}>
                        维护 / 历史
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && !issues.items.length && <p className="p-6 text-center text-sm">暂无符合条件的问题</p>}
          </div>
          <div className="flex items-center gap-3 text-sm">
            <button className={button} disabled={page === 1} onClick={() => setPage((v) => v - 1)}>
              上一页
            </button>
            <span>
              第 {page} 页 · 共 {issues.total} 个问题
            </span>
            <button className={button} disabled={page * 50 >= issues.total} onClick={() => setPage((v) => v + 1)}>
              下一页
            </button>
          </div>
          {history && (
            <section className="space-y-4 rounded-lg border p-5">
              <h2 className="text-lg font-semibold">{history.issue.title}</h2>
              <IssueEditor
                key={`${history.issue.id}:${history.issue.version}`}
                issue={history.issue}
                onSaved={() => setRevision((v) => v + 1)}
              />
              <h3 className="font-medium">出现记录</h3>
              <div className="flex flex-wrap gap-2">
                {history.sightings.map((s) => (
                  <button
                    key={s.run_id}
                    className={button}
                    onClick={() => {
                      setDate(s.review_date);
                      setRunId(s.run_id);
                      setTab("daily");
                    }}
                  >
                    {s.review_date} · {s.run_id.slice(0, 8)}
                  </button>
                ))}
              </div>
              <h3 className="font-medium">状态维护记录</h3>
              {history.actions.length === 0 && <p className="text-sm">尚无人工变更</p>}
              {history.actions.map((a) => (
                <div key={a.id} className="border-t pt-3 text-sm">
                  <p>
                    {time(a.created_at)} · {a.actor} · {statusLabels[a.after_state.status]} ·{" "}
                    {a.after_state.fix_version}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{a.note}</p>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </main>
  );
}
function IssueEditor({ issue, onSaved }: { issue: Issue; onSaved: () => void }) {
  const [status, setStatus] = useState<IssueStatus>(issue.status);
  const [owner, setOwner] = useState(issue.owner);
  const [fixVersion, setFixVersion] = useState(issue.fix_version);
  const [fixLink, setFixLink] = useState(issue.fix_link);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (saving) return;
        setSaving(true);
        setError("");
        try {
          await api(`/issues/${issue.id}`, {
            method: "PATCH",
            body: JSON.stringify({ version: issue.version, status, owner, fixVersion, fixLink, note }),
          });
          onSaved();
        } catch (e) {
          setError(e instanceof Error ? e.message : "保存失败");
        } finally {
          setSaving(false);
        }
      }}
    >
      <fieldset disabled={saving} className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          状态
          <select
            className={`${control} mt-1 w-full`}
            value={status}
            onChange={(e) => setStatus(e.target.value as IssueStatus)}
          >
            {[issue.status, ...transitions[issue.status]].map((s) => (
              <option key={s} value={s}>
                {statusLabels[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          负责人
          <input
            className={`${control} mt-1 w-full`}
            maxLength={100}
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
          />
        </label>
        <label className="text-sm">
          修复版本
          <input
            className={`${control} mt-1 w-full`}
            maxLength={100}
            value={fixVersion}
            required={["verifying", "closed"].includes(status)}
            onChange={(e) => setFixVersion(e.target.value)}
          />
        </label>
        <label className="text-sm">
          修复链接（HTTPS，可选）
          <input
            className={`${control} mt-1 w-full`}
            type="url"
            maxLength={500}
            value={fixLink}
            onChange={(e) => setFixLink(e.target.value)}
          />
        </label>
        <label className="text-sm sm:col-span-2">
          变更原因 / 验证依据
          <textarea
            className={`${control} mt-1 w-full`}
            rows={3}
            maxLength={2000}
            required
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
      </fieldset>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <button className={button} disabled={saving}>
        {saving ? "正在保存…" : "保存状态变更"}
      </button>
      <span className="text-muted-foreground ml-3 text-xs">管理员或 Review 技能可维护；所有变更均留痕。</span>
    </form>
  );
}
