import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { db } from "@/server/db";
import { setting, apiToken } from "@/server/db/schema";
import { hashToken } from "@/server/lib/crypto";
import { randomBytes } from "crypto";

/**
 * POST /api/setup/complete
 * Saves Serpro settings and creates an API token after admin account creation.
 * Only works if setup is not yet complete.
 */
export async function POST(req: NextRequest) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // Guard: only allow if no users exist beyond the one just created
    const result = await pool.query('SELECT COUNT(*) as count FROM "user"');
    const userCount = parseInt(result.rows[0].count, 10);

    if (userCount > 1) {
      return NextResponse.json(
        { error: "Setup already completed" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { serproClientId, serproClientSecret, tokenName } = body as {
      serproClientId?: string;
      serproClientSecret?: string;
      tokenName?: string;
    };

    // Save Serpro settings if provided
    if (serproClientId || serproClientSecret) {
      await db.insert(setting).values({
        serproClientId: serproClientId || null,
        serproClientSecret: serproClientSecret || null,
      });
    }

    // Create API token
    let apiTokenValue: string | null = null;
    if (tokenName) {
      apiTokenValue = `sk_${randomBytes(24).toString("hex")}`;
      await db.insert(apiToken).values({
        name: tokenName,
        tokenHash: hashToken(apiTokenValue),
      });
    }

    return NextResponse.json({
      ok: true,
      apiToken: apiTokenValue,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Setup completion failed",
      },
      { status: 500 }
    );
  } finally {
    await pool.end();
  }
}
