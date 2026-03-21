import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { setting, apiToken } from "@/server/db/schema";
import { hashToken, encrypt } from "@/server/lib/crypto";
import { randomBytes } from "crypto";

/**
 * POST /api/setup/complete
 * Saves Serpro settings and creates an API token after admin account creation.
 * Only works once — locked out as soon as a settings row exists.
 */
export async function POST(req: NextRequest) {
  try {
    // Guard: reject if setup is already done (settings row exists)
    const [existingSetting] = await db.select({ id: setting.id }).from(setting).limit(1);
    if (existingSetting) {
      return NextResponse.json(
        { error: "Setup já foi concluído" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { serproClientId, serproClientSecret, tokenName } = body as {
      serproClientId?: string;
      serproClientSecret?: string;
      tokenName?: string;
    };

    // Always insert a settings row to permanently lock this endpoint
    await db.insert(setting).values({
      serproClientId: serproClientId || null,
      serproClientSecret: serproClientSecret ? encrypt(serproClientSecret) : null,
    });

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
          error instanceof Error ? error.message : "Falha ao concluir o setup",
      },
      { status: 500 }
    );
  }
}
