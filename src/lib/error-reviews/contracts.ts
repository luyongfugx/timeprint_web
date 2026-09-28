import { z } from "zod";

export const statusLabels = {
  new: "新发现",
  investigating: "待定位",
  diagnosed: "已定位",
  fixed: "代码已修复",
  verifying: "已发布待验证",
  closed: "已关闭",
  ignored: "已忽略",
} as const;
export const statuses = Object.keys(statusLabels) as [keyof typeof statusLabels, ...(keyof typeof statusLabels)[]];
export type IssueStatus = keyof typeof statusLabels;
const text = (max: number) => z.string().trim().max(max);
export const platformSchema = z.enum(["android", "ios"]);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export function yesterday(now = new Date()) {
  return new Date(now.getTime() + 8 * 3600_000 - 86400_000).toISOString().slice(0, 10);
}
export function reviewWindow(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("日期格式应为 YYYY-MM-DD");
  const start = new Date(`${date}T00:00:00+08:00`);
  if (!Number.isFinite(start.getTime()) || new Date(start.getTime() + 8 * 3600_000).toISOString().slice(0, 10) !== date)
    throw new Error("日期无效");
  return { start: start.toISOString(), end: new Date(start.getTime() + 86400_000).toISOString() };
}
export const evidenceSchema = z
  .object({
    id: hash,
    platform: platformSchema,
    fingerprint: hash,
    objectKey: text(1024).min(1),
    at: z.string().datetime(),
    timeBasis: z.enum(["event", "upload"]),
    errorCode: text(180).min(1),
    version: text(80),
    model: text(120),
    os: text(80),
    deviceHash: hash.nullable(),
    sessionHash: hash.nullable(),
    severity: text(32),
    summary: text(1200),
    stack: text(6000),
    diagnostics: z
      .record(z.union([text(300), z.number().finite(), z.boolean(), z.null()]))
      .refine((v) => Object.keys(v).length <= 30),
  })
  .strict();
const coverageSchema = z
  .object({
    listed: z.number().int().nonnegative(),
    downloaded: z.number().int().min(0).max(300),
    failed: z.number().int().nonnegative(),
    excluded: z.number().int().nonnegative(),
    unparsed: z.number().int().nonnegative(),
    limited: z.boolean(),
    listingComplete: z.boolean(),
    notes: z.array(text(500)).max(20),
  })
  .strict();
export const findingSchema = z
  .object({
    fingerprint: hash,
    platform: platformSchema,
    title: text(180).min(1),
    priority: z.enum(["P0", "P1", "P2", "P3"]),
    evidenceIds: z.array(hash).min(1).max(300),
    confidence: z.enum(["confirmed", "suspected"]),
    conclusion: text(2500).min(1),
    hypothesis: text(1500),
    nextStep: text(1500).min(1),
  })
  .strict();
export const reviewSchema = z
  .object({
    schemaVersion: z.literal(1),
    reviewed: z.literal(true),
    runId: z.string().uuid(),
    date: z.string(),
    timezone: z.literal("Asia/Shanghai"),
    window: z.object({ start: z.string().datetime(), end: z.string().datetime() }).strict(),
    generatedAt: z.string().datetime(),
    summary: text(4000).min(1),
    notes: z.array(text(800)).max(30),
    coverage: z.object({ android: coverageSchema, ios: coverageSchema }).strict(),
    evidence: z.array(evidenceSchema).max(300),
    findings: z.array(findingSchema).max(100),
  })
  .strict()
  .superRefine((r, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    try {
      const w = reviewWindow(r.date);
      if (w.start !== r.window.start || w.end !== r.window.end || r.date > yesterday())
        fail("仅接受已结束的北京时间自然日");
    } catch {
      fail("日期无效");
    }
    const ids = new Map(r.evidence.map((e) => [e.id, e]));
    if (ids.size !== r.evidence.length) fail("证据重复");
    if (new Set(r.findings.map((f) => f.fingerprint)).size !== r.findings.length) fail("问题指纹重复");
    for (const e of r.evidence) {
      if (Date.parse(e.at) < Date.parse(r.window.start) || Date.parse(e.at) >= Date.parse(r.window.end))
        fail("证据不在 review 时间窗口");
      if (!e.objectKey.startsWith(`${e.platform}_err_log_`) || e.objectKey.includes("..")) fail("证据来源目录无效");
    }
    for (const p of ["android", "ios"] as const) {
      if (r.coverage[p].downloaded < r.evidence.filter((e) => e.platform === p).length) fail("采样数量不一致");
    }
    for (const f of r.findings) {
      if (new Set(f.evidenceIds).size !== f.evidenceIds.length) fail("引用证据重复");
      for (const id of f.evidenceIds) {
        const e = ids.get(id);
        if (!e || e.platform !== f.platform || e.fingerprint !== f.fingerprint) fail("问题与证据指纹不匹配");
      }
    }
  });
export type Review = z.infer<typeof reviewSchema>;
export const updateSchema = z
  .object({
    version: z.number().int().positive(),
    status: z.enum(statuses),
    note: text(2000).min(1),
    owner: text(100),
    fixVersion: text(100),
    fixLink: z.union([
      z.literal(""),
      z
        .string()
        .url()
        .max(500)
        .refine((v) => /^https:\/\//.test(v)),
    ]),
  })
  .strict()
  .superRefine((u, ctx) => {
    if (["verifying", "closed"].includes(u.status) && !u.fixVersion)
      ctx.addIssue({ code: "custom", message: "修复、验证、关闭时需要填写修复版本" });
  });
export const transitions: Record<IssueStatus, IssueStatus[]> = {
  new: ["investigating", "diagnosed", "ignored"],
  investigating: ["diagnosed", "ignored"],
  diagnosed: ["investigating", "fixed", "ignored"],
  fixed: ["investigating"],
  verifying: ["investigating", "closed"],
  closed: ["investigating"],
  ignored: ["investigating"],
};
export function canTransition(from: IssueStatus, to: IssueStatus) {
  return from === to || transitions[from].includes(to);
}
