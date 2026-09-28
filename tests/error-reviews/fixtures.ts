import { randomUUID, createHash } from "node:crypto";

import { normalizeLog } from "../../src/lib/error-reviews/collect";
import { reviewWindow, type Review } from "../../src/lib/error-reviews/contracts";

export function fixture(): Review {
  const date = "2026-01-10";
  const namespace = randomUUID();
  const evidence = (["android", "ios"] as const).map(
    (platform) =>
      normalizeLog(
        { platform, key: `${platform}_err_log_20260110/fixture.txt`, size: 100, modified: "2026-01-10T03:00:00Z" },
        JSON.stringify({
          created_at_ms: Date.parse("2026-01-10T02:00:00Z"),
          error_id: randomUUID(),
          error_code: "camera_preview_no_frame",
          error_fingerprint: `stable:${namespace}`,
          app_version: "test",
          device_model: "fixture",
          feedback_user_id: "private-device",
          session_id: "private-session",
          exception_message: "preview has no frame",
          stack_trace: "Preview.start(Preview.kt:42)",
        }),
        date,
        "test-hmac-key-for-local-fixtures-only",
      ).evidence!,
  );
  const coverage = {
    listed: 2,
    downloaded: 1,
    failed: 0,
    excluded: 0,
    unparsed: 0,
    limited: true,
    listingComplete: true,
    notes: [],
  };
  return {
    schemaVersion: 1,
    reviewed: true,
    runId: randomUUID(),
    date,
    timezone: "Asia/Shanghai",
    window: reviewWindow(date),
    generatedAt: new Date().toISOString(),
    summary: "测试日报：两个平台预览未出帧，需要确认恢复结果。",
    notes: ["本报告为隔离测试数据"],
    coverage: { android: { ...coverage }, ios: { ...coverage } },
    evidence,
    findings: evidence.map((e) => ({
      fingerprint: e.fingerprint,
      platform: e.platform,
      title: `${e.platform} 预览未出帧`,
      priority: "P1",
      evidenceIds: [e.id],
      confidence: "suspected",
      conclusion: "超时检查时尚无帧。",
      hypothesis: "不能证明后续一直黑屏。",
      nextStep: "检查同会话的恢复和首帧记录。",
    })),
  };
}
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
