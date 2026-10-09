/** US dollars per million tokens, from https://platform.claude.com/docs/en/about-claude/pricing (read 2026-10-09). */
type Price = { input: number; cacheWrite: number; cacheRead: number; output: number };

const prices: Record<string, Price> = {
  "claude-opus-5-5": { input: 4, cacheWrite: 5, cacheRead: 0.2, output: 20 },
  "claude-sonnet-5-5": { input: 2, cacheWrite: 2.5, cacheRead: 0.1, output: 10 },
  "claude-haiku-5-5": { input: 0.1, cacheWrite: 0.125, cacheRead: 0.01, output: 0.5 },
  // Where Anthropic sends a declined request instead (refusal fallbacks).
  "claude-opus-5": { input: 5, cacheWrite: 6.25, cacheRead: 0.5, output: 25 },
  "claude-sonnet-5": { input: 2, cacheWrite: 2.5, cacheRead: 0.2, output: 10 },
  "claude-opus-4-8": { input: 5, cacheWrite: 6.25, cacheRead: 0.5, output: 25 },
};

/** Claude Haiku 5.5 costs five times as much once a prompt passes 100,000 tokens. */
const haikuLong: Price = { input: 0.5, cacheWrite: 0.625, cacheRead: 0.05, output: 2.5 };

export type TokenUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

/** What one Claude call cost, in millionths of a dollar. Unknown models are priced as `fallbackModel`. */
export function costMicros(usage: TokenUsage, model: string, fallbackModel: string) {
  const written = usage.cache_creation_input_tokens ?? 0;
  const read = usage.cache_read_input_tokens ?? 0;
  const prompt = usage.input_tokens + written + read;
  let price = prices[model] ?? prices[fallbackModel];
  if (!price) return 0;
  if (model === "claude-haiku-5-5" && prompt > 100_000) price = haikuLong;
  // Per million tokens in dollars is the same number as per token in micro-dollars.
  return (
    usage.input_tokens * price.input +
    written * price.cacheWrite +
    read * price.cacheRead +
    usage.output_tokens * price.output
  );
}
