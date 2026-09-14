"use client";
import { Suspense, useState } from "react";

import { useSearchParams } from "next/navigation";

function Contact() {
  const q = useSearchParams(),
    initialKind = q.get("kind") === "company" ? "company" : "removal";
  const [kind, setKind] = useState(initialKind),
    [company, setCompany] = useState(""),
    [code, setCode] = useState(q.get("code") ?? ""),
    [description, setDescription] = useState(""),
    [contact, setContact] = useState(""),
    [fields, setFields] = useState("");
  const [files, setFiles] = useState<File[]>([]),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState(""),
    [done, setDone] = useState(false);
  const [retry, setRetry] = useState<{
    signature: string;
    requestID: string;
    attachments: string[];
    sessionID?: string;
    token?: string;
  } | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setMessage("");
    const api = async (path: string, payload: unknown, headers: Record<string, string> = {}) => {
      const res = await fetch(`/api/applink/v2/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Unable to submit. Please try again.");
      return data;
    };
    try {
      const signature = JSON.stringify({
        kind,
        company,
        code,
        description,
        contact,
        fields,
        files: files.map((f) => [f.name, f.size, f.lastModified]),
      });
      let state =
        retry?.signature === signature
          ? retry
          : {
              signature,
              requestID: crypto.randomUUID(),
              attachments: [] as string[],
              sessionID: undefined as string | undefined,
              token: undefined as string | undefined,
            };
      if (files.length && !state.attachments.length) {
        const s = await api("request-upload-sessions", { clientRequestID: state.requestID, kind });
        state = { ...state, sessionID: s.uploadSessionID, token: s.uploadToken };
        for (const file of files) {
          if (file.size > 5 * 1024 * 1024 || !["image/png", "image/jpeg", "image/webp"].includes(file.type))
            throw new Error("Use JPEG, PNG or WebP images up to 5 MB each.");
          const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
          const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
          const a = await api(
            `request-upload-sessions/${s.uploadSessionID}/assets`,
            {
              clientAssetID: crypto.randomUUID(),
              kind: "evidence",
              contentType: file.type,
              byteLength: file.size,
              sha256: hash,
            },
            { "X-Template-Upload-Token": s.uploadToken },
          );
          const uploaded = await fetch(
            `/api/applink/v2/request-upload-sessions/${s.uploadSessionID}/assets/${a.assetID}`,
            {
              method: "PUT",
              headers: { "Content-Type": file.type, "X-Template-Upload-Token": s.uploadToken },
              body: file,
              referrerPolicy: "no-referrer",
            },
          );
          if (!uploaded.ok) throw new Error("Image upload failed. Please try again.");
          state.attachments.push(a.assetID);
        }
        await api(
          `request-upload-sessions/${s.uploadSessionID}/complete`,
          { attachmentIDs: state.attachments },
          { "X-Template-Upload-Token": s.uploadToken },
        );
      }
      setRetry(state);
      const headers: Record<string, string> =
        state.sessionID && state.token
          ? { "X-Template-Upload-Session": state.sessionID, "X-Template-Upload-Token": state.token }
          : {};
      const result = await api(
        "requests",
        {
          clientRequestID: state.requestID,
          kind,
          companyName: company,
          ...(code.trim()
            ? /^https:\/\//.test(code.trim())
              ? { shareLink: code.trim() }
              : { shareCode: code.trim() }
            : {}),
          description,
          contact,
          requiredFields: fields
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean),
          attachmentIDs: state.attachments,
        },
        headers,
      );
      if (result.status !== "received") throw new Error("Unable to confirm submission.");
      setDone(true);
      setMessage(`Request received. Reference: ${result.requestID}`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setPending(false);
    }
  }
  const inputClass = "w-full rounded-xl border bg-transparent px-3 py-3";
  return (
    <main className="mx-auto max-w-xl px-5 py-12">
      <a className="font-semibold text-blue-600" href="https://www.timeprint.net">
        Timeprint
      </a>
      <h1 className="mt-6 text-2xl font-semibold">
        {kind === "company" ? "Request a company template" : "Contact us for removal"}
      </h1>
      <p className="mt-3 text-sm text-slate-500">
        We review each request. Your contact details and attachments are shared only with our review team.
      </p>
      {!done && (
        <form onSubmit={submit} className="mt-6 space-y-5">
          <fieldset disabled={pending} className="space-y-5">
            <label className="block">
              Request type
              <select className={inputClass} value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="removal">Removal request</option>
                <option value="company">Company template</option>
              </select>
            </label>
            {kind === "company" ? (
              <>
                <label className="block">
                  Company name
                  <input
                    required
                    maxLength={100}
                    className={inputClass}
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                  />
                </label>
                <label className="block">
                  Required fields (separated by commas)
                  <input
                    className={inputClass}
                    value={fields}
                    onChange={(e) => setFields(e.target.value)}
                    placeholder="Time, Address, Notes"
                  />
                </label>
              </>
            ) : (
              <label className="block">
                Share code or link
                <input
                  required={!files.length}
                  maxLength={2048}
                  className={inputClass}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </label>
            )}
            <label className="block">
              Description
              <textarea
                required
                maxLength={2000}
                rows={5}
                className={inputClass}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <label className="block">
              Contact (optional)
              <input
                maxLength={254}
                className={inputClass}
                value={contact}
                onChange={(e) => setContact(e.target.value)}
              />
              <span className="text-xs text-slate-500">Without contact details, we cannot reply to you.</span>
            </label>
            <label className="block">
              Reference images (up to 3)
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                className={inputClass}
                onChange={(e) => {
                  const selected = Array.from(e.target.files ?? []);
                  if (selected.length > 3) {
                    setMessage("Choose up to three images.");
                    e.target.value = "";
                    setFiles([]);
                  } else setFiles(selected);
                }}
              />
            </label>
            <button className="rounded-xl bg-blue-600 px-5 py-3 text-white disabled:opacity-50" disabled={pending}>
              {pending ? "Submitting…" : "Submit request"}
            </button>
          </fieldset>
        </form>
      )}
      {message && (
        <p className="mt-6 rounded-xl border p-4" role="status">
          {message}
        </p>
      )}
    </main>
  );
}
export default function Page() {
  return (
    <Suspense fallback={<p className="p-10">Loading…</p>}>
      <Contact />
    </Suspense>
  );
}
