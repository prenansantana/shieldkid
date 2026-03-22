import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { setting, apiToken } from "@/server/db/schema";
import { hashToken, encrypt } from "@/server/lib/crypto";
import { randomBytes } from "crypto";

/**
 * POST /api/setup/complete
 * Saves Serpro settings and creates API tokens after admin account creation.
 * Generates both a publishable key (for client-side SDK) and a secret key (for server-side).
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

    // Create both token types
    let publishableToken: string | null = null;
    let secretToken: string | null = null;

    if (tokenName) {
      publishableToken = `sk_pub_${randomBytes(24).toString("hex")}`;
      secretToken = `sk_secret_${randomBytes(24).toString("hex")}`;

      await db.insert(apiToken).values([
        {
          name: `${tokenName} (pública)`,
          tokenHash: hashToken(publishableToken),
          tokenType: "publishable",
        },
        {
          name: `${tokenName} (secreta)`,
          tokenHash: hashToken(secretToken),
          tokenType: "secret",
        },
      ]);
    }

    return NextResponse.json({
      ok: true,
      publishableToken,
      secretToken,
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
