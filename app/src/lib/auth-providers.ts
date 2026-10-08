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

const isProvider = (id: string | undefined): id is SocialProvider => !!id && id in providerLabels;

/**
 * What to tell someone when a Google, Apple, or ChatGPT sign-in comes back with
 * `?error=`. `from` is the provider they tapped.
 */
export function signInErrorMessage(code: string | undefined, from?: string): string | null {
  if (!code) return null;
  const provider = isProvider(from) ? from : undefined;
  switch (code) {
    case "unable_to_link_account":
      // For ChatGPT this is LifePark refusing to join an existing account by email;
      // for Google or Apple it only happens when saving fails.
      if (provider !== "chatgpt") return "That sign-in didn't go through. Try again, or pick another way.";
    // falls through
    case "account_not_linked":
      // Only ChatGPT can be added from Settings; Google is connected from the park instead.
      return provider === "chatgpt"
        ? "That email already has a LifePark account. Sign in the way you did before, then add ChatGPT in Settings."
        : "That email already has a LifePark account. Sign in the way you did before.";
    case "access_denied":
      return "Sign-in was cancelled. Pick a way to sign in when you're ready.";
    case "oauth_provider_not_found":
      return "That sign-in isn't available right now. Pick another way.";
    case "email_not_found":
      return `${provider ? providerLabels[provider] : "That account"} didn't share an email address, and LifePark needs one. Pick another way to sign in.`;
    default:
      return "That sign-in didn't go through. Try again, or pick another way.";
  }
}

/** What to tell someone when adding ChatGPT from Settings comes back with `?error=`. */
export function chatgptLinkErrorMessage(code: string | undefined): string {
  switch (code) {
    case "access_denied":
      return "ChatGPT wasn't added because the sign-in was cancelled.";
    case "account_already_linked_to_different_user":
      return "That ChatGPT account already signs in to a different LifePark account.";
    case "unable_to_link_account":
      return "ChatGPT wasn't added because OpenAI hasn't confirmed that account's email address.";
    default:
      return "ChatGPT wasn't added. Try again in a moment.";
  }
}
