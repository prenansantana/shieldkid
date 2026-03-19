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
]);

// ── Auth tables (managed by Better Auth via pg Pool) ───
// Tables: "user", "session", "account", "verification"
// These use camelCase columns and are NOT managed by Drizzle.
// See src/server/lib/auth.ts for config.

// ── Settings (single-tenant config) ────────────────────

export const settings = pgTable("settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  serproApiUrl: text("serpro_api_url")
    .notNull()
    .default("https://gateway.apiserpro.serpro.gov.br"),
  serproClientId: text("serpro_client_id"),
  serproClientSecret: text("serpro_client_secret"),
  webhookUrl: text("webhook_url"),
  webhookSecret: text("webhook_secret"),
  webhookEvents: jsonb("webhook_events").$type<string[]>().default([]),
  emailProvider: text("email_provider").default("resend"),
  emailConfig: jsonb("email_config").$type<Record<string, string>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── API Tokens ─────────────────────────────────────────

export const apiTokens = pgTable("api_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── CPF Cache (eternal — birthdate never changes) ──────

export const cpfCache = pgTable(
  "cpf_cache",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cpfHash: text("cpf_hash").notNull(),
    birthDateEncrypted: text("birth_date_encrypted").notNull(),
    cpfStatus: cpfStatusEnum("cpf_status").notNull().default("regular"),
    serproVerifiedAt: timestamp("serpro_verified_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("cpf_hash_idx").on(table.cpfHash)]
);

// ── Age Verifications ──────────────────────────────────

export const ageVerifications = pgTable("age_verifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  externalUserId: text("external_user_id").notNull(),
  cpfCacheId: uuid("cpf_cache_id").references(() => cpfCache.id),
  ageBracket: ageBracketEnum("age_bracket").notNull(),
  ageAtVerification: integer("age_at_verification").notNull(),
  source: verificationSourceEnum("source").notNull(),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Parental Links ─────────────────────────────────────

export const parentalLinks = pgTable("parental_links", {
  id: uuid("id").defaultRandom().primaryKey(),
  minorExternalId: text("minor_external_id").notNull(),
  guardianExternalId: text("guardian_external_id").notNull(),
  guardianVerificationId: uuid("guardian_verification_id").references(
    () => ageVerifications.id
  ),
  status: parentalLinkStatusEnum("status").notNull().default("pending"),
  settings: jsonb("settings")
    .$type<{
      timeLimits?: { dailyMinutes: number; startHour: number; endHour: number };
      contentFilters?: string[];
      purchaseApproval?: boolean;
    }>()
    .default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Audit Logs (append-only) ───────────────────────────

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  eventType: text("event_type").notNull(),
  actorId: text("actor_id"),
  targetId: text("target_id"),
  payload: jsonb("payload").$type<Record<string, unknown>>(),
  ipAddress: text("ip_address"),
});
