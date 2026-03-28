import {
  pgTable,
  text,
  timestamp,
  serial,
  json,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ── Users ──────────────────────────────────────────────
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  passwordHash: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ── Plaid Items (linked brokerage accounts) ────────────
export const plaidItems = pgTable("plaid_items", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token").notNull(), // AES-256-GCM encrypted
  itemId: text("item_id").notNull().unique(),
  institutionName: text("institution_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PlaidItem = typeof plaidItems.$inferSelect;

// ── Cached Holdings (per-user, with TTL) ───────────────
export const cachedHoldings = pgTable("cached_holdings", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  data: json("data").notNull(),
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
});

// ── Market Data Cache (shared across all users) ────────
export const marketDataCache = pgTable("market_data_cache", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(), // e.g., 'vix', 'quote_spy', 'sectors'
  data: json("data").notNull(),
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
});

// ── Auth Schemas ───────────────────────────────────────
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type LoginRequest = z.infer<typeof loginSchema>;
export type RegisterRequest = z.infer<typeof registerSchema>;
