import { and, count, desc, eq } from "drizzle-orm";
import { db } from "./db";
import { things } from "./db/app-schema";
import { account, user } from "./db/schema";

/**
 * Deletes a person and everything they have: sign-ins, sessions, passkeys,
 * settings, chats, rules, their park, and connected accounts. Every table
 * points at the user with a cascading delete, so one row takes it all.
 */
export async function deleteAccount(userId: string) {
  await db.delete(user).where(eq(user.id, userId));
}

/** Whether a person can sign in with the given provider, such as "chatgpt". */
export async function hasSignIn(userId: string, providerId: string) {
  const rows = await db
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, providerId)))
    .limit(1);
  return rows.length > 0;
}

/** Finds a person by email, ignoring case. */
export async function findUserByEmail(email: string) {
  const rows = await db
    .select({ id: user.id, email: user.email, name: user.name })
    .from(user)
    .where(eq(user.email, email.trim().toLowerCase()))
    .limit(1);
  return rows[0] ?? null;
}

export type Person = {
  id: string;
  email: string;
  name: string;
  joinedAt: Date;
  things: number;
  google: boolean;
};

/** Everyone with an account, newest first, with how much each has planted. */
export async function listPeople(): Promise<Person[]> {
  const [people, counts, linked] = await Promise.all([
    db
      .select({ id: user.id, email: user.email, name: user.name, joinedAt: user.createdAt })
      .from(user)
      .orderBy(desc(user.createdAt))
      .limit(500),
    db.select({ userId: things.userId, n: count() }).from(things).groupBy(things.userId),
    db.select({ userId: account.userId }).from(account).where(eq(account.providerId, "google")),
  ]);
  const thingsOf = new Map(counts.map((c) => [c.userId, Number(c.n)]));
  const googleOf = new Set(linked.map((l) => l.userId));
  return people.map((p) => ({ ...p, things: thingsOf.get(p.id) ?? 0, google: googleOf.has(p.id) }));
}
