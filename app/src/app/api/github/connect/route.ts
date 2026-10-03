import { cookies } from "next/headers";
import { authBaseURL } from "@/lib/auth-url";
import { STATE_COOKIE, authorizeUrl, githubAvailable, newState } from "@/lib/github/app";
import { getSession } from "@/lib/session";

/**
 * Starts connecting GitHub: GitHub asks the person to confirm it's them, then
 * sends them back to /api/github/callback. GitHub also sends people here after
 * they install the app (it is the app's setup address), which confirms the new
 * installation the same way.
 */
export async function GET() {
  const base = authBaseURL();
  if (!(await getSession())) return Response.redirect(`${base}/sign-in`, 302);
  if (!githubAvailable()) return Response.redirect(`${base}/park?github=unavailable`, 302);
  const state = newState();
  (await cookies()).set(STATE_COOKIE, state, { httpOnly: true, secure: base.startsWith("https"), sameSite: "lax", maxAge: 600, path: "/" });
  return Response.redirect(authorizeUrl(state, `${base}/api/github/callback`), 302);
}
