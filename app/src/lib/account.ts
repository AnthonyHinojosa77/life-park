import { eq } from "drizzle-orm";
import { db } from "./db";
import { user } from "./db/schema";

/**
 * Deletes a person and everything they have: sign-ins, sessions, passkeys,
 * settings, chats, rules, their park, and connected accounts. Every table
 * points at the user with a cascading delete, so one row takes it all.
 */
export async function deleteAccount(userId: string) {
  await db.delete(user).where(eq(user.id, userId));
}
