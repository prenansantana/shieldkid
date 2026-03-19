import { router } from "./init";
import { verifyRouter } from "./verify";
import { complianceRouter } from "./compliance";

export const appRouter = router({
  verify: verifyRouter,
  compliance: complianceRouter,
});

export type AppRouter = typeof appRouter;
