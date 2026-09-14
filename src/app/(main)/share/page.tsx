"use client";
import { Suspense, useEffect, useState } from "react";

import { useSearchParams } from "next/navigation";

import { Copy, ExternalLink, Flag, Share2 } from "lucide-react";

import { type TemplateDetail, reportReasons } from "@/lib/templates/contracts";

const reasonLabels = [
  "Intellectual Property Infringement",
  "Fraud & Deceptive Practices",
  "Impersonation & Unauthorized Use",
  "Privacy Violation",
];
function SharePage() {
  const code = useSearchParams().get("code");
  const [data, setData] = useState<TemplateDetail | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(""),
    [reportOpen, setReportOpen] = useState(false),
    [reason, setReason] = useState(""),
    [sending, setSending] = useState(false);
  const [reportID, setReportID] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    // Clear the previous share when the URL selects a different remote record.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(null);
    setError("");
    setLoading(true);
    setNotice("");
    setReportOpen(false);
    setReportID(crypto.randomUUID());
    if (!code) {
      setError("This link is missing a share code.");
      setLoading(false);
      return;
    }
    fetch(`/api/applink/v2/by-code/${encodeURIComponent(code)}`, { cache: "no-store", signal: controller.signal })
      .then(async (res) => {
        const result = await res.json();
        if (!res.ok) throw new Error(result.error?.message ?? "Unable to load this template.");
        setData(result);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [code]);
  const copy = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.shareCode);
      setNotice("Code copied. Open Timeprint and search with this code.");
    } catch {
      setNotice(`Copy this code: ${data.shareCode}`);
    }
  };
  const share = async () => {
    if (!data) return;
    try {
      if (navigator.share)
        await navigator.share({ title: data.watermarkName || "Timeprint template", url: data.shareLink });
      else {
        await navigator.clipboard.writeText(data.shareLink);
        setNotice("Share link copied.");
      }
    } catch {
      setNotice("Sharing was cancelled. You can copy the code instead.");
    }
  };
  const report = async () => {
    if (!data || !reason) return;
    setSending(true);
    setNotice("");
    try {
      let userID = localStorage.getItem("timeprint-installation");
      if (!userID) {
        userID = crypto.randomUUID();
        localStorage.setItem("timeprint-installation", userID);
      }
      const res = await fetch(`/api/applink/v2/templates/${encodeURIComponent(data.templateID)}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientRequestID: reportID,
          userID,
          reason,
          source: "web_detail",
          ...(data.visibility !== "public" ? { shareCode: data.shareCode } : {}),
        }),
      });
      const result = await res.json();
      if (!res.ok || result.status !== "received")
        throw new Error(result.error?.message ?? "Report could not be submitted.");
      setData(null);
      setReportOpen(false);
      setNotice("Report received. This template has been hidden from this page.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setSending(false);
    }
  };
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-lg">
        <a href="https://www.timeprint.net" className="text-xl font-semibold tracking-tight">
          Timeprint
        </a>
        <p className="mt-2 text-sm text-slate-500">Make every photo tell its story.</p>
        {loading ? (
          <p className="py-20 text-center" role="status">
            Loading template…
          </p>
        ) : error ? (
          <section className="my-8 rounded-2xl border bg-white p-8 dark:bg-slate-900">
            <h1 className="text-xl font-semibold">Template unavailable</h1>
            <p className="mt-3 text-slate-500" role="alert">
              {error}
            </p>
            <button className="mt-6 text-blue-600" onClick={() => location.reload()}>
              Try again
            </button>
          </section>
        ) : (
          data && (
            <article className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="bg-slate-100 p-4 dark:bg-slate-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={data.cover.url}
                  referrerPolicy="no-referrer"
                  alt={data.watermarkName || "Shared watermark preview"}
                  width={data.cover.width}
                  height={data.cover.height}
                  className="max-h-[520px] w-full object-contain"
                  onError={() => setNotice("The preview could not load. Please try again.")}
                />
              </div>
              <div className="space-y-5 p-6">
                <div>
                  <p className="text-xs font-medium tracking-widest text-blue-600 uppercase">
                    {data.visibility === "private" ? "Private template" : "Shared template"}
                  </p>
                  <h1 className="mt-2 text-2xl font-semibold">
                    {data.visibility === "private"
                      ? "A watermark shared with you"
                      : data.watermarkName || "Received template"}
                  </h1>
                  {data.visibility === "public" && (
                    <p className="mt-1 text-slate-500">{data.companyName || "Anonymous"}</p>
                  )}
                </div>
                <button
                  onClick={copy}
                  className="flex w-full items-center justify-between rounded-xl bg-slate-100 p-4 dark:bg-slate-800"
                >
                  <span className="font-mono text-lg tracking-[.2em]">{data.shareCode}</span>
                  <Copy size={18} aria-label="Copy code" />
                </button>
                {data.expiresAt && (
                  <p className="text-sm text-slate-500">Available until {new Date(data.expiresAt).toLocaleString()}</p>
                )}
                <a
                  href={`timeprint://template?code=${encodeURIComponent(data.shareCode)}`}
                  className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-4 font-semibold text-white"
                >
                  Open Timeprint <ExternalLink size={17} />
                </a>
                <p className="text-sm leading-6 text-slate-500">
                  If the app does not open, copy the code and search for it in Timeprint.{" "}
                  <a
                    className="text-blue-600 underline"
                    href="https://apps.apple.com/app/id6480020509"
                    rel="noreferrer"
                  >
                    Get Timeprint on the App Store
                  </a>
                  .
                </p>
                {data.visibility === "public" && (
                  <div className="flex gap-6 border-t pt-4">
                    <button onClick={share} className="flex items-center gap-2 text-sm">
                      <Share2 size={16} />
                      Share
                    </button>
                    {data.canReport && (
                      <button onClick={() => setReportOpen(!reportOpen)} className="flex items-center gap-2 text-sm">
                        <Flag size={16} />
                        Report
                      </button>
                    )}
                  </div>
                )}
                {reportOpen && (
                  <fieldset className="space-y-3 rounded-xl border p-4">
                    <legend className="px-1 font-medium">Reason for reporting</legend>
                    {reportReasons.map((value, i) => (
                      <label key={value} className="flex items-start gap-2 text-sm">
                        <input
                          type="radio"
                          name="reason"
                          value={value}
                          checked={reason === value}
                          onChange={() => {
                            setReason(value);
                            setReportID(crypto.randomUUID());
                          }}
                        />
                        {reasonLabels[i]}
                      </label>
                    ))}
                    <button
                      disabled={!reason || sending}
                      onClick={report}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-40"
                    >
                      {sending ? "Sending…" : "Submit report"}
                    </button>
                  </fieldset>
                )}
              </div>
            </article>
          )
        )}
        {notice && (
          <p className="my-5 rounded-xl border p-4 text-sm" role="status">
            {notice}
          </p>
        )}
        <p className="mt-8 text-center text-xs leading-6 text-slate-500">
          Some templates are created by users. If infringed,{" "}
          <a
            href={`/templates/contact?kind=removal${data ? `&code=${encodeURIComponent(data.shareCode)}` : ""}`}
            className="underline"
          >
            contact us for removal
          </a>
          .
        </p>
      </div>
    </main>
  );
}
export default function Page() {
  return (
    <Suspense fallback={<p className="p-10">Loading…</p>}>
      <SharePage />
    </Suspense>
  );
}
