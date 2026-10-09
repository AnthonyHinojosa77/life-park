import { describe, expect, it } from "vitest";
import { costMicros } from "./pricing";

const usage = (input: number, output: number, written = 0, read = 0) => ({
  input_tokens: input,
  output_tokens: output,
  cache_creation_input_tokens: written,
  cache_read_input_tokens: read,
});

describe("costMicros", () => {
  it("prices Claude Opus 5.5 at $4 in, $20 out, and cache reads at $0.20", () => {
    expect(costMicros(usage(1_000_000, 0), "claude-opus-5-5", "claude-opus-5-5")).toBe(4_000_000);
    expect(costMicros(usage(0, 1_000_000), "claude-opus-5-5", "claude-opus-5-5")).toBe(20_000_000);
    expect(costMicros(usage(0, 0, 1_000_000, 1_000_000), "claude-opus-5-5", "claude-opus-5-5")).toBe(5_200_000);
  });

  it("prices Claude Sonnet 5.5 cache reads at $0.10", () => {
    expect(costMicros(usage(0, 0, 0, 1_000_000), "claude-sonnet-5-5", "claude-sonnet-5-5")).toBe(100_000);
  });

  it("charges Claude Haiku 5.5's long-prompt rate past 100,000 prompt tokens, cache included", () => {
    expect(costMicros(usage(100_000, 0), "claude-haiku-5-5", "claude-haiku-5-5")).toBe(10_000);
    expect(costMicros(usage(50_000, 0, 0, 60_000), "claude-haiku-5-5", "claude-haiku-5-5")).toBe(25_000 + 3_000);
  });

  it("prices a fallback model at its own rate, and an unknown one as the requested model", () => {
    expect(costMicros(usage(1_000_000, 0), "claude-opus-4-8", "claude-opus-5-5")).toBe(5_000_000);
    expect(costMicros(usage(0, 0, 0, 1_000_000), "claude-sonnet-5", "claude-sonnet-5-5")).toBe(200_000);
    expect(costMicros(usage(1_000_000, 0), "claude-someday-9", "claude-sonnet-5-5")).toBe(2_000_000);
  });
});
