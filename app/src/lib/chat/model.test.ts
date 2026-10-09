// @vitest-environment node
import { describe, expect, it } from "vitest";
import { anthropicClient, assistantModelId, defaultAssistantModel, ModelsUnavailableError } from "./model";

describe("assistantModelId", () => {
  it("runs on Claude Opus 5.5 when nothing is set", () => {
    expect(defaultAssistantModel).toBe("claude-opus-5-5");
    expect(assistantModelId({})).toBe("claude-opus-5-5");
  });

  it("lets LIFEPARK_MODEL switch to another Claude 5.5 model without a code change", () => {
    expect(assistantModelId({ LIFEPARK_MODEL: " claude-sonnet-5-5 " })).toBe("claude-sonnet-5-5");
    expect(assistantModelId({ LIFEPARK_MODEL: "claude-haiku-5-5" })).toBe("claude-haiku-5-5");
  });

  it("ignores an empty override or a model LifePark doesn't run on", () => {
    expect(assistantModelId({ LIFEPARK_MODEL: "  " })).toBe(defaultAssistantModel);
    expect(assistantModelId({ LIFEPARK_MODEL: "google/gemini-3.8-flash" })).toBe(defaultAssistantModel);
  });
});

describe("anthropicClient", () => {
  it("needs the owner's Anthropic API key", () => {
    expect(() => anthropicClient({})).toThrow(ModelsUnavailableError);
    expect(anthropicClient({ ANTHROPIC_API_KEY: "sk-ant-test" }).apiKey).toBe("sk-ant-test");
  });
});
