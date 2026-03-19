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

// ── Users (dashboard admins) ───────────────────────────

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  emailVerified: timestamp("email_verified"),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Better Auth tables ─────────────────────────────────

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const accounts = pgTable("accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const verifications = pgTable("verifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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
