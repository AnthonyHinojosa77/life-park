/**
 * Which sign-in providers have credentials configured.
 * Read on the server; the sign-in page only shows buttons for these.
 * LifePark offers the ones most people already have: Google, Apple, and ChatGPT.
 */
export type SocialProvider = "google" | "apple" | "chatgpt";

export const providerLabels: Record<SocialProvider, string> = {
  google: "Google",
  apple: "Apple",
  chatgpt: "ChatGPT",
};

type Env = Record<string, string | undefined>;

export function configuredProviders(env: Env = process.env): SocialProvider[] {
  const out: SocialProvider[] = [];
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) out.push("google");
  if (env.APPLE_CLIENT_ID && env.APPLE_TEAM_ID && env.APPLE_KEY_ID && env.APPLE_PRIVATE_KEY) {
    out.push("apple");
  }
  // OpenAI issues either a public client (ID only) or a confidential one (ID and secret).
  if (env.CHATGPT_CLIENT_ID) out.push("chatgpt");
  return out;
}

/** What to tell someone when a Google, Apple, or ChatGPT sign-in comes back with `?error=`. */
export function signInErrorMessage(code: string | undefined): string | null {
  if (!code) return null;
  switch (code) {
    case "account_not_linked":
      return "That email already has a LifePark account. Sign in the way you did before, then add this sign-in in Settings.";
    case "access_denied":
      return "Sign-in was cancelled. Pick a way to sign in when you're ready.";
    case "oauth_provider_not_found":
      return "That sign-in isn't available right now. Try another way.";
    default:
      return "That sign-in didn't go through. Try again, or pick another way.";
  }
}
