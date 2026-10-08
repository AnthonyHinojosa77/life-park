import { describe, expect, it } from "vitest";
import { chatgptLinkErrorMessage, configuredProviders, signInErrorMessage } from "./auth-providers";

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

  it("offers ChatGPT with just a client ID, since OpenAI also issues public clients", () => {
    expect(configuredProviders({ CHATGPT_CLIENT_ID: "oaiapp_x" })).toEqual(["chatgpt"]);
    expect(configuredProviders({ CHATGPT_CLIENT_SECRET: "s" })).toEqual([]);
  });
});

describe("signInErrorMessage", () => {
  it("says nothing when there was no error", () => {
    expect(signInErrorMessage(undefined)).toBeNull();
  });

  it("points someone with an existing account to Settings only for ChatGPT, the one it can add", () => {
    expect(signInErrorMessage("account_not_linked", "chatgpt")).toMatch(/already has a LifePark account.*add ChatGPT in Settings/);
    expect(signInErrorMessage("account_not_linked", "google")).not.toMatch(/Settings/);
    expect(signInErrorMessage("account_not_linked", "nonsense")).not.toMatch(/Settings/);
  });

  it("names the provider that shared no email", () => {
    expect(signInErrorMessage("email_not_found", "apple")).toMatch(/^Apple didn't share an email/);
  });

  it("has a plain message for anything else", () => {
    expect(signInErrorMessage("invalid_code")).toMatch(/didn't go through/);
  });
});

describe("chatgptLinkErrorMessage", () => {
  it("tells a cancel apart from a ChatGPT account that belongs to someone else", () => {
    expect(chatgptLinkErrorMessage("access_denied")).toMatch(/cancelled/);
    expect(chatgptLinkErrorMessage("account_already_linked_to_different_user")).toMatch(/different LifePark account/);
    expect(chatgptLinkErrorMessage("unable_to_link_account")).toMatch(/hasn't confirmed/);
    expect(chatgptLinkErrorMessage(undefined)).toMatch(/Try again/);
  });
});
