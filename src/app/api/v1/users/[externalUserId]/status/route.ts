import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { apiToken, ageVerification, parentalLink } from "@/server/db/schema";
import { hashToken } from "@/server/lib/crypto";
import { eq, desc, and, or } from "drizzle-orm";

/**
 * GET /api/v1/users/:externalUserId/status
 *
 * Returns the verification status of a user.
 * The platform calls this to check if a user has been verified,
 * their age bracket, and whether guardian linkage is required/active.
 *
 * Response:
 * - verified: false → user needs to go through verification
 * - verified: true  → includes ageBracket, permissions, and guardian info
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ externalUserId: string }> }
) {
  const { externalUserId } = await params;

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

  // Get latest verification for this user
  const [latestVerification] = await db
    .select()
    .from(ageVerification)
    .where(eq(ageVerification.externalUserId, externalUserId))
    .orderBy(desc(ageVerification.createdAt))
    .limit(1);

  if (!latestVerification) {
    return NextResponse.json({
      verified: false,
      externalUserId,
      message: "User has not been verified yet. Call POST /api/v1/verify first.",
    });
  }

  // Check guardian linkage (as minor)
  const [guardianLink] = await db
    .select()
    .from(parentalLink)
    .where(
      and(
        eq(parentalLink.minorExternalId, externalUserId),
        or(
          eq(parentalLink.status, "active"),
          eq(parentalLink.status, "pending")
        )
      )
    )
    .orderBy(desc(parentalLink.createdAt))
    .limit(1);

  const requiresGuardian =
    latestVerification.ageBracket === "child" ||
    latestVerification.ageBracket === "teen_12_15";

  const permissions = getPermissions(latestVerification.ageBracket);

  return NextResponse.json({
    verified: true,
    externalUserId,
    verificationId: latestVerification.id,
    ageBracket: latestVerification.ageBracket,
    ageAtVerification: latestVerification.ageAtVerification,
    source: latestVerification.source,
    verifiedAt: latestVerification.createdAt,
    requiresGuardian,
    guardian: guardianLink
      ? {
          status: guardianLink.status,
          guardianExternalId: guardianLink.guardianExternalId,
          settings: guardianLink.settings,
        }
      : null,
    permissions,
  });
}

/**
 * Returns platform-actionable permissions based on age bracket.
 * These map directly to Lei Felca requirements.
 */
function getPermissions(ageBracket: string) {
  switch (ageBracket) {
    case "child":
      return {
        canAccessPlatform: false,
        canMakePurchases: false,
        canReceiveAds: false,
        canUseLootBoxes: false,
        requiresGuardianApproval: true,
        dataProfilingAllowed: false,
        description:
          "Criança (<12): acesso muito restrito, responsável obrigatório",
      };
    case "teen_12_15":
      return {
        canAccessPlatform: true,
        canMakePurchases: false,
        canReceiveAds: false,
        canUseLootBoxes: false,
        requiresGuardianApproval: true,
        dataProfilingAllowed: false,
        description:
          "Adolescente (12-15): responsável obrigatório, controle parental ativo",
      };
    case "teen_16_17":
      return {
        canAccessPlatform: true,
        canMakePurchases: true,
        canReceiveAds: false,
        canUseLootBoxes: false,
        requiresGuardianApproval: false,
        dataProfilingAllowed: false,
        description:
          "Jovem (16-17): conta própria com restrições, sem perfilamento",
      };
    case "adult":
      return {
        canAccessPlatform: true,
        canMakePurchases: true,
        canReceiveAds: true,
        canUseLootBoxes: true,
        requiresGuardianApproval: false,
        dataProfilingAllowed: true,
        description: "Adulto (18+): sem restrições da Lei Felca",
      };
    default:
      return {
        canAccessPlatform: false,
        canMakePurchases: false,
        canReceiveAds: false,
        canUseLootBoxes: false,
        requiresGuardianApproval: true,
        dataProfilingAllowed: false,
        description: "Faixa etária desconhecida — tratar como menor",
      };
  }
}
