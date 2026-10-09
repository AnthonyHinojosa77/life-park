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
    expect(isTrialModel("claude-opus-5-5")).toBe(true);
    expect(isTrialModel("claude-haiku-5-5")).toBe(true);
    expect(isTrialModel("smart-routing")).toBe(true);
    expect(isTrialModel("qwen/qwen3.8-flash")).toBe(false);
  });
});
