import { index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { user } from "./schema";
import type { ThingKind } from "../kinds";

/** Preferences chosen during onboarding and changed later in Settings. */
export const userSettings = pgTable("user_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  /** Left over from Work Park's model picker; nothing reads it now. */
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
    /** Millionths of a US dollar, priced from Anthropic's published rates. */
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

export { thingKinds, type ThingKind } from "../kinds";

/**
 * One thing in someone's life: a person, an event, a recipe, a file.
 * Filled from chat and from connected accounts. Each one has a spot in the park.
 */
export const things = pgTable(
  "things",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind").$type<ThingKind>().notNull(),
    title: text("title").notNull(),
    /** When it happens or happened: an event's start, a birthday, a file's last edit. */
    date: timestamp("date"),
    /** Kind-specific extras, like a birthday or a list's items. */
    detail: jsonb("detail").$type<Record<string, unknown>>().notNull().default({}),
    /** Where it came from: "chat", or a connected service such as "calendar". */
    source: text("source").notNull(),
    /** The item's id at its source, so a re-import updates instead of duplicating. */
    sourceId: text("source_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex("things_user_source_item").on(t.userId, t.source, t.sourceId),
    index("things_user_kind").on(t.userId, t.kind),
  ],
);

/** Which outside services someone chose to connect, and how the last import went. */
export const connections = pgTable(
  "connections",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    service: text("service").notNull(),
    status: text("status").$type<"connected" | "error">().notNull(),
    itemCount: integer("item_count").notNull().default(0),
    lastError: text("last_error"),
    lastImportedAt: timestamp("last_imported_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.service] })],
);

/**
 * GitHub App installations someone has confirmed are theirs. Each one gives
 * LifePark read-only access to the repositories its owner chose on GitHub.
 */
export const githubInstallations = pgTable(
  "github_installations",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    installationId: text("installation_id").notNull(),
    /** The GitHub account or organization it was installed on. */
    accountLogin: text("account_login").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.installationId] })],
);
