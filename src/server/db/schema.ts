import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  pgEnum,
  uniqueIndex,
  integer,
} from "drizzle-orm/pg-core";

// ── Enums ──────────────────────────────────────────────

export const cpfStatusEnum = pgEnum("cpf_status", [
  "regular",
  "irregular",
  "cancelled",
  "null",
]);

export const ageBracketEnum = pgEnum("age_bracket", [
  "child",
  "teen_12_15",
  "teen_16_17",
  "adult",
]);

export const parentalLinkStatusEnum = pgEnum("parental_link_status", [
  "pending",
  "active",
  "revoked",
]);

export const verificationSourceEnum = pgEnum("verification_source", [
  "serpro",
  "cache",
  "ai",
]);

// ── Auth tables (managed by Better Auth via pg Pool) ───
// Tables: "user", "session", "account", "verification"
// These use camelCase columns and are NOT managed by Drizzle.
// See src/server/lib/auth.ts for config.

// ── Setting (single-tenant config) ────────────────────

export const setting = pgTable("setting", {
  id: uuid("id").defaultRandom().primaryKey(),
  serproApiUrl: text("serproApiUrl")
    .notNull()
    .default("https://gateway.apiserpro.serpro.gov.br"),
  serproClientId: text("serproClientId"),
  serproClientSecret: text("serproClientSecret"),
  webhookUrl: text("webhookUrl"),
  webhookSecret: text("webhookSecret"),
  webhookEvents: jsonb("webhookEvents").$type<string[]>().default([]),
  sdkAllowedOrigins: jsonb("sdkAllowedOrigins").$type<string[]>().default([]),
  emailProvider: text("emailProvider").default("resend"),
  emailConfig: jsonb("emailConfig").$type<Record<string, string>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ── API Token ─────────────────────────────────────────

export const apiToken = pgTable("api_token", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  tokenHash: text("tokenHash").notNull().unique(),
  tokenType: text("token_type").notNull().default("secret"),
  lastUsedAt: timestamp("lastUsedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ── CPF Cache (eternal — birthdate never changes) ──────

export const cpfCache = pgTable(
  "cpf_cache",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cpfHash: text("cpfHash").notNull(),
    birthDateEncrypted: text("birthDateEncrypted").notNull(),
    cpfStatus: cpfStatusEnum("cpfStatus").notNull().default("regular"),
    serproVerifiedAt: timestamp("serproVerifiedAt").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("cpf_hash_idx").on(table.cpfHash)]
);

// ── Age Verification ──────────────────────────────────

export const ageVerification = pgTable("age_verification", {
  id: uuid("id").defaultRandom().primaryKey(),
  externalUserId: text("externalUserId").notNull(),
  cpfCacheId: uuid("cpfCacheId").references(() => cpfCache.id),
  ageBracket: ageBracketEnum("ageBracket").notNull(),
  ageAtVerification: integer("ageAtVerification").notNull(),
  source: verificationSourceEnum("source").notNull(),
  ipAddress: text("ipAddress"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ── Parental Link ─────────────────────────────────────

export const parentalLink = pgTable("parental_link", {
  id: uuid("id").defaultRandom().primaryKey(),
  minorExternalId: text("minorExternalId").notNull(),
  guardianExternalId: text("guardianExternalId").notNull(),
  guardianVerificationId: uuid("guardianVerificationId").references(
    () => ageVerification.id
  ),
  status: parentalLinkStatusEnum("status").notNull().default("pending"),
  settings: jsonb("settings")
    .$type<{
      timeLimits?: { dailyMinutes: number; startHour: number; endHour: number };
      contentFilters?: string[];
      purchaseApproval?: boolean;
    }>()
    .default({}),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ── Audit Log (append-only) ───────────────────────────

export const auditLog = pgTable("audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  eventType: text("eventType").notNull(),
  actorId: text("actorId"),
  targetId: text("targetId"),
  payload: jsonb("payload").$type<Record<string, unknown>>(),
  ipAddress: text("ipAddress"),
});
