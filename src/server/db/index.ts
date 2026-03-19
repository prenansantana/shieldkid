import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function createDb() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is required");
  }
  const client = postgres(databaseUrl);
  return drizzle(client, { schema });
}

// Lazy singleton — only connects when first accessed (not at import/build time)
let _db: ReturnType<typeof createDb> | null = null;

export function getDb() {
  if (!_db) {
    _db = createDb();
  }
  return _db;
}

// For convenience: proxy that lazily initializes
export const db = new Proxy({} as ReturnType<typeof createDb>, {
  get(_, prop) {
    const instance = getDb();
    const value = instance[prop as keyof typeof instance];
    if (typeof value === "function") {
      return value.bind(instance);
    }
    return value;
  },
});

export type Database = ReturnType<typeof createDb>;
