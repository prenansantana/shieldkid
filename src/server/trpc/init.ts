import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { db } from "@/server/db";
import { apiToken } from "@/server/db/schema";
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
    .from(apiToken)
    .where(eq(apiToken.tokenHash, tokenHash))
    .limit(1);

  if (!token) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Token de API inválido",
    });
  }

  if (token.tokenType === "publishable") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Este endpoint requer uma chave secreta (sk_secret_xxx). Chaves públicas (sk_pub_xxx) só podem criar sessões e enviar verificações.",
    });
  }

  // Update last used timestamp
  await ctx.db
    .update(apiToken)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiToken.id, token.id));

  return next({ ctx });
});
