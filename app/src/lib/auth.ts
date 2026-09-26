import { randomBytes } from "node:crypto";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { passkey } from "@better-auth/passkey";
import { importPKCS8, SignJWT } from "jose";
import { db } from "./db";
import { configuredProviders } from "./auth-providers";
import { authBaseURL, trustedAppOrigins } from "./auth-url";

const baseURL = authBaseURL();
const host = new URL(baseURL).hostname;

function secret() {
  const value = process.env.BETTER_AUTH_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    // Preview mode: a fresh random secret per server start. Nobody can forge a
    // session, but every restart signs everyone out. See src/lib/preview.ts.
    console.warn("[auth] BETTER_AUTH_SECRET is not set; using a temporary secret for this preview.");
    return randomBytes(32).toString("hex");
  }
  // Development and test only. Sessions signed with this are worthless outside this machine.
  return "work-park-development-secret-not-for-production";
}

/** Apple has no fixed client secret; it is a short-lived signed token built from a private key. */
async function appleClientSecret() {
  const key = await importPKCS8(
    process.env.APPLE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
    "ES256",
  );
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: process.env.APPLE_KEY_ID! })
    .setIssuer(process.env.APPLE_TEAM_ID!)
    .setSubject(process.env.APPLE_CLIENT_ID!)
    .setAudience("https://appleid.apple.com")
    .setIssuedAt()
    .setExpirationTime("180d")
    .sign(key);
}

function socialProviders() {
  const enabled = configuredProviders();
  const providers: Record<string, unknown> = {};
  if (enabled.includes("google")) {
    providers.google = {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      prompt: "select_account",
    };
  }
  if (enabled.includes("github")) {
    providers.github = {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    };
  }
  if (enabled.includes("microsoft")) {
    providers.microsoft = {
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
      tenantId: "common",
      prompt: "select_account",
    };
  }
  if (enabled.includes("apple")) {
    providers.apple = async () => ({
      clientId: process.env.APPLE_CLIENT_ID!,
      clientSecret: await appleClientSecret(),
      appBundleIdentifier: process.env.APPLE_APP_BUNDLE_IDENTIFIER,
    });
  }
  return providers;
}

export const auth = betterAuth({
  appName: "LifePark",
  baseURL,
  secret: secret(),
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: { enabled: true, minPasswordLength: 10 },
  socialProviders: socialProviders(),
  trustedOrigins: trustedAppOrigins(),
  plugins: [
    passkey({ rpID: host, rpName: "LifePark", origin: baseURL }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
