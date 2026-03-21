import { PgBoss, type Job } from "pg-boss";
import { db } from "@/server/db";
import { cpfCache } from "@/server/db/schema";
import { decrypt } from "@/server/lib/crypto";
import { checkBracketTransition } from "@/server/lib/age";
import { dispatchWebhook } from "./webhook";
import { logAudit } from "./audit";

let boss: PgBoss | null = null;

export async function getBoss(): Promise<PgBoss> {
  if (boss) return boss;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL required");

  boss = new PgBoss(databaseUrl);
  await boss.start();

  // Create queues (required in pgboss v10+)
  // webhook-dispatch: 3 retries com backoff exponencial (10s, 40s, 90s)
  // Jobs concluídos/falhados são removidos após 60s
  await boss.createQueue("webhook-dispatch", {
    retryLimit: 3,
    retryDelay: 10,
    retryBackoff: true,
    expireInSeconds: 30,
    retentionSeconds: 60,
  });
  await boss.createQueue("age-check-transitions");

  // Register workers
  await boss.work("webhook-dispatch", handleWebhookDispatch);

  // Schedule daily age transition check at 03:00 UTC
  await boss.schedule("age-check-transitions", "0 3 * * *");
  await boss.work("age-check-transitions", handleAgeTransitions);

  return boss;
}

type WebhookJobData = {
  event: string;
  data: Record<string, unknown>;
};

async function handleWebhookDispatch(job: Job<WebhookJobData>) {
  const success = await dispatchWebhook({
    event: job.data.event,
    data: job.data.data,
    timestamp: new Date().toISOString(),
  });

  if (!success) {
    // Throw para pgboss agendar retry com backoff
    throw new Error(`Webhook falhou para evento ${job.data.event}`);
  }
}

/**
 * Daily cron: check all cached CPFs for birthday-triggered age bracket transitions.
 * For each transition, enqueue a webhook dispatch job.
 */
async function handleAgeTransitions() {
  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();

  // Query all cached CPFs (we decrypt birthDate to check)
  // In production with millions of rows, you'd store month/day as indexed columns.
  // For now, we fetch all and filter in-memory (sufficient for most deployments).
  const allCached = await db.select().from(cpfCache);

  let transitionCount = 0;

  for (const entry of allCached) {
    try {
      const birthDate = new Date(decrypt(entry.birthDateEncrypted));
      const transition = checkBracketTransition(birthDate, today);

      if (transition) {
        transitionCount++;

        // Enqueue webhook
        if (boss) {
          await boss.send("webhook-dispatch", {
            event: "age_bracket_change",
            data: {
              cpfCacheId: entry.id,
              previousBracket: transition.previousBracket,
              newBracket: transition.newBracket,
            },
          });
        }

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

  if (transitionCount > 0) {
    console.log(
      `[ShieldKid] Age transitions detected: ${transitionCount} users changed bracket`
    );
  }
}

/**
 * Enqueue a webhook dispatch job.
 */
export async function enqueueWebhook(
  event: string,
  data: Record<string, unknown>
) {
  const b = await getBoss();
  await b.send("webhook-dispatch", { event, data });
}
