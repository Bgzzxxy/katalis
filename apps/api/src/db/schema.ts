import {
  boolean,
  bigserial,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash"),
  googleId: varchar("google_id", { length: 128 }).unique(),
  walletBalanceIdr: numeric("wallet_balance_idr", {
    precision: 14,
    scale: 4,
  })
    .notNull()
    .default("0"),
  unlimitedExpiresAt: timestamp("unlimited_expires_at", { withTimezone: true }),
  hasClaimedTrial: boolean("has_claimed_trial").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  keyPrefix: varchar("key_prefix", { length: 16 }).notNull(),
  keyHash: varchar("key_hash", { length: 64 }).notNull().unique(),
  spendLimitIdr: numeric("spend_limit_idr", { precision: 14, scale: 4 }),
  spentIdr: numeric("spent_idr", { precision: 14, scale: 4 })
    .notNull()
    .default("0"),
  isActive: boolean("is_active").notNull().default(true),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const paymentInvoices = pgTable("payment_invoices", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  planType: varchar("plan_type", { length: 32 }).notNull(),
  baseAmountIdr: integer("base_amount_idr").notNull(),
  bonusAmountIdr: integer("bonus_amount_idr").notNull().default(0),
  totalPayIdr: integer("total_pay_idr").notNull(),
  qrisString: text("qris_string").notNull(),
  providerRef: varchar("provider_ref", { length: 128 }).notNull().unique(),
  status: varchar("status", { length: 24 }).notNull().default("PENDING"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const usageLogs = pgTable("usage_logs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  apiKeyId: uuid("api_key_id")
    .notNull()
    .references(() => apiKeys.id),
  modelId: varchar("model_id", { length: 100 }).notNull(),
  poolTier: varchar("pool_tier", { length: 24 }).notNull(),
  upstreamProvider: varchar("upstream_provider", { length: 32 }).notNull(),
  promptTokens: integer("prompt_tokens").notNull(),
  completionTokens: integer("completion_tokens").notNull(),
  costChargedIdr: numeric("cost_charged_idr", { precision: 12, scale: 6 }).notNull(),
  latencyMs: integer("latency_ms").notNull(),
  httpStatus: integer("http_status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});