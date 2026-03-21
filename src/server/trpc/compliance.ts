import { z } from "zod/v4";
import { desc, count, eq, sql, and, gte, lte } from "drizzle-orm";
import { protectedProcedure, router } from "./init";
import { auditLog, ageVerification } from "@/server/db/schema";

export const complianceRouter = router({
  /**
   * Get paginated audit logs with optional filters.
   */
  getLogs: protectedProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        perPage: z.number().int().min(1).max(100).default(50),
        eventType: z.string().optional(),
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];

      if (input.eventType) {
        conditions.push(eq(auditLog.eventType, input.eventType));
      }
      if (input.startDate) {
        conditions.push(gte(auditLog.timestamp, new Date(input.startDate)));
      }
      if (input.endDate) {
        conditions.push(lte(auditLog.timestamp, new Date(input.endDate)));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [logs, [total]] = await Promise.all([
        ctx.db
          .select()
          .from(auditLog)
          .where(where)
          .orderBy(desc(auditLog.timestamp))
          .limit(input.perPage)
          .offset((input.page - 1) * input.perPage),
        ctx.db.select({ count: count() }).from(auditLog).where(where),
      ]);

      return {
        logs,
        pagination: {
          page: input.page,
          perPage: input.perPage,
          total: total!.count,
          totalPages: Math.ceil(total!.count / input.perPage),
        },
      };
    }),

  /**
   * Get verification metrics for the dashboard.
   */
  getMetrics: protectedProcedure
    .input(
      z
        .object({
          days: z.number().int().min(1).max(365).default(30),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const days = input?.days ?? 30;
      const since = new Date();
      since.setDate(since.getDate() - days);

      const [totalVerifications] = await ctx.db
        .select({ count: count() })
        .from(ageVerification);

      const [recentVerifications] = await ctx.db
        .select({ count: count() })
        .from(ageVerification)
        .where(gte(ageVerification.createdAt, since));

      const bracketCounts = await ctx.db
        .select({
          ageBracket: ageVerification.ageBracket,
          count: count(),
        })
        .from(ageVerification)
        .groupBy(ageVerification.ageBracket);

      const sourceCounts = await ctx.db
        .select({
          source: ageVerification.source,
          count: count(),
        })
        .from(ageVerification)
        .groupBy(ageVerification.source);

      const cacheHitRate =
        sourceCounts.find((s) => s.source === "cache")?.count ?? 0;
      const serproHits =
        sourceCounts.find((s) => s.source === "serpro")?.count ?? 0;
      const totalHits = cacheHitRate + serproHits;

      return {
        totalVerifications: totalVerifications!.count,
        recentVerifications: recentVerifications!.count,
        period: days,
        bracketDistribution: Object.fromEntries(
          bracketCounts.map((b) => [b.ageBracket, b.count])
        ),
        cacheHitRate: totalHits > 0 ? cacheHitRate / totalHits : 0,
        estimatedSerproCost: serproHits * 0.4,
      };
    }),

  /**
   * Generate a compliance report (ANPD format).
   */
  getReport: protectedProcedure
    .input(
      z.object({
        startDate: z.string().datetime(),
        endDate: z.string().datetime(),
      })
    )
    .query(async ({ ctx, input }) => {
      const start = new Date(input.startDate);
      const end = new Date(input.endDate);

      const dateFilter = and(
        gte(ageVerification.createdAt, start),
        lte(ageVerification.createdAt, end)
      );

      const [total] = await ctx.db
        .select({ count: count() })
        .from(ageVerification)
        .where(dateFilter);

      const brackets = await ctx.db
        .select({
          ageBracket: ageVerification.ageBracket,
          count: count(),
        })
        .from(ageVerification)
        .where(dateFilter)
        .groupBy(ageVerification.ageBracket);

      const sources = await ctx.db
        .select({
          source: ageVerification.source,
          count: count(),
        })
        .from(ageVerification)
        .where(dateFilter)
        .groupBy(ageVerification.source);

      return {
        period: { start: input.startDate, end: input.endDate },
        totalVerifications: total!.count,
        bracketDistribution: Object.fromEntries(
          brackets.map((b) => [b.ageBracket, b.count])
        ),
        sourceDistribution: Object.fromEntries(
          sources.map((s) => [s.source, s.count])
        ),
        generatedAt: new Date().toISOString(),
      };
    }),
});
