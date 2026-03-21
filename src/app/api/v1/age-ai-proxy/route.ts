import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { apiToken } from "@/server/db/schema";
import { hashToken } from "@/server/lib/crypto";
import { eq } from "drizzle-orm";

/**
 * POST /api/v1/age-ai-proxy
 *
 * Proxy for the Age AI microservice (demo/testing only).
 * Forwards the image to the age-ai container and returns the result.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return NextResponse.json(
      { error: "Cabeçalho Authorization com token Bearer obrigatório" },
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
    return NextResponse.json({ error: "Token de API inválido" }, { status: 401 });
  }

  const ageAiUrl = process.env.AGE_AI_URL ?? "http://localhost:8100";

  try {
    const formData = await req.formData();

    const res = await fetch(`${ageAiUrl}/analyze`, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(30_000),
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro no proxy de IA" },
      { status: 502 }
    );
  }
}
