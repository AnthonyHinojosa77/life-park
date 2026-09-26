import { and, countDistinct, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { conversations, messages } from "@/lib/db/app-schema";

export type CostSummary = {
  monthStart: Date;
  monthMicros: number;
  byModel: { modelId: string; micros: number; replies: number }[];
  byDay: { day: string; micros: number }[];
  /** People with at least one reply this month. */
  activePeople: number;
};

/**
 * Spend for the current calendar month, from OpenRouter's reported cost per
 * reply. Pass a user id for one person, or null for everyone (owner dashboard).
 */
export async function monthlyCosts(userId: string | null, now = new Date()): Promise<CostSummary> {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const scope = and(
    userId ? eq(conversations.userId, userId) : undefined,
    eq(messages.role, "assistant"),
    gte(messages.createdAt, monthStart),
  );

  const byModel = await db
    .select({
      modelId: messages.modelId,
      micros: sql<number>`coalesce(sum(${messages.costMicros}), 0)::int`,
      replies: sql<number>`count(*)::int`,
    })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(scope)
    .groupBy(messages.modelId)
    .orderBy(sql`sum(${messages.costMicros}) desc nulls last`);

  const byDay = await db
    .select({
      day: sql<string>`to_char(${messages.createdAt}, 'YYYY-MM-DD')`,
      micros: sql<number>`coalesce(sum(${messages.costMicros}), 0)::int`,
    })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(scope)
    .groupBy(sql`to_char(${messages.createdAt}, 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(${messages.createdAt}, 'YYYY-MM-DD')`);

  const [people] = await db
    .select({ n: countDistinct(conversations.userId) })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(scope);

  return {
    monthStart,
    activePeople: Number(people?.n ?? 0),
    monthMicros: byModel.reduce((sum, r) => sum + r.micros, 0),
    byModel: byModel.map((r) => ({ modelId: r.modelId ?? "unknown", micros: r.micros, replies: r.replies })),
    byDay,
  };
}

/** "$0.0042" style, with more precision for tiny amounts. */
export function formatDollars(micros: number) {
  const dollars = micros / 1_000_000;
  if (dollars === 0) return "$0.00";
  if (dollars < 0.01) return `$${dollars.toFixed(4)}`;
  return `$${dollars.toFixed(2)}`;
}
