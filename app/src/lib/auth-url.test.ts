import { describe, expect, it } from "vitest";
import { authBaseURL, trustedAppOrigins } from "./auth-url";

const production = {
  VERCEL_ENV: "production",
  VERCEL_URL: "work-park-abc123-team.vercel.app",
  VERCEL_BRANCH_URL: "work-park-git-main-team.vercel.app",
  VERCEL_PROJECT_PRODUCTION_URL: "work-park.vercel.app",
};

describe("auth addresses", () => {
  it("uses the public address in production, not the one-off deployment address", () => {
    expect(authBaseURL(production)).toBe("https://work-park.vercel.app");
  });

  it("trusts the public, branch, and deployment addresses", () => {
    const origins = trustedAppOrigins(production);
    expect(origins).toContain("https://work-park.vercel.app");
    expect(origins).toContain("https://work-park-git-main-team.vercel.app");
    expect(origins).toContain("https://work-park-abc123-team.vercel.app");
    expect(origins).toContain("https://life-park-app.vercel.app");
    expect(origins).toContain("https://lifepark.cohegen.net");
    expect(origins).toContain("https://appleid.apple.com");
    expect(new Set(origins).size).toBe(origins.length);
  });

  it("uses the branch address for previews", () => {
    expect(authBaseURL({ ...production, VERCEL_ENV: "preview" })).toBe("https://work-park-git-main-team.vercel.app");
  });

  it("lets an explicit setting win", () => {
    expect(authBaseURL({ ...production, BETTER_AUTH_URL: "https://lifepark.app" })).toBe("https://lifepark.app");
  });

  it("uses the CoheGen domain for sign-in and passkeys when configured, retaining old launch addresses", () => {
    const env = { ...production, BETTER_AUTH_URL: "https://lifepark.cohegen.net" };
    expect(authBaseURL(env)).toBe("https://lifepark.cohegen.net");
    expect(trustedAppOrigins(env)).toContain("https://work-park.vercel.app");
    expect(trustedAppOrigins(env)).toContain("https://life-park-app.vercel.app");
  });

  it("does not trust the production suite domain on preview deployments", () => {
    expect(trustedAppOrigins({ ...production, VERCEL_ENV: "preview" })).not.toContain("https://lifepark.cohegen.net");
  });

  it("falls back to localhost for development", () => {
    expect(authBaseURL({})).toBe("http://localhost:3000");
    expect(trustedAppOrigins({})).toEqual(["http://localhost:3000", "https://appleid.apple.com"]);
  });
});
