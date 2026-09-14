import { createClient } from "@supabase/supabase-js";
import { createDatabase, databaseConfigured } from "./lib/prisma.mjs";
if (!databaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY)
  throw new Error("Configure MySQL and private storage first.");
const apply = process.argv.includes("--apply");
const c = createDatabase();
const storage = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
}).storage.from(process.env.TEMPLATE_ASSETS_BUCKET ?? "template-assets-v2");
try {
  const sessions = await c.$queryRawUnsafe(
    "SELECT s.id FROM template_upload_sessions s WHERE s.state<>'committed' AND s.created_at<UTC_TIMESTAMP()-INTERVAL 24 HOUR AND NOT EXISTS (SELECT 1 FROM template_assets a WHERE a.upload_session_id=s.id AND (a.template_id IS NOT NULL OR a.request_id IS NOT NULL)) LIMIT 100",
  );
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", unreferencedExpiredSessions: sessions.length }));
  if (apply) {
    for (const s of sessions) {
      // Session deadline already passed by >=23h; no new complete/publish can commit.
      for (const prefix of [`staging/${s.id}`, `sealed/${s.id}`]) {
        while (true) {
          const { data, error } = await storage.list(prefix, { limit: 100 });
          if (error) throw new Error("Storage listing failed; database records retained.");
          if (!data.length) break;
          const removed = await storage.remove(data.map((o) => `${prefix}/${o.name}`));
          if (removed.error) throw new Error("Storage cleanup failed; database records retained.");
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
