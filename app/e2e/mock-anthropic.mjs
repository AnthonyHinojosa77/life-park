// A stand-in for Anthropic's Messages API (streaming), for tests. It holds
// LifePark to the rules of the Claude 5.5 models: thinking can't be switched
// off or given a budget, tools can't be forced, no sampling settings, the last
// message must be the user's, fallbacks need their beta header (and Haiku has
// none), and a thinking block must come back exactly as it was sent.
// "Remember: X" files X as a recipe with the park tool, "Remember badly: X"
// sends the tool input it doesn't accept, "Fallback, then remember: X" has the
// requested model start a tool call, decline, and hand over to a fallback
// model that makes its own, "Refuse this" is declined outright, and anything
// else gets "Hello from the mock. You asked: ...". When offered the hand_off
// tool (smart routing), Haiku passes on "Hard question: ..." and Haiku and
// Sonnet both pass on "Very hard question: ..."; "Remember, then pass it on: X"
// saves X and only then tries to pass it on, which is too late.
// Usage: node e2e/mock-anthropic.mjs [port]   (or import createMockAnthropic)
import { createHash } from "node:crypto";
import http from "node:http";
import { fileURLToPath } from "node:url";

const models = ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"];
const signature = (text) => "sig-" + createHash("sha256").update(text).digest("hex").slice(0, 16);

function problem(body, headers) {
  const betas = String(headers["anthropic-beta"] ?? "").split(",").map((b) => b.trim());
  if (!headers["x-api-key"]) return [401, "authentication_error", "x-api-key header is required"];
  if (headers["x-api-key"] === "bad-key") return [401, "authentication_error", "invalid x-api-key"];
  if (!models.includes(body.model)) return [404, "not_found_error", `model: ${body.model}`];
  if (!body.stream) return [400, "invalid_request_error", "this stand-in only streams"];
  if (body.thinking && body.thinking.type !== "adaptive") return [400, "invalid_request_error", `"thinking.type.${body.thinking.type}" is not supported for this model.`];
  if (body.tool_choice && ["any", "tool"].includes(body.tool_choice.type)) return [400, "invalid_request_error", 'tool_choice: type "tool" and "any" are not supported for this model.'];
  for (const key of ["temperature", "top_p", "top_k"]) if (key in body) return [400, "invalid_request_error", `${key} is not supported for this model.`];
  if (body.fallbacks !== undefined) {
    if (body.model === "claude-haiku-5-5") return [400, "invalid_request_error", "fallbacks: not supported for this model."];
    if (body.fallbacks !== "default" || !betas.includes("server-side-fallback-2026-07-01")) return [400, "invalid_request_error", "fallbacks: the default form needs server-side-fallback-2026-07-01"];
  }
  const messages = body.messages ?? [];
  if (messages[0]?.role !== "user") return [400, "invalid_request_error", "messages: the first message must be from the user"];
  if (messages.at(-1)?.role !== "user") return [400, "invalid_request_error", "messages: prefilling the assistant message is not supported for this model."];
  for (const [i, m] of messages.entries()) {
    for (const block of Array.isArray(m.content) ? m.content : []) {
      if (block.type === "thinking" && block.signature !== signature(block.thinking + i)) {
        return [400, "invalid_request_error", `messages.${i}.content: Invalid \`signature\` in \`thinking\` block.`];
      }
      if (block.type === "tool_use") {
        const answered = messages[i + 1]?.content;
        if (!Array.isArray(answered) || !answered.some((b) => b.type === "tool_result" && b.tool_use_id === block.id)) {
          return [400, "invalid_request_error", `messages.${i}: tool_use ids were found without tool_result blocks immediately after: ${block.id}`];
        }
      }
      if (block.type === "tool_result") {
        const asked = messages[i - 1]?.content;
        if (!Array.isArray(asked) || !asked.some((b) => b.type === "tool_use" && b.id === block.tool_use_id)) {
          return [400, "invalid_request_error", `messages.${i}: tool_result without a matching tool_use`];
        }
      }
    }
  }
  return null;
}

/** @returns {http.Server & { requests: { body: any; headers: http.IncomingHttpHeaders }[]; problems: string[] }} */
export function createMockAnthropic() {
  const server = http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/last-model") {
      res.writeHead(200, { "content-type": "text/plain" }).end(server.requests.at(-1)?.body.model ?? "");
      return;
    }
    if (req.method !== "POST" || !req.url?.startsWith("/v1/messages")) {
      res.writeHead(404).end();
      return;
    }
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const body = JSON.parse(raw);
      server.requests.push({ body, headers: req.headers });
      const failure = problem(body, req.headers);
      if (failure) {
        server.problems.push(failure[2]);
        res.writeHead(failure[0], { "content-type": "application/json" }).end(JSON.stringify({ type: "error", error: { type: failure[1], message: failure[2] } }));
        return;
      }
      const messages = body.messages;
      const last = messages.at(-1);
      const lastUserText = messages.filter((m) => m.role === "user" && typeof m.content === "string").at(-1)?.content ?? "";
      const toolsGiven = (body.tools ?? []).map((t) => t.name);

      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
      const send = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
      const usage = { input_tokens: 20, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };
      send("message_start", { message: { id: "msg_mock", type: "message", role: "assistant", model: body.model, content: [], stop_reason: null, stop_sequence: null, usage } });
      // Every reply opens with a thinking block, empty as on the real API under the default display.
      const thinking = "";
      send("content_block_start", { index: 0, content_block: { type: "thinking", thinking: "", signature: "" } });
      send("content_block_delta", { index: 0, delta: { type: "signature_delta", signature: signature(thinking + messages.length) } });
      send("content_block_stop", { index: 0 });

      const finish = (stopReason, outputTokens, extra = {}, iterations) => {
        send("message_delta", { delta: { stop_reason: stopReason, stop_sequence: null, ...extra }, usage: { output_tokens: outputTokens, ...(iterations ? { iterations } : {}) } });
        send("message_stop", {});
        res.end();
      };
      const toolCall = (index, id, input, name = "save_to_park") => {
        const json = JSON.stringify(input);
        send("content_block_start", { index, content_block: { type: "tool_use", id, name, input: {} } });
        send("content_block_delta", { index, delta: { type: "input_json_delta", partial_json: json.slice(0, 10) } });
        send("content_block_delta", { index, delta: { type: "input_json_delta", partial_json: json.slice(10) } });
        send("content_block_stop", { index });
      };
      const remember = lastUserText.match(/^(Remember|Remember badly|Fallback, then remember|Remember, then pass it on): (.+)$/);
      const toolResults = Array.isArray(last.content) ? last.content.filter((b) => b.type === "tool_result") : [];
      const afterTool = toolResults.length > 0;
      const canPass = toolsGiven.includes("hand_off");
      const tooHard =
        (/^Hard question/.test(lastUserText) && body.model === "claude-haiku-5-5") ||
        (/^Very hard question/.test(lastUserText) && body.model !== "claude-opus-5-5");
      if (canPass && !afterTool && tooHard) {
        // A sentence slips out before the hand-off; the app must take it back.
        send("content_block_start", { index: 1, content_block: { type: "text", text: "" } });
        send("content_block_delta", { index: 1, delta: { type: "text_delta", text: "Let me think about" } });
        send("content_block_stop", { index: 1 });
        toolCall(2, `toolu_pass_${body.model}`, { reason: "needs more reasoning" }, "hand_off");
        finish("tool_use", 8);
        return;
      }
      const lateTry = remember?.[1] === "Remember, then pass it on" && canPass;
      if (lateTry && afterTool && toolResults.some((b) => b.tool_use_id === "toolu_mock_1")) {
        toolCall(1, "toolu_late_pass", { reason: "changed my mind" }, "hand_off");
        finish("tool_use", 5);
        return;
      }
      if (remember && !afterTool && toolsGiven.includes("save_to_park")) {
        const [, how, title] = remember;
        if (how === "Fallback, then remember") {
          toolCall(1, "toolu_declined", { kind: "recipe", title: `declined ${title}` });
          send("content_block_start", { index: 2, content_block: { type: "fallback", from: { model: body.model }, to: { model: "claude-opus-4-8" }, trigger: { type: "refusal", category: "cyber" } } });
          send("content_block_stop", { index: 2 });
          toolCall(3, "toolu_fallback", { kind: "recipe", title });
          finish("tool_use", 5, {}, [
            { type: "message", model: body.model, input_tokens: 20, output_tokens: 3, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
            { type: "fallback_message", model: "claude-opus-4-8", input_tokens: 20, output_tokens: 5, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
          ]);
          return;
        }
        toolCall(1, "toolu_mock_1", how === "Remember badly" ? { kind: "spaceship", title } : { kind: "recipe", title });
        finish("tool_use", 5);
        return;
      }
      const refuse = lastUserText === "Refuse this";
      const failed = toolResults.some((b) => b.is_error && b.tool_use_id !== "toolu_late_pass");
      const words = (afterTool ? (failed ? "That didn't save." : "Saved it to your park.") : refuse ? "Partial words before" : `Hello from the mock. You asked: ${lastUserText}`).split(" ");
      send("content_block_start", { index: 1, content_block: { type: "text", text: "" } });
      let i = 0;
      const tick = () => {
        if (i < words.length) {
          send("content_block_delta", { index: 1, delta: { type: "text_delta", text: (i === 0 ? "" : " ") + words[i++] } });
          setTimeout(tick, 30);
          return;
        }
        send("content_block_stop", { index: 1 });
        if (refuse) finish("refusal", words.length, { stop_details: { type: "refusal", category: "cyber", explanation: null } });
        else finish("end_turn", words.length);
      };
      tick();
    });
  });
  return Object.assign(server, { requests: [], problems: [] });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2] ?? 3124);
  createMockAnthropic().listen(port, () => console.log(`mock anthropic on ${port}`));
}
