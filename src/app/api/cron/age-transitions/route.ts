import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { cpfCache } from "@/server/db/schema";
import { decrypt } from "@/server/lib/crypto";
import { checkBracketTransition } from "@/server/lib/age";
import { dispatchWebhook } from "@/server/services/webhook";
import { logAudit } from "@/server/services/audit";

/**
 * Vercel Cron endpoint for serverless deployments.
 * Checks for age bracket transitions on birthdays.
 *
 * Configure in vercel.json:
 * { "crons": [{ "path": "/api/cron/age-transitions", "schedule": "0 3 * * *" }] }
 */
export async function GET(req: Request) {
  // Verify cron secret in production
  const authHeader = req.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  const allCached = await db.select().from(cpfCache);

  let transitionCount = 0;

  for (const entry of allCached) {
    try {
      const birthDate = new Date(decrypt(entry.birthDateEncrypted));
      const transition = checkBracketTransition(birthDate, today);

      if (transition) {
        transitionCount++;

        await dispatchWebhook({
          event: "age_bracket_change",
          data: {
            cpfCacheId: entry.id,
            previousBracket: transition.previousBracket,
            newBracket: transition.newBracket,
          },
          timestamp: today.toISOString(),
        });

        await logAudit({
          eventType: "age_bracket.transition",
          targetId: entry.id,
          payload: {
            previousBracket: transition.previousBracket,
            newBracket: transition.newBracket,
          },
        });
      }
    } catch {
      // Skip entries with decryption errors
    }
  }

  return NextResponse.json({
    ok: true,
    transitions: transitionCount,
    checkedAt: today.toISOString(),
  });
}
