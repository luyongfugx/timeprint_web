import { createDatabase } from "./lib/prisma.mjs";
import { hashPassword } from "./lib/password.mjs";
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
if (!email || !password || password.length < 10 || password.length > 256)
  throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD (10–256 characters) in a protected local environment file.");
const db = createDatabase();
try {
  const passwordHash = await hashPassword(password);
  await db.$transaction(async (tx) => {
    const account = await tx.admin_accounts.update({ where: { email }, data: { password_hash: passwordHash } });
    await tx.admin_sessions.deleteMany({ where: { admin_id: account.id } });
  });
  console.log("Administrator password updated and existing sessions revoked.");
} catch {
  console.error("Password update failed; check account and database access.");
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
