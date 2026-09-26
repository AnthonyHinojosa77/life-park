import { index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./schema";

/** Preferences chosen during onboarding and changed later in Settings. */
export const userSettings = pgTable("user_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  /** OpenRouter model ids shown in the main picker, in order. */
  favoriteModels: jsonb("favorite_models").$type<string[]>().notNull(),
  /** Primary navigation: a plain list or the park map. */
  navigation: text("navigation").$type<"list" | "park">().notNull(),
  /** Read-aloud voice: Speechify's API or the device's own. */
  voice: text("voice").$type<"speechify" | "device">().notNull(),
  /** Spending alert threshold per month, in US cents. */
  monthlyLimitCents: integer("monthly_limit_cents").notNull(),
  /** Owner-only model override for the model trial. Ignored for everyone else. */
  assistantModel: text("assistant_model"),
  onboardedAt: timestamp("onboarded_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

/** A chat thread. One tree on the park map. */
export const conversations = pgTable(
  "conversations",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    /** The model used for the latest turn; the picker starts here next time. */
    modelId: text("model_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    lastMessageAt: timestamp("last_message_at").defaultNow().notNull(),
  },
  (t) => [index("conversations_user_recent").on(t.userId, t.lastMessageAt)],
);

/** One message in a thread, stored as the same parts the interface renders. */
export const messages = pgTable(
  "messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role").$type<"user" | "assistant" | "system">().notNull(),
    parts: jsonb("parts").$type<unknown[]>().notNull(),
    /** Set on assistant messages. */
    modelId: text("model_id"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    /** Millionths of a US dollar, from OpenRouter's usage accounting. */
    costMicros: integer("cost_micros"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("messages_conversation_order").on(t.conversationId, t.createdAt)],
);

/** The operating rules sent as the system prompt on every request. */
export const rules = pgTable("rules", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
