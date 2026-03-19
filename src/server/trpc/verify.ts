import { z } from "zod/v4";
import { eq } from "drizzle-orm";
import { protectedProcedure, router } from "./init";
import { cpfCache, ageVerifications } from "@/server/db/schema";
import { hashCpf, encrypt, decrypt } from "@/server/lib/crypto";
import { calculateAge, getAgeBracket } from "@/server/lib/age";
import { queryCpf } from "@/server/services/serpro";
import { logAudit } from "@/server/services/audit";

export const verifyRouter = router({
  /**
   * Verify a user's age by CPF.
   *
   * Flow:
   * 1. Hash CPF → check cache
   * 2. Cache hit → calculate age from stored birthDate
   * 3. Cache miss → query Serpro → store → return
   */
  byCpf: protectedProcedure
    .input(
      z.object({
        cpf: z.string().min(11).max(14),
        externalUserId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const cpfHash = hashCpf(input.cpf);

      await logAudit({
        eventType: "verification.cpf.started",
        actorId: input.externalUserId,
        ipAddress: ctx.ipAddress,
      });

      // Check cache (eternal — birthdate never changes)
      const [cached] = await ctx.db
        .select()
        .from(cpfCache)
        .where(eq(cpfCache.cpfHash, cpfHash))
        .limit(1);

      let birthDate: Date;
      let cpfStatus: string;
      let cacheId: string;
      let source: "serpro" | "cache";

      if (cached) {
        // Cache hit — no Serpro cost
        birthDate = new Date(decrypt(cached.birthDateEncrypted));
        cpfStatus = cached.cpfStatus;
        cacheId = cached.id;
        source = "cache";

        await logAudit({
          eventType: "verification.cpf.cache_hit",
          actorId: input.externalUserId,
          ipAddress: ctx.ipAddress,
        });
      } else {
        // Cache miss — query Serpro (~R$0.40)
        try {
          const result = await queryCpf(input.cpf);
          birthDate = result.birthDate;
          cpfStatus = result.cpfStatus;

          const [inserted] = await ctx.db
            .insert(cpfCache)
            .values({
              cpfHash,
              birthDateEncrypted: encrypt(birthDate.toISOString()),
              cpfStatus: result.cpfStatus,
              serproVerifiedAt: new Date(),
            })
            .returning({ id: cpfCache.id });

          cacheId = inserted!.id;
          source = "serpro";
        } catch (error) {
          await logAudit({
            eventType: "verification.cpf.failed",
            actorId: input.externalUserId,
            payload: {
              error:
                error instanceof Error ? error.message : "Unknown error",
            },
            ipAddress: ctx.ipAddress,
          });
          throw error;
        }
      }

      const age = calculateAge(birthDate);
      const ageBracket = getAgeBracket(age);

      // Record verification
      const [verification] = await ctx.db
        .insert(ageVerifications)
        .values({
          externalUserId: input.externalUserId,
          cpfCacheId: cacheId,
          ageBracket,
          ageAtVerification: age,
          source,
          ipAddress: ctx.ipAddress,
        })
        .returning({ id: ageVerifications.id });

      await logAudit({
        eventType: "verification.cpf.completed",
        actorId: input.externalUserId,
        targetId: verification!.id,
        payload: { ageBracket, source, cpfStatus },
        ipAddress: ctx.ipAddress,
      });

      return {
        verificationId: verification!.id,
        ageBracket,
        age,
        isAdult: ageBracket === "adult",
        isMinor: ageBracket !== "adult",
        requiresGuardian: ageBracket === "child" || ageBracket === "teen_12_15",
        cpfStatus,
        source,
      };
    }),

  /**
   * Get status of a previous verification.
   */
  getStatus: protectedProcedure
    .input(z.object({ verificationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [verification] = await ctx.db
        .select()
        .from(ageVerifications)
        .where(eq(ageVerifications.id, input.verificationId))
        .limit(1);

      if (!verification) {
        return null;
      }

      return {
        id: verification.id,
        externalUserId: verification.externalUserId,
        ageBracket: verification.ageBracket,
        ageAtVerification: verification.ageAtVerification,
        source: verification.source,
        createdAt: verification.createdAt,
      };
    }),
});
