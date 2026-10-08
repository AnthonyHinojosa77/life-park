import type { BetterAuthPlugin } from "better-auth";
import { genericOAuth } from "better-auth/plugins/generic-oauth";

type Env = Record<string, string | undefined>;

/** OpenAI's sign-in server. Tests point CHATGPT_ISSUER at a stand-in. */
export const CHATGPT_ISSUER = "https://auth.openai.com";

/** How long to wait for OpenAI's sign-in settings when the server starts. */
const DISCOVERY_TIMEOUT_MS = 5000;

/** "jane.doe@example.com" → "jane.doe", for ChatGPT accounts that have no name. */
const nameFromEmail = (email: unknown) => (typeof email === "string" ? email.split("@")[0] : "");

/**
 * Sign in with ChatGPT (OpenAI's OpenID Connect sign-in), identity only: OpenAI
 * tells LifePark the person's name, email, and picture, never their chats.
 *
 * Every sign-in sends a fresh state, PKCE challenge, and nonce, and the ID
 * token's signature, issuer, audience, expiry, and nonce are checked against
 * OpenAI's published keys before anyone is signed in. OpenAI's endpoints are
 * read from its discovery document when the server starts; if that fails or
 * stalls, only this button stops working, never Google, Apple, or email.
 */
export function chatgptSignIn(env: Env = process.env): BetterAuthPlugin {
  const issuer = (env.CHATGPT_ISSUER || CHATGPT_ISSUER).replace(/\/$/, "");
  const clientId = env.CHATGPT_CLIENT_ID!;
  const clientSecret = env.CHATGPT_CLIENT_SECRET || undefined;
  const plugin = genericOAuth({
    config: [
      {
        providerId: "chatgpt",
        name: "ChatGPT",
        discoveryUrl: `${issuer}/.well-known/openid-configuration`,
        requireIdTokenVerification: true,
        clientId,
        clientSecret,
        // A confidential client sends its secret only in the Basic header, as OpenAI requires.
        tokenEndpointAuth: clientSecret ? { method: "client_secret_basic" } : { method: "none" },
        tokenUrlParams: { client_id: clientId },
        scopes: ["openid", "profile", "email"],
        // Signing out of LifePark never signs anyone out of ChatGPT.
        disableProviderLogout: true,
        mapProfileToUser: (profile) => ({ name: profile.name || nameFromEmail(profile.email) }),
      },
    ],
  });
  const init = plugin.init!;
  return {
    ...plugin,
    init: async (ctx) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const stalled = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`no answer from ${issuer} in ${DISCOVERY_TIMEOUT_MS / 1000}s`)), DISCOVERY_TIMEOUT_MS);
      });
      try {
        return await Promise.race([init(ctx), stalled]);
      } catch (e) {
        ctx.logger.error(`[auth] Sign in with ChatGPT is off until the next restart: ${e instanceof Error ? e.message : e}`);
        return {};
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

/**
 * OpenAI asks partners not to keep its tokens after sign-in, and LifePark only
 * needs the verified account ID, so these are dropped before an account is saved.
 */
export function withoutChatGPTTokens<T extends { providerId?: string }>(account: T): T {
  if (account.providerId !== "chatgpt") return account;
  return { ...account, idToken: null, accessToken: null, refreshToken: null, accessTokenExpiresAt: null, refreshTokenExpiresAt: null };
}
