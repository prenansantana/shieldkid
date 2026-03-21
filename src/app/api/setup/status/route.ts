import { NextResponse } from "next/server";
import { Pool } from "pg";

/**
 * GET /api/setup/status
 * Returns whether initial setup has been completed (i.e., at least one admin user exists).
 */
export async function GET() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const result = await pool.query('SELECT COUNT(*) as count FROM "user"');
    const userCount = parseInt(result.rows[0].count, 10);

    return NextResponse.json({
      needsSetup: userCount === 0,
    });
  } catch {
    // If user table doesn't exist yet, setup is needed
    return NextResponse.json({ needsSetup: true });
  } finally {
    await pool.end();
  }
}
