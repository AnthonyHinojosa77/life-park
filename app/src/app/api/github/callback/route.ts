import { cookies } from "next/headers";
import { authBaseURL } from "@/lib/auth-url";
import { GitHubAccessError, STATE_COOKIE, exchangeCode, githubAvailable, installUrl, userInstallations } from "@/lib/github/app";
import { saveInstallations } from "@/lib/github/import";
import { getSession } from "@/lib/session";

/**
 * Where GitHub sends people back. Confirms which of LifePark's installations
 * this person can reach, keeps those, and sends them to the park, which brings
 * their repositories in. With no installation yet, sends them to install it.
 */
export async function GET(req: Request) {
  const base = authBaseURL();
  const session = await getSession();
  if (!session) return Response.redirect(`${base}/sign-in`, 302);
  if (!githubAvailable()) return Response.redirect(`${base}/park?github=unavailable`, 302);

  const url = new URL(req.url);
  const jar = await cookies();
  const expected = jar.get(STATE_COOKIE)?.value;
  jar.delete(STATE_COOKIE);
  const code = url.searchParams.get("code");
  // A missing or mismatched state means this round trip didn't start here.
  if (!code || !expected || url.searchParams.get("state") !== expected) {
    return Response.redirect(`${base}/park?github=failed`, 302);
  }
  try {
    const token = await exchangeCode(code, `${base}/api/github/callback`);
    const installs = await userInstallations(token);
    if (!installs.length) return Response.redirect(installUrl(), 302);
    await saveInstallations(session.user.id, installs);
    return Response.redirect(`${base}/park?github=connected`, 302);
  } catch (error) {
    if (!(error instanceof GitHubAccessError)) console.error("[github] callback", error);
    return Response.redirect(`${base}/park?github=failed`, 302);
  }
}
