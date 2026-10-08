// A stand-in for OpenAI's "Sign in with ChatGPT" server (auth.openai.com), so
// the sign-in can be tested without OpenAI. It holds LifePark to OpenAI's
// website guide: an exact callback URL, `openid profile email`, a fresh state,
// PKCE (S256), and nonce on every sign-in, the registered client
// authentication, and a signed ID token as the only thing it hands back.
// Usage: import { createMockOpenAI } from "./mock-openai.mjs"
import { createHash, generateKeyPairSync, randomBytes } from "node:crypto";
import http from "node:http";
import { exportJWK, SignJWT } from "jose";

/**
 * @param {{ base: string, clientId: string, redirectUri: string, clientSecret?: string }} opts
 * Set `server.identity` to choose who signs in next, `server.mode` to break
 * one thing on purpose ("deny", "bad-nonce", "bad-audience", "bad-signature"),
 * and `server.clientSecret` to act as a confidential client.
 */
export function createMockOpenAI({ base, clientId, redirectUri, clientSecret }) {
  const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const stranger = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const codes = new Map();

  const fail = (res, status, message) => {
    server.problems.push(message);
    res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify({ error: "invalid_request", error_description: message }));
  };

  async function idToken(nonce) {
    const { mode, identity } = server;
    return new SignJWT({
      email: identity.email,
      email_verified: identity.emailVerified ?? true,
      ...(identity.name ? { name: identity.name } : {}),
      picture: "https://example.com/avatar.png",
      nonce: mode === "bad-nonce" ? "someone-elses-nonce" : nonce,
    })
      .setProtectedHeader({ alg: "RS256", kid: "mock-key" })
      .setIssuer(base)
      .setAudience(mode === "bad-audience" ? "oaiapp_someone_else" : clientId)
      .setSubject(identity.sub)
      .setIssuedAt()
      .setExpirationTime("10m")
      .sign(mode === "bad-signature" ? stranger.privateKey : keys.privateKey);
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, base);
    if (url.pathname === "/.well-known/openid-configuration") {
      res.writeHead(200, { "content-type": "application/json" }).end(
        JSON.stringify({
          issuer: base,
          authorization_endpoint: `${base}/api/accounts/authorize`,
          token_endpoint: `${base}/api/accounts/oauth/token`,
          jwks_uri: `${base}/.well-known/jwks.json`,
          userinfo_endpoint: `${base}/api/accounts/oauth/userinfo`,
          scopes_supported: ["openid", "profile", "email", "offline_access"],
          response_types_supported: ["code"],
          code_challenge_methods_supported: ["S256"],
          id_token_signing_alg_values_supported: ["RS256"],
          token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post", "none"],
        }),
      );
      return;
    }
    if (url.pathname === "/.well-known/jwks.json") {
      const jwk = await exportJWK(keys.publicKey);
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ keys: [{ ...jwk, kid: "mock-key", alg: "RS256", use: "sig" }] }));
      return;
    }
    if (url.pathname === "/api/accounts/authorize") {
      const q = url.searchParams;
      server.authorizeRequests.push(Object.fromEntries(q));
      if (q.get("client_id") !== clientId) return fail(res, 400, `unknown client ${q.get("client_id")}`);
      if (q.get("redirect_uri") !== redirectUri) return fail(res, 400, `callback ${q.get("redirect_uri")} is not the registered ${redirectUri}`);
      if (q.get("response_type") !== "code") return fail(res, 400, "response_type must be code");
      if (q.get("scope")?.split(" ").sort().join(" ") !== "email openid profile") return fail(res, 400, `scope was "${q.get("scope")}"`);
      if (q.get("code_challenge_method") !== "S256" || !q.get("code_challenge")) return fail(res, 400, "PKCE S256 is required");
      if (!q.get("nonce")) return fail(res, 400, "nonce is required");
      if (!q.get("state")) return fail(res, 400, "state is required");
      const back = new URL(redirectUri);
      back.searchParams.set("state", q.get("state"));
      if (server.mode === "deny") {
        back.searchParams.set("error", "access_denied");
      } else {
        const code = randomBytes(16).toString("hex");
        codes.set(code, { challenge: q.get("code_challenge"), nonce: q.get("nonce"), redirectUri: q.get("redirect_uri") });
        back.searchParams.set("code", code);
      }
      res.writeHead(302, { location: back.href }).end();
      return;
    }
    if (url.pathname === "/api/accounts/oauth/token" && req.method === "POST") {
      let raw = "";
      for await (const chunk of req) raw += chunk;
      const form = new URLSearchParams(raw);
      const auth = req.headers.authorization;
      server.tokenRequests.push({ form: Object.fromEntries(form), basic: !!auth });
      if (form.get("grant_type") !== "authorization_code") return fail(res, 400, "grant_type must be authorization_code");
      if (form.has("client_secret")) return fail(res, 401, "the client secret belongs only in the Basic header");
      if (server.clientSecret) {
        const expected = "Basic " + Buffer.from(`${clientId}:${server.clientSecret}`).toString("base64");
        if (auth !== expected) return fail(res, 401, "confidential client must authenticate with client_secret_basic");
      } else if (auth) {
        return fail(res, 401, "public client must not send credentials");
      }
      if (form.get("client_id") !== clientId) return fail(res, 401, "client_id is missing or wrong");
      const grant = codes.get(form.get("code"));
      codes.delete(form.get("code"));
      if (!grant) return fail(res, 400, "unknown or reused code");
      if (form.get("redirect_uri") !== grant.redirectUri) return fail(res, 400, "redirect_uri differs from the authorize request");
      const challenge = createHash("sha256").update(form.get("code_verifier") ?? "").digest("base64url");
      if (challenge !== grant.challenge) return fail(res, 400, "code_verifier does not match the challenge");
      // Identity-only clients get an ID token and nothing else they need.
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ id_token: await idToken(grant.nonce), token_type: "Bearer" }));
      return;
    }
    res.writeHead(404).end();
  });

  server.identity = { sub: "user-chatgpt-1", email: "chatgpt-person@example.com", name: "Casey ChatGPT" };
  server.mode = "ok";
  server.clientSecret = clientSecret;
  server.authorizeRequests = [];
  server.tokenRequests = [];
  server.problems = [];
  return server;
}
