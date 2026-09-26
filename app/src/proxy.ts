import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Quick gate: send visitors without a session cookie to sign-in before the
 * page renders. Every protected page still does the real check with
 * requireSession(), because a cookie alone proves nothing.
 */
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const url = new URL("/sign-in", request.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/chats/:path*", "/park/:path*", "/workflows/:path*", "/settings/:path*", "/owner/:path*"],
};
