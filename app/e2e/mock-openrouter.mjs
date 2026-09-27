// A stand-in for OpenRouter's chat completions endpoint, for browser tests.
// Streams a fixed reply in the OpenAI-compatible SSE format, then usage with cost.
// Usage: node e2e/mock-openrouter.mjs [port]
import http from "node:http";

const port = Number(process.argv[2] ?? 3124);

let lastModel = "";

const server = http.createServer((req, res) => {
  // Lets a test ask which model the app requested most recently.
  if (req.method === "GET" && req.url === "/last-model") {
    res.writeHead(200, { "content-type": "text/plain" }).end(lastModel);
    return;
  }
  if (req.method !== "POST" || !req.url?.endsWith("/chat/completions")) {
    res.writeHead(404).end();
    return;
  }
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const parsed = JSON.parse(body);
    lastModel = parsed.model;
    const lastUser = [...parsed.messages].reverse().find((m) => m.role === "user");
    const content = lastUser?.content;
    const asked =
      typeof content === "string"
        ? content
        : Array.isArray(content)
          ? content.map((p) => p.text ?? "").join("")
          : "that";
    const last = parsed.messages[parsed.messages.length - 1];
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    const id = "chatcmpl-mock";
    // "Remember: X" makes the mock file X as a recipe with the park tool, then confirm.
    const remember = asked.match(/^Remember: (.+)$/);
    if (remember && last.role === "user" && parsed.tools?.some((t) => t.function?.name === "save_to_park")) {
      const call = {
        index: 0,
        id: "call_mock_1",
        type: "function",
        function: { name: "save_to_park", arguments: JSON.stringify({ kind: "recipe", title: remember[1] }) },
      };
      res.write(`data: ${JSON.stringify({ id, object: "chat.completion.chunk", model: parsed.model, choices: [{ index: 0, delta: { role: "assistant", tool_calls: [call] }, finish_reason: null }] })}\n\n`);
      res.write(`data: ${JSON.stringify({ id, object: "chat.completion.chunk", model: parsed.model, choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }], usage: { prompt_tokens: 20, completion_tokens: 5, total_tokens: 25, cost: 0.0001 } })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }
    const words = (last.role === "tool" ? "Saved it to your park." : `Hello from the mock. You asked: ${asked}`).split(" ");
    let i = 0;
    const tick = () => {
      if (i < words.length) {
        const delta = (i === 0 ? "" : " ") + words[i++];
        res.write(
          `data: ${JSON.stringify({ id, object: "chat.completion.chunk", model: parsed.model, choices: [{ index: 0, delta: { content: delta }, finish_reason: null }] })}\n\n`,
        );
        setTimeout(tick, 40);
      } else {
        res.write(
          `data: ${JSON.stringify({ id, object: "chat.completion.chunk", model: parsed.model, choices: [{ index: 0, delta: {}, finish_reason: "stop" }], usage: { prompt_tokens: 20, completion_tokens: words.length, total_tokens: 20 + words.length, cost: 0.00031 } })}\n\n`,
        );
        res.write("data: [DONE]\n\n");
        res.end();
      }
    };
    tick();
  });
});

server.listen(port, () => console.log(`mock openrouter on ${port}`));
