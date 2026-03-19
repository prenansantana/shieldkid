import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/trpc/root";
import { db } from "@/server/db";
import type { Context } from "@/server/trpc/init";

function createContext(req: Request): Context {
  const authHeader = req.headers.get("authorization");
  const apiToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : undefined;

  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    undefined;

  return { db, apiToken, ipAddress };
}

function handler(req: Request) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createContext(req),
  });
}

export { handler as GET, handler as POST };
