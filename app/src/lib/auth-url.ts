type Env = Record<string, string | undefined>;

const https = (host: string | undefined) => (host ? `https://${host}` : undefined);

/** Every public address the live site answers on. Vercel reports only one of them. */
export const publicAddresses = ["work-park.vercel.app", "life-park-app.vercel.app"];

/**
 * The address sign-in cookies and passkeys belong to. On Vercel, production
 * uses the project's public address (work-park.vercel.app today), not the
 * one-off address of the individual deployment.
 */
export function authBaseURL(env: Env = process.env) {
  if (env.BETTER_AUTH_URL) return env.BETTER_AUTH_URL;
  if (env.VERCEL_ENV === "production" && env.VERCEL_PROJECT_PRODUCTION_URL) {
    return https(env.VERCEL_PROJECT_PRODUCTION_URL)!;
  }
  return https(env.VERCEL_BRANCH_URL) ?? https(env.VERCEL_URL) ?? "http://localhost:3000";
}

/**
 * Every address a browser may legitimately sign in from. Browsers send the
 * page's address with each sign-in request, and anything not listed is refused.
 */
export function trustedAppOrigins(env: Env = process.env) {
  const origins = [
    authBaseURL(env),
    https(env.VERCEL_PROJECT_PRODUCTION_URL),
    https(env.VERCEL_BRANCH_URL),
    https(env.VERCEL_URL),
    ...(env.VERCEL_ENV === "production" ? publicAddresses.map(https) : []),
    "https://appleid.apple.com",
  ].filter((o): o is string => !!o);
  return [...new Set(origins)];
}
