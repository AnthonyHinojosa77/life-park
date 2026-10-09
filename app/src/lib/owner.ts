import { notFound } from "next/navigation";
import { isModelChoice, modelChoices } from "./chat/model";
import { requireOnboarded } from "./session";

type Env = Record<string, string | undefined>;

/**
 * The owner dashboard is for whoever runs LifePark. Owners are listed by
 * email in OWNER_EMAILS (comma separated) in the hosting settings, never in code.
 */
export function ownerEmails(env: Env = process.env): string[] {
  return (env.OWNER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isOwner(email: string | null | undefined, env: Env = process.env) {
  return !!email && ownerEmails(env).includes(email.trim().toLowerCase());
}

/** For owner-only pages. Everyone else sees an ordinary "not found" page. */
export async function requireOwner() {
  const result = await requireOnboarded();
  if (!isOwner(result.session.user.email)) notFound();
  return result;
}

/** The models in Anthony's personal trial (plan step 5.1): the Claude 5.5 family, or smart routing across it. */
export const trialModels = modelChoices;

export const isTrialModel = isModelChoice;
