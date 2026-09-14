import { cosConfig, cosConfigured, createCOS } from "./lib/cos.mjs";
import { createDatabase, databaseConfigured } from "./lib/prisma.mjs";
if (!databaseConfigured() || !cosConfigured()) throw new Error("Configure MySQL and private storage first.");
const apply = process.argv.includes("--apply");
const c = createDatabase();
const storage = createCOS();
const { Bucket, Region, Prefix } = cosConfig();
try {
  const sessions = await c.$queryRawUnsafe(
    "SELECT s.id FROM template_upload_sessions s WHERE s.state<>'committed' AND s.created_at<UTC_TIMESTAMP()-INTERVAL 24 HOUR AND NOT EXISTS (SELECT 1 FROM template_assets a WHERE a.upload_session_id=s.id AND (a.template_id IS NOT NULL OR a.request_id IS NOT NULL)) LIMIT 100",
  );
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", unreferencedExpiredSessions: sessions.length }));
  if (apply) {
    for (const s of sessions) {
      // Session deadline already passed by >=23h; no new complete/publish can commit.
      if (!/^[a-f0-9-]{36}$/i.test(s.id)) throw new Error("Invalid session ID");
      for (const prefix of [`${Prefix}/staging/${s.id}/`, `${Prefix}/sealed/${s.id}/`]) {
        while (true) {
          const data = await storage.getBucket({ Bucket, Region, Prefix: prefix, MaxKeys: 100 });
          if (!data.Contents?.length) break;
          for (const object of data.Contents) {
            if (!object.Key.startsWith(prefix)) throw new Error("Cleanup object outside session prefix");
            await storage.deleteObject({ Bucket, Region, Key: object.Key });
          }
        }
      }
      await c.$transaction(async (tx) => {
        await tx.$executeRaw`DELETE FROM template_assets WHERE upload_session_id=${s.id} AND template_id IS NULL AND request_id IS NULL`;
        await tx.$executeRaw`DELETE FROM template_upload_sessions WHERE id=${s.id} AND state<>'committed'`;
      });
    }
    await c.$executeRawUnsafe("DELETE FROM template_search_snapshots WHERE expires_at<UTC_TIMESTAMP()-INTERVAL 1 DAY");
  }
} finally {
  await c.$disconnect();
}
