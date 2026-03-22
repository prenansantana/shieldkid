import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { apiToken } from "@/server/db/schema";
import { hashToken } from "@/server/lib/crypto";
import { eq } from "drizzle-orm";

export type TokenScope = "publishable" | "secret";

interface AuthSuccess {
  token: typeof apiToken.$inferSelect;
  scope: TokenScope;
}

/**
 * Authenticate an API request using a Bearer token.
 * Returns the token record and its scope, or a 401 NextResponse.
 */
export async function authenticateApiToken(
  req: NextRequest
): Promise<AuthSuccess | NextResponse> {
  const authHeader = req.headers.get("authorization");
  const rawToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!rawToken) {
    return NextResponse.json(
      { error: "Cabeçalho Authorization com token Bearer obrigatório" },
      { status: 401 }
    );
  }

  const tokenHash = hashToken(rawToken);
  const [validToken] = await db
    .select()
    .from(apiToken)
    .where(eq(apiToken.tokenHash, tokenHash))
    .limit(1);

  if (!validToken) {
    return NextResponse.json({ error: "Token de API inválido" }, { status: 401 });
  }

  // Determine scope from the stored tokenType column.
  // Legacy tokens (sk_xxx without pub/secret prefix) default to "secret" via the DB column default.
  const scope: TokenScope = validToken.tokenType === "publishable" ? "publishable" : "secret";

  // Update lastUsedAt (fire-and-forget)
  db.update(apiToken)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiToken.id, validToken.id))
    .catch(() => {});

  return { token: validToken, scope };
}

/**
 * Guard that requires a specific scope level.
 * Returns a 403 NextResponse if the scope is insufficient, or null if allowed.
 */
export function requireScope(
  scope: TokenScope,
  required: "secret"
): NextResponse | null {
  if (required === "secret" && scope === "publishable") {
    return NextResponse.json(
      {
        error:
          "Este endpoint requer uma chave secreta (sk_secret_xxx). " +
          "Chaves públicas (sk_pub_xxx) só podem criar sessões e enviar verificações.",
      },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Helper to check if an auth result is an error response.
 */
export function isAuthError(
  result: AuthSuccess | NextResponse
): result is NextResponse {
  return result instanceof NextResponse;
}
