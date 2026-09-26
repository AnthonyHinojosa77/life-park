import { notFound } from "next/navigation";
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

/** The models in Anthony's personal trial (plan step 5.1). */
export const trialModels = [
  { id: "openai/gpt-6-luna", name: "GPT-6 Luna" },
  { id: "qwen/qwen3.8-flash", name: "Qwen 3.8 Flash" },
  { id: "google/gemini-3.8-flash", name: "Gemini 3.8 Flash" },
] as const;

export function isTrialModel(id: string) {
  return trialModels.some((m) => m.id === id);
}
