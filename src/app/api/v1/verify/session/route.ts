import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { apiToken } from "@/server/db/schema";
import { hashToken, createSessionToken } from "@/server/lib/crypto";
import { eq } from "drizzle-orm";

/**
 * POST /api/v1/verify/session
 *
 * Creates a short-lived session for SDK camera verification.
 * The session token must be included when submitting images.
 * This prevents image uploads from outside the SDK.
 *
 * Returns: { sessionId: string, expiresAt: number }
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return NextResponse.json(
      { error: "Authorization header with Bearer token required" },
      { status: 401 }
    );
  }

  const tokenHash = hashToken(token);
  const [validToken] = await db
    .select()
    .from(apiToken)
    .where(eq(apiToken.tokenHash, tokenHash))
    .limit(1);

  if (!validToken) {
    return NextResponse.json({ error: "Invalid API token" }, { status: 401 });
  }

  const session = createSessionToken();

  return NextResponse.json(session);
}
