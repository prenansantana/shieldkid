import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { apiTokens, cpfCache, ageVerifications } from "@/server/db/schema";
import { hashToken, hashCpf, encrypt, decrypt } from "@/server/lib/crypto";
import { calculateAge, getAgeBracket } from "@/server/lib/age";
import { queryCpf } from "@/server/services/serpro";
import { logAudit } from "@/server/services/audit";
import { eq } from "drizzle-orm";

/**
 * REST endpoint: POST /api/v1/verify
 *
 * Body: { cpf: string, externalUserId: string }
 * Headers: Authorization: Bearer <token>
 *
 * This mirrors the tRPC verify.byCpf procedure for non-TypeScript clients.
 */
export async function POST(req: NextRequest) {
  // Authenticate
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
    .from(apiTokens)
    .where(eq(apiTokens.tokenHash, tokenHash))
    .limit(1);

  if (!validToken) {
    return NextResponse.json({ error: "Invalid API token" }, { status: 401 });
  }

  // Parse body
  let body: { cpf?: string; externalUserId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { cpf, externalUserId } = body;
  if (!cpf || !externalUserId) {
    return NextResponse.json(
      { error: "cpf and externalUserId are required" },
      { status: 400 }
    );
  }

  const normalized = cpf.replace(/\D/g, "");
  if (normalized.length !== 11) {
    return NextResponse.json(
      { error: "CPF must have 11 digits" },
      { status: 400 }
    );
  }

  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    undefined;

  try {
    const cpfHashValue = hashCpf(normalized);

    await logAudit({
      eventType: "verification.cpf.started",
      actorId: externalUserId,
      ipAddress,
    });

    // Check eternal cache
    const [cached] = await db
      .select()
      .from(cpfCache)
      .where(eq(cpfCache.cpfHash, cpfHashValue))
      .limit(1);

    let birthDate: Date;
    let cpfStatus: string;
    let cacheId: string;
    let source: "serpro" | "cache";

    if (cached) {
      birthDate = new Date(decrypt(cached.birthDateEncrypted));
      cpfStatus = cached.cpfStatus;
      cacheId = cached.id;
      source = "cache";
    } else {
      const result = await queryCpf(normalized);
      birthDate = result.birthDate;
      cpfStatus = result.cpfStatus;

      const [inserted] = await db
        .insert(cpfCache)
        .values({
          cpfHash: cpfHashValue,
          birthDateEncrypted: encrypt(birthDate.toISOString()),
          cpfStatus: result.cpfStatus,
          serproVerifiedAt: new Date(),
        })
        .returning({ id: cpfCache.id });

      cacheId = inserted!.id;
      source = "serpro";
    }

    const age = calculateAge(birthDate);
    const ageBracket = getAgeBracket(age);

    const [verification] = await db
      .insert(ageVerifications)
      .values({
        externalUserId,
        cpfCacheId: cacheId,
        ageBracket,
        ageAtVerification: age,
        source,
        ipAddress,
      })
      .returning({ id: ageVerifications.id });

    await logAudit({
      eventType: "verification.cpf.completed",
      actorId: externalUserId,
      targetId: verification!.id,
      payload: { ageBracket, source, cpfStatus },
      ipAddress,
    });

    // Update token last used
    await db
      .update(apiTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiTokens.id, validToken.id));

    return NextResponse.json({
      verificationId: verification!.id,
      ageBracket,
      age,
      isAdult: ageBracket === "adult",
      isMinor: ageBracket !== "adult",
      requiresGuardian:
        ageBracket === "child" || ageBracket === "teen_12_15",
      cpfStatus,
      source,
    });
  } catch (error) {
    await logAudit({
      eventType: "verification.cpf.failed",
      actorId: externalUserId,
      payload: {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      ipAddress,
    });

    return NextResponse.json(
      { error: "Verification failed" },
      { status: 500 }
    );
  }
}
