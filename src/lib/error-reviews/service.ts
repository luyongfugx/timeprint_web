import "server-only";
import { createHash, randomUUID } from "node:crypto";

import { z } from "zod";

import { rows, write, transaction, parseJSON, isDuplicateKey } from "../templates/database";
import { TemplateError } from "../templates/errors";

import { canTransition, reviewSchema, updateSchema, type Review, type IssueStatus } from "./contracts";

export type Issue = {
  id: string;
  platform: string;
  title: string;
  priority: string;
  status: IssueStatus;
  owner: string;
  fix_version: string;
  fix_link: string;
  first_seen: string;
  last_seen: string;
  version: number;
  updated_at: string;
};
function conflict(message: string): never {
  throw new TemplateError("REQUEST_IN_PROGRESS", 409, message);
}
export async function saveReview(input: unknown, actor: string) {
  const report = reviewSchema.parse(input);
  const hash = createHash("sha256").update(JSON.stringify(report)).digest("hex");
  const existing = async () => {
    const [row] = await rows<{ payload_hash: string }>("SELECT payload_hash FROM error_review_runs WHERE id=?", [
      report.runId,
    ]);
    if (!row) return false;
    if (row.payload_hash !== hash) conflict("相同 runId 的日报内容不同；请使用新的 runId 创建修订");
    return true;
  };
  if (await existing()) return { id: report.runId, replay: true };
  try {
    await transaction(async (tx) => {
      await write(
        "INSERT INTO error_review_runs(id,review_date,payload_hash,summary,payload,created_by) VALUES(?,?,?,?,?,?)",
        [report.runId, report.date, hash, report.summary, JSON.stringify(report), actor],
        tx,
      );
      for (const f of report.findings) {
        await write(
          `INSERT INTO error_review_issues(id,platform,title,priority,first_seen,last_seen) VALUES(?,?,?,?,?,?)
          ON DUPLICATE KEY UPDATE first_seen=LEAST(first_seen,VALUES(first_seen)),last_seen=GREATEST(last_seen,VALUES(last_seen))`,
          [f.fingerprint, f.platform, f.title, f.priority, report.date, report.date],
          tx,
        );
        await write(
          "INSERT INTO error_review_findings(run_id,issue_id,detail) VALUES(?,?,?)",
          [report.runId, f.fingerprint, JSON.stringify(f)],
          tx,
        );
      }
    });
  } catch (e) {
    if (isDuplicateKey(e) && (await existing())) return { id: report.runId, replay: true };
    throw e;
  }
  return { id: report.runId, replay: false };
}
export async function listReviews(date?: string) {
  return rows<{ id: string; review_date: string; summary: string; created_at: string; created_by: string }>(
    "SELECT id,review_date,summary,created_at,created_by FROM error_review_runs WHERE (?='' OR review_date=?) ORDER BY review_date DESC,created_at DESC LIMIT 100",
    [date ?? "", date ?? ""],
  );
}
export async function getReview(id: string) {
  const [row] = await rows<{ payload: Review | string }>("SELECT payload FROM error_review_runs WHERE id=?", [id]);
  if (!row) throw new TemplateError("NOT_FOUND", 404, "未找到日报");
  const issues = await rows<Issue>(
    "SELECT i.* FROM error_review_issues i JOIN error_review_findings f ON f.issue_id=i.id WHERE f.run_id=? ORDER BY i.priority,i.id",
    [id],
  );
  return { report: parseJSON(row.payload), issues };
}
export async function listIssues(status?: string, platform?: string, page = 1) {
  const filter = "WHERE (?='' OR status=?) AND (?='' OR platform=?)";
  const values = [status ?? "", status ?? "", platform ?? "", platform ?? ""];
  const [count] = await rows<{ total: number }>(`SELECT COUNT(*) total FROM error_review_issues ${filter}`, values);
  const items = await rows<Issue>(
    `SELECT * FROM error_review_issues ${filter} ORDER BY last_seen DESC,priority,id LIMIT 50 OFFSET ${(page - 1) * 50}`,
    values,
  );
  return { items, total: Number(count.total), page };
}
export async function issueHistory(id: string) {
  const [issue] = await rows<Issue>("SELECT * FROM error_review_issues WHERE id=?", [id]);
  if (!issue) throw new TemplateError("NOT_FOUND", 404, "未找到问题");
  const sightings = await rows<{ run_id: string; review_date: string; detail: unknown }>(
    "SELECT f.run_id,r.review_date,f.detail FROM error_review_findings f JOIN error_review_runs r ON r.id=f.run_id WHERE f.issue_id=? ORDER BY r.review_date DESC,r.created_at DESC LIMIT 100",
    [id],
  );
  const actions = await rows<{
    id: string;
    actor: string;
    note: string;
    before_state: unknown;
    after_state: unknown;
    created_at: string;
  }>("SELECT * FROM error_review_actions WHERE issue_id=? ORDER BY created_at DESC,id DESC LIMIT 100", [id]);
  return {
    issue,
    sightings: sightings.map((s) => ({ ...s, detail: parseJSON(s.detail) })),
    actions: actions.map((a) => ({
      ...a,
      before_state: parseJSON(a.before_state),
      after_state: parseJSON(a.after_state),
    })),
  };
}
export async function updateIssue(id: string, input: z.infer<typeof updateSchema>, actor: string) {
  return transaction(async (tx) => {
    const [old] = await rows<Issue>("SELECT * FROM error_review_issues WHERE id=? FOR UPDATE", [id], tx);
    if (!old) throw new TemplateError("NOT_FOUND", 404, "未找到问题");
    if (old.version !== input.version) conflict("问题已被其他人修改，请刷新后重试");
    if (!canTransition(old.status, input.status))
      throw new TemplateError("INVALID_REQUEST", 400, "请按处理流程变更状态");
    const next = {
      status: input.status,
      owner: input.owner,
      fix_version: input.fixVersion,
      fix_link: input.fixLink,
      version: old.version + 1,
    };
    await write(
      "UPDATE error_review_issues SET status=?,owner=?,fix_version=?,fix_link=?,version=?,updated_at=UTC_TIMESTAMP(3) WHERE id=?",
      [next.status, next.owner, next.fix_version, next.fix_link, next.version, id],
      tx,
    );
    await write(
      "INSERT INTO error_review_actions(id,issue_id,actor,note,before_state,after_state) VALUES(?,?,?,?,?,?)",
      [randomUUID(), id, actor, input.note, JSON.stringify(old), JSON.stringify(next)],
      tx,
    );
    return next;
  });
}
