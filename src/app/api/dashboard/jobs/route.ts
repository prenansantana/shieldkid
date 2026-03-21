import { NextResponse } from "next/server";
import { auth } from "@/server/lib/auth";
import { headers } from "next/headers";
import { db } from "@/server/db";
import { sql } from "drizzle-orm";

async function getSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Check if pgboss schema exists
    const schemaCheck = await db.execute<{ exists: boolean }>(
      sql`SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'pgboss') AS exists`
    );
    const pgbossExists = schemaCheck[0]?.exists;

    if (!pgbossExists) {
      return NextResponse.json({ schedules: [], recentJobs: [], pgbossActive: false });
    }

    // Get schedules
    const schedules = await db.execute(
      sql`SELECT name, cron, timezone, created_on, updated_on FROM pgboss.schedule ORDER BY name`
    );

    // Get recent jobs — only pending/active (retry or waiting to run)
    const recentJobs = await db.execute(
      sql`SELECT name, state, data, created_on, started_on, completed_on
          FROM pgboss.job
          WHERE state IN ('created', 'active', 'retry')
          ORDER BY created_on DESC
          LIMIT 20`
    );

    // Check if pgboss is actively running (has queues and schedules)
    const queues = await db.execute<{ count: string }>(
      sql`SELECT COUNT(*) as count FROM pgboss.queue WHERE name NOT LIKE '__pgboss__%'`
    );
    const queueCount = Number(queues[0]?.count ?? 0);

    const scheduleCount = (schedules as unknown[]).length;

    return NextResponse.json({
      schedules,
      recentJobs,
      pgbossActive: queueCount > 0 || scheduleCount > 0,
    });
  } catch {
    return NextResponse.json({ schedules: [], recentJobs: [], pgbossActive: false });
  }
}
