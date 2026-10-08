import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware, getOAuthState } from "better-auth/api";
import { genericOAuth } from "better-auth/plugins/generic-oauth";
import { decodeJwt } from "jose";

type Env = Record<string, string | undefined>;

/** OpenAI's sign-in server. Tests point CHATGPT_ISSUER at a stand-in. */
export const CHATGPT_ISSUER = "https://auth.openai.com";

/**
 * How long to wait for OpenAI's sign-in settings when the server starts. Every
 * sign-in on a fresh server waits for this, so it is kept short.
 */
const DISCOVERY_TIMEOUT_MS = 2000;

/** "jane.doe@example.com" → "jane.doe", for ChatGPT accounts that have no name. */
const nameFromEmail = (email: unknown) => (typeof email === "string" ? email.split("@")[0] : "");

/**
 * Sign in with ChatGPT (OpenAI's OpenID Connect sign-in), identity only: OpenAI
 * tells LifePark the person's name, email, and picture, never their chats.
 *
 * Every sign-in sends a fresh state, PKCE challenge, and nonce, and the ID
 * token's signature, issuer, audience, expiry, and nonce are checked against
 * OpenAI's published keys before anyone is signed in. OpenAI's endpoints are
 * read from its discovery document when the server starts; if that fails,
 * stalls, or names a different issuer, only this button stops working, never
 * Google, Apple, or email.
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
        // ChatGPT accounts are keyed by this issuer and OpenAI's `sub`, whatever discovery says.
        accountIssuer: issuer,
        clientId,
        clientSecret,
        // A confidential client sends its secret only in the Basic header, as OpenAI requires.
        tokenEndpointAuth: clientSecret ? { method: "client_secret_basic" } : { method: "none" },
        tokenUrlParams: { client_id: clientId },
        scopes: ["openid", "profile", "email"],
        // Signing out of LifePark never signs anyone out of ChatGPT.
        disableProviderLogout: true,
        // Identity comes only from the ID token, which is already verified by the time this runs.
        getUserInfo: async (tokens) => {
          if (!tokens.idToken) return null;
          const claims = decodeJwt(tokens.idToken);
          if (typeof claims.sub !== "string" || !claims.sub || !claims.exp || !claims.iat) return null;
          return {
            ...claims,
            id: claims.sub,
            sub: claims.sub,
            email: typeof claims.email === "string" ? claims.email : undefined,
            emailVerified: claims.email_verified === true,
            name: typeof claims.name === "string" ? claims.name : undefined,
            image: typeof claims.picture === "string" ? claims.picture : undefined,
          };
        },
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
        const result = await Promise.race([init(ctx), stalled]);
        const provider = result?.context?.socialProviders?.find((p) => p.id === "chatgpt");
        if (provider?.issuer !== issuer) throw new Error(`discovery named issuer ${provider?.issuer}, expected ${issuer}`);
        return result;
      } catch (e) {
        ctx.logger.error(`[auth] Sign in with ChatGPT is off until the next restart: ${e instanceof Error ? e.message : e}`);
        return {};
      } finally {
        clearTimeout(timer);
      }
    },
    hooks: {
      // better-auth can also sign someone in from an ID token posted straight to
      // it, which skips the one-time state and nonce. ChatGPT sign-in only ever
      // goes through OpenAI's page and back, so that shortcut is refused.
      before: [
        {
          matcher: (ctx) =>
            (ctx.path === "/sign-in/social" || ctx.path === "/link-social") &&
            ctx.body?.provider === "chatgpt" &&
            !!ctx.body?.idToken,
          handler: createAuthMiddleware(async () => {
            throw new APIError("BAD_REQUEST", { message: "Sign in with ChatGPT through OpenAI's page." });
          }),
        },
      ],
    },
  };
}

type HookContext = {
  path?: string;
  context: { internalAdapter: { findAccounts: (userId: string) => Promise<unknown[]> } };
} | null;

/**
 * An email match alone isn't proof that a ChatGPT account belongs to the
 * LifePark account with that email (OpenAI's guidance), so a ChatGPT sign-in
 * never joins an existing account by itself. The person signs in the way they
 * did before and adds ChatGPT from Settings, which is allowed. Returns false to
 * stop the account from being saved.
 */
export async function allowChatGPTAccount(account: { providerId?: string; userId?: string }, ctx: HookContext) {
  if (account.providerId !== "chatgpt" || !ctx?.path?.startsWith("/callback") || !account.userId) return true;
  if ((await getOAuthState())?.link) return true;
  // A brand-new person has no other sign-ins yet.
  return (await ctx.context.internalAdapter.findAccounts(account.userId)).length === 0;
}

/**
 * OpenAI asks partners not to keep its tokens after sign-in, and LifePark only
 * needs the verified account ID, so these are dropped before an account is saved.
 */
export function withoutChatGPTTokens<T extends { providerId?: string }>(account: T): T {
  if (account.providerId !== "chatgpt") return account;
  return { ...account, idToken: null, accessToken: null, refreshToken: null, accessTokenExpiresAt: null, refreshTokenExpiresAt: null };
}
