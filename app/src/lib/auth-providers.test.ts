import { describe, expect, it } from "vitest";
import { configuredProviders } from "./auth-providers";

describe("configuredProviders", () => {
  it("returns nothing when no credentials are set", () => {
    expect(configuredProviders({})).toEqual([]);
  });

  it("lists a provider only when both of its values are present", () => {
    expect(
      configuredProviders({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "s" }),
    ).toEqual(["google"]);
    expect(configuredProviders({ GOOGLE_CLIENT_ID: "id" })).toEqual([]);
  });

  it("no longer offers GitHub or Microsoft", () => {
    expect(
      configuredProviders({
        GITHUB_CLIENT_ID: "id",
        GITHUB_CLIENT_SECRET: "s",
        MICROSOFT_CLIENT_ID: "id",
        MICROSOFT_CLIENT_SECRET: "s",
      }),
    ).toEqual([]);
  });

  it("needs all four Apple values", () => {
    expect(
      configuredProviders({
        APPLE_CLIENT_ID: "a",
        APPLE_TEAM_ID: "b",
        APPLE_KEY_ID: "c",
      }),
    ).toEqual([]);
    expect(
      configuredProviders({
        APPLE_CLIENT_ID: "a",
        APPLE_TEAM_ID: "b",
        APPLE_KEY_ID: "c",
        APPLE_PRIVATE_KEY: "d",
      }),
    ).toEqual(["apple"]);
  });
});
