// @vitest-environment node
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, describe, expect, it, vi } from "vitest";
import { chatgptSignIn, withoutChatGPTTokens } from "./chatgpt-sign-in";

type Init = (ctx: unknown) => Promise<{ context?: { socialProviders: { id: string; requiresIdTokenNonce?: boolean; idToken?: unknown }[] } }>;

function fakeContext() {
  return { logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() }, socialProviders: [], baseURL: "http://localhost:3000/api/auth" };
}

const discovery = (issuer: string) => ({
  issuer,
  authorization_endpoint: `${issuer}/api/accounts/authorize`,
  token_endpoint: `${issuer}/api/accounts/oauth/token`,
  jwks_uri: `${issuer}/.well-known/jwks.json`,
  id_token_signing_alg_values_supported: ["RS256"],
});

const servers: http.Server[] = [];
async function serve(handler: http.RequestListener) {
  const server = http.createServer(handler);
  servers.push(server);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}
afterAll(() => servers.forEach((s) => (s.closeAllConnections(), s.close())));

describe("chatgptSignIn", () => {
  it("registers ChatGPT with ID-token checks and a nonce when OpenAI answers", async () => {
    let issuer = "";
    issuer = await serve((_, res) => res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(discovery(issuer))));
    const result = await (chatgptSignIn({ CHATGPT_CLIENT_ID: "oaiapp_test", CHATGPT_ISSUER: issuer }).init as Init)(fakeContext());
    const provider = result.context?.socialProviders.find((p) => p.id === "chatgpt");
    expect(provider).toBeDefined();
    expect(provider?.requiresIdTokenNonce).toBe(true);
    expect(provider?.idToken).toBeDefined();
  });

  it("leaves ChatGPT off, without failing, when OpenAI can't be reached", async () => {
    const ctx = fakeContext();
    const result = await (chatgptSignIn({ CHATGPT_CLIENT_ID: "oaiapp_test", CHATGPT_ISSUER: "http://127.0.0.1:9" }).init as Init)(ctx);
    expect(result).toEqual({});
    expect(ctx.logger.error).toHaveBeenCalledWith(expect.stringContaining("Sign in with ChatGPT is off"));
  });

  it("stays off when discovery names a different issuer", async () => {
    const issuer = await serve((_, res) =>
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(discovery("https://auth.example.com"))),
    );
    const ctx = fakeContext();
    expect(await (chatgptSignIn({ CHATGPT_CLIENT_ID: "oaiapp_test", CHATGPT_ISSUER: issuer }).init as Init)(ctx)).toEqual({});
    expect(ctx.logger.error).toHaveBeenCalledWith(expect.stringContaining("expected"));
  });

  it("refuses to run without OpenAI's signing keys", async () => {
    let issuer = "";
    issuer = await serve((_, res) => {
      const { jwks_uri, ...rest } = discovery(issuer);
      void jwks_uri;
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(rest));
    });
    const ctx = fakeContext();
    expect(await (chatgptSignIn({ CHATGPT_CLIENT_ID: "oaiapp_test", CHATGPT_ISSUER: issuer }).init as Init)(ctx)).toEqual({});
    expect(ctx.logger.error).toHaveBeenCalledWith(expect.stringContaining("requires verified ID tokens"));
  });
});

describe("withoutChatGPTTokens", () => {
  it("drops OpenAI's tokens and keeps who the person is", () => {
    const saved = withoutChatGPTTokens({ providerId: "chatgpt", accountId: "sub-1", idToken: "jwt", accessToken: "a", refreshToken: "r" });
    expect(saved).toMatchObject({ providerId: "chatgpt", accountId: "sub-1", idToken: null, accessToken: null, refreshToken: null });
  });

  it("leaves Google's tokens alone, which the park needs for imports", () => {
    const google = { providerId: "google", accessToken: "a", refreshToken: "r" };
    expect(withoutChatGPTTokens(google)).toBe(google);
  });
});
