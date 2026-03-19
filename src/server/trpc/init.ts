import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { db } from "@/server/db";
import { apiTokens } from "@/server/db/schema";
import { hashToken } from "@/server/lib/crypto";
import { eq } from "drizzle-orm";

export type Context = {
  db: typeof db;
  apiToken?: string;
  ipAddress?: string;
};

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * Protected procedure — requires a valid API token.
 * Token is passed via Authorization: Bearer <token>
 */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.apiToken) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "API token required",
    });
  }

  const tokenHash = hashToken(ctx.apiToken);
  const [token] = await ctx.db
    .select()
    .from(apiTokens)
    .where(eq(apiTokens.tokenHash, tokenHash))
    .limit(1);

  if (!token) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid API token",
    });
  }

  // Update last used timestamp
  await ctx.db
    .update(apiTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiTokens.id, token.id));

  return next({ ctx });
});
