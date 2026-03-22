import { NextRequest } from "next/server";
import { createSessionToken } from "@/server/lib/crypto";
import { authenticateApiToken, isAuthError } from "@/server/lib/api-auth";

/**
 * POST /api/v1/verify/session
 *
 * Creates a short-lived session for SDK camera verification.
 * The session token must be included when submitting images.
 * This prevents image uploads from outside the SDK.
 *
 * Both publishable and secret tokens are allowed.
 *
 * Returns: { sessionId: string, expiresAt: number }
 */
export async function POST(req: NextRequest) {
  const authResult = await authenticateApiToken(req);
  if (isAuthError(authResult)) return authResult;

  const session = createSessionToken();
  return Response.json(session);
}
