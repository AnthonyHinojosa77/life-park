// @vitest-environment node
import { describe, expect, it } from "vitest";
import { assistantModelId, defaultAssistantModel } from "./model";

describe("assistantModelId", () => {
  it("uses the provisional default when nothing is set", () => {
    expect(assistantModelId({})).toBe(defaultAssistantModel);
  });

  it("lets LIFEPARK_MODEL swap the model without a code change", () => {
    expect(assistantModelId({ LIFEPARK_MODEL: " anthropic/claude-sonnet-5 " })).toBe("anthropic/claude-sonnet-5");
  });

  it("ignores an empty override", () => {
    expect(assistantModelId({ LIFEPARK_MODEL: "  " })).toBe(defaultAssistantModel);
  });
});
