/**
 * Next.js Instrumentation hook.
 * Called once when the server starts (both dev and production).
 * Used to initialize pgboss workers for webhook dispatch and age transition cron.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Only run on the Node.js server runtime (not Edge, not build)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Auto-create Better Auth tables (user, session, account, verification)
    try {
      const { getMigrations } = await import("better-auth/db/migration");
      const { auth } = await import("@/server/lib/auth");
      const { runMigrations } = await getMigrations(auth.options);
      await runMigrations();
      console.log("[ShieldKid] Better Auth tables ready");
    } catch (error) {
      console.error("[ShieldKid] Failed to run Better Auth migrations:", error);
    }

    // Skip pgboss in serverless environments (use Vercel Cron instead)
    if (process.env.VERCEL) return;

    // Dynamic import to avoid loading pg-boss at build time
    const { getBoss } = await import("@/server/services/jobs");

    try {
      await getBoss();
      console.log("[ShieldKid] pgboss started — webhook workers and age transition cron active");
    } catch (error) {
      console.error("[ShieldKid] Failed to start pgboss:", error);
      // Non-fatal: the app still works, webhooks will dispatch synchronously
    }
  }
}
