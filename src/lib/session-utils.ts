import { db } from "@/lib/db";

/**
 * Lazy expiry: any ACTIVE session whose endTime has passed is flipped to ENDED.
 * Called on every read/write touching sessions so the 10-minute rule is
 * enforced server-side without needing a cron job.
 */
export async function expireStaleSessions(): Promise<void> {
  await db.session.updateMany({
    where: { status: "ACTIVE", endTime: { lt: new Date() } },
    data: { status: "ENDED" },
  });
}
