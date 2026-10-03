"use client";

/**
 * Sends the person to GitHub to connect their repositories. A full page load,
 * not an in-app navigation: the address is a server route that hands off to GitHub.
 */
export function connectGitHub() {
  window.location.assign(new URL("/api/github/connect", window.location.origin).href);
}
