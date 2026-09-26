import { describe, expect, it } from "vitest";
import { isOwner, isTrialModel, ownerEmails } from "./owner";

describe("owner", () => {
  it("reads a comma-separated list, ignoring case and spaces", () => {
    expect(ownerEmails({ OWNER_EMAILS: " A@x.com, b@y.com ,," })).toEqual(["a@x.com", "b@y.com"]);
  });

  it("matches only listed emails", () => {
    const env = { OWNER_EMAILS: "boss@example.com" };
    expect(isOwner("Boss@Example.com", env)).toBe(true);
    expect(isOwner("someone@example.com", env)).toBe(false);
    expect(isOwner(undefined, env)).toBe(false);
  });

  it("has no owners when the setting is missing", () => {
    expect(isOwner("boss@example.com", {})).toBe(false);
  });

  it("knows the trial models", () => {
    expect(isTrialModel("openai/gpt-6-luna")).toBe(true);
    expect(isTrialModel("z-ai/glm-5.3-flash")).toBe(true);
    expect(isTrialModel("acme/other")).toBe(false);
  });
});
