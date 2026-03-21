import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { apiToken, cpfCache, ageVerification } from "@/server/db/schema";
import { hashToken, hashCpf, encrypt, decrypt, validateSessionToken, markSessionUsed } from "@/server/lib/crypto";
import { calculateAge, getAgeBracket } from "@/server/lib/age";
import { queryCpf, isSerproConfigured } from "@/server/services/serpro";
import { estimateAge, isAgeConsistent, isAgeAiAvailable } from "@/server/services/age-ai";
import { logAudit } from "@/server/services/audit";
import { enqueueWebhook } from "@/server/services/jobs";
import { eq } from "drizzle-orm";

/**
 * REST endpoint: POST /api/v1/verify
 *
 * Supports two content types:
 * - JSON:      { cpf?: string, externalUserId: string }
 * - Multipart: { cpf?: string, externalUserId: string, image?: File }
 *
 * Flow:
 * 1. If CPF provided + Serpro configured → cache check → Serpro API → verified age
 * 2. If image provided + age-ai available → AI age estimation
 * 3. If both → cross-check with tolerance margin
 * 4. If only one → use that as source
 * 5. If neither → error 400
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
    .from(apiToken)
    .where(eq(apiToken.tokenHash, tokenHash))
    .limit(1);

  if (!validToken) {
    return NextResponse.json({ error: "Invalid API token" }, { status: 401 });
  }

  // Parse body (JSON or multipart)
  let cpf: string | undefined;
  let externalUserId: string | undefined;
  let imageFile: File | null = null;
  let sessionId: string | undefined;

  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    cpf = (formData.get("cpf") as string) || undefined;
    externalUserId = (formData.get("externalUserId") as string) || undefined;
    imageFile = formData.get("image") as File | null;
    sessionId = (formData.get("sessionId") as string) || undefined;
  } else {
    let body: { cpf?: string; externalUserId?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    cpf = body.cpf;
    externalUserId = body.externalUserId;
  }

  // Validate SDK session when image is provided
  // Images are only accepted from our SDK (which obtains a session first)
  if (imageFile) {
    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId obrigatório para envio de imagem. Use POST /api/v1/verify/session primeiro." },
        { status: 403 }
      );
    }

    const session = validateSessionToken(sessionId);
    if (!session.valid) {
      return NextResponse.json(
        { error: session.error },
        { status: 403 }
      );
    }

    if (!markSessionUsed(session.nonce)) {
      return NextResponse.json(
        { error: "Sessão já utilizada. Crie uma nova sessão." },
        { status: 403 }
      );
    }
  }

  if (!externalUserId) {
    return NextResponse.json(
      { error: "externalUserId is required" },
      { status: 400 }
    );
  }

  // Normalize CPF if provided
  let normalizedCpf: string | undefined;
  if (cpf) {
    normalizedCpf = cpf.replace(/\D/g, "");
    if (normalizedCpf.length !== 11) {
      return NextResponse.json(
        { error: "CPF must have 11 digits" },
        { status: 400 }
      );
    }
  }

  const hasCpf = !!normalizedCpf && isSerproConfigured();
  const hasImage = !!imageFile;

  if (!hasCpf && !hasImage) {
    return NextResponse.json(
      { error: "Forneça cpf ou image (selfie) para verificação" },
      { status: 400 }
    );
  }

  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    undefined;

  try {
    // ── Step 1: Serpro (CPF) ──────────────────────────────
    let serproAge: number | undefined;
    let cpfStatus: string | undefined;
    let cacheId: string | undefined;
    let serproSource: "serpro" | "cache" | undefined;

    if (hasCpf && normalizedCpf) {
      const cpfHashValue = hashCpf(normalizedCpf);

      await logAudit({
        eventType: "verification.cpf.started",
        actorId: externalUserId,
        ipAddress,
      });

      const [cached] = await db
        .select()
        .from(cpfCache)
        .where(eq(cpfCache.cpfHash, cpfHashValue))
        .limit(1);

      let birthDate: Date;

      if (cached) {
        birthDate = new Date(decrypt(cached.birthDateEncrypted));
        cpfStatus = cached.cpfStatus;
        cacheId = cached.id;
        serproSource = "cache";
      } else {
        const result = await queryCpf(normalizedCpf);
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
        serproSource = "serpro";
      }

      serproAge = calculateAge(birthDate);
    }

    // ── Step 2: AI (selfie) ──────────────────────────────
    let estimatedAge: number | undefined;
    let aiConfidence: number | undefined;
    let aiProcessingMs: number | undefined;

    if (hasImage && imageFile) {
      const aiAvailable = await isAgeAiAvailable();

      if (aiAvailable) {
        await logAudit({
          eventType: "verification.ai.started",
          actorId: externalUserId,
          ipAddress,
        });

        const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
        const result = await estimateAge(imageBuffer);

        if (!result) {
          await logAudit({
            eventType: "verification.ai.failed",
            actorId: externalUserId,
            payload: { reason: "no_face_detected" },
            ipAddress,
          });

          // If we have Serpro result, continue without AI
          if (serproAge === undefined) {
            return NextResponse.json({
              error: "Nenhum rosto detectado na imagem. Tente novamente com uma selfie clara",
              action: "retry",
            });
          }
        } else {
          estimatedAge = result.estimatedAge;
          aiConfidence = result.confidence;
          aiProcessingMs = result.processingMs;

          await logAudit({
            eventType: "verification.ai.completed",
            actorId: externalUserId,
            payload: { estimatedAge, confidence: aiConfidence, processingMs: aiProcessingMs },
            ipAddress,
          });
        }
      } else if (serproAge === undefined) {
        // No AI available and no Serpro — can't verify
        return NextResponse.json(
          { error: "Serviço de IA indisponível. Verifique se o container age-ai está rodando." },
          { status: 503 }
        );
      }
    }

    // ── Step 3: Determine result ─────────────────────────
    let age: number;
    let source: "serpro" | "cache" | "ai";
    let action: "allow" | "flag" | "block" | undefined;
    let consistent: boolean | undefined;
    let suspicious: boolean | undefined;
    let ageDifference: number | undefined;

    if (serproAge !== undefined && estimatedAge !== undefined) {
      // Both sources: cross-check
      age = serproAge; // Serpro is ground truth
      source = serproSource!;
      const check = isAgeConsistent(serproAge, estimatedAge);
      consistent = check.consistent;
      suspicious = check.suspicious;
      ageDifference = check.difference;

      if (check.suspicious) {
        action = "block";
      } else if (!check.consistent) {
        action = "flag";
      } else {
        action = "allow";
      }
    } else if (serproAge !== undefined) {
      // Serpro only
      age = serproAge;
      source = serproSource!;
    } else {
      // AI only
      age = estimatedAge!;
      source = "ai";
    }

    const ageBracket = getAgeBracket(age);

    // Record verification
    const [verification] = await db
      .insert(ageVerification)
      .values({
        externalUserId,
        cpfCacheId: cacheId ?? null,
        ageBracket,
        ageAtVerification: age,
        source,
        ipAddress,
      })
      .returning({ id: ageVerification.id });

    await logAudit({
      eventType: "verification.cpf.completed",
      actorId: externalUserId,
      targetId: verification!.id,
      payload: {
        ageBracket,
        source,
        cpfStatus,
        serproAge,
        estimatedAge,
        action,
        consistent,
      },
      ipAddress,
    });

    // Enqueue webhook via pgboss (with retry on failure)
    enqueueWebhook("verification.completed", {
      verificationId: verification!.id,
      externalUserId,
      ageBracket,
      age,
      source,
      ...(cpfStatus !== undefined && { cpfStatus }),
      ...(estimatedAge !== undefined && { estimatedAge }),
      ...(action !== undefined && { action }),
      ...(consistent !== undefined && { consistent }),
    }).catch(() => {
      // Enqueue failure should never block verification response
    });

    // Update token last used
    await db
      .update(apiToken)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiToken.id, validToken.id));

    // Build response
    const response: Record<string, unknown> = {
      verificationId: verification!.id,
      ageBracket,
      age,
      isAdult: ageBracket === "adult",
      isMinor: ageBracket !== "adult",
      requiresGuardian:
        ageBracket === "child" || ageBracket === "teen_12_15",
      source,
    };

    if (cpfStatus !== undefined) response.cpfStatus = cpfStatus;
    if (estimatedAge !== undefined) response.estimatedAge = estimatedAge;
    if (aiConfidence !== undefined) response.confidence = aiConfidence;
    if (aiProcessingMs !== undefined) response.processingMs = aiProcessingMs;
    if (action !== undefined) response.action = action;
    if (consistent !== undefined) response.consistent = consistent;
    if (suspicious !== undefined) response.suspicious = suspicious;
    if (ageDifference !== undefined) response.ageDifference = ageDifference;

    return NextResponse.json(response);
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
