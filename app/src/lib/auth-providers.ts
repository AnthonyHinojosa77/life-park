/**
 * Which sign-in providers have credentials configured.
 * Read on the server; the sign-in page only shows buttons for these.
 * LifePark offers the two that most people already have: Google and Apple.
 */
export type SocialProvider = "google" | "apple";

export const providerLabels: Record<SocialProvider, string> = {
  google: "Google",
  apple: "Apple",
};

type Env = Record<string, string | undefined>;

export function configuredProviders(env: Env = process.env): SocialProvider[] {
  const out: SocialProvider[] = [];
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) out.push("google");
  if (env.APPLE_CLIENT_ID && env.APPLE_TEAM_ID && env.APPLE_KEY_ID && env.APPLE_PRIVATE_KEY) {
    out.push("apple");
  }
  return out;
}
