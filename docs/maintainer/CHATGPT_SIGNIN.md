# Turning on Sign in with ChatGPT

LifePark has a **Continue with ChatGPT** button, built and tested against a
stand-in OpenAI. It stays hidden until OpenAI gives LifePark a client ID,
because OpenAI only offers Sign in with ChatGPT to partners it approves: "currently
available to selected commercial partners through a limited trial"
([OpenAI's docs](https://developers.openai.com/siwc/website), read 2026-10-08).

## What it does

- People sign up or sign in with their ChatGPT account. OpenAI tells LifePark
  their name, email, and picture, and an ID that never changes. LifePark never
  sees their ChatGPT chats, memories, or plan.
- Every sign-in uses a fresh state, PKCE challenge, and nonce, and OpenAI's ID
  token is checked (signature against OpenAI's published keys, issuer, audience,
  expiry, nonce) before anyone is signed in.
- LifePark keeps only the verified ChatGPT account ID. OpenAI's tokens are thrown
  away after sign-in, as OpenAI asks.
- Someone who already has a LifePark account with the same email is joined to it
  automatically only when OpenAI and LifePark have both verified that email.
  Otherwise the sign-in page tells them to sign in the way they did before and
  add ChatGPT in Settings → Account → **Add ChatGPT sign-in**.
- Signing out of LifePark doesn't sign anyone out of ChatGPT.
- If OpenAI is down when the server starts, only the ChatGPT button stops working
  until the next restart; Google, Apple, passkeys, and email keep working.

It does **not** let people pay for LifePark's AI with their ChatGPT plan. OpenAI
offers that ("ChatGPT plan usage") to open-source apps and selected private
clients through a separate sign-up, so LifePark's AI stays on OpenRouter.

## 1. Ask OpenAI for access

Fill in OpenAI's [Sign in with ChatGPT interest form](https://openai.com/form/sign-in-with-chatgpt-interest/)
(OpenAI's docs also say an OpenAI representative can add you to the waitlist).
The form wouldn't open for an automated check, so its questions weren't checked
ahead of time. These are the details OpenAI's guide says you'll need:

| What | Value |
| --- | --- |
| App | LifePark, https://work-park.vercel.app |
| Use | Sign-in only (identity), no ChatGPT plan usage |
| Scopes | `openid profile email` |
| Callback URL (exact) | `https://work-park.vercel.app/api/auth/callback/chatgpt` |
| Client type | Public (no secret) or confidential; LifePark supports both |

When LifePark moves to its custom domain, register
`https://lifepark.cohegen.net/api/auth/callback/chatgpt` with OpenAI too, before
`BETTER_AUTH_URL` is switched (the same step app/README.md lists for Google and Apple).

## 2. Put the values in Vercel (Production)

- `CHATGPT_CLIENT_ID`: the client ID OpenAI gives you (it usually starts with `oaiapp_`)
- `CHATGPT_CLIENT_SECRET`: only if OpenAI gave you a confidential client with a
  secret; leave it out otherwise

Redeploy. The button appears on the sign-in and sign-up pages, and Settings
offers **Add ChatGPT sign-in**.

## 3. Check it

Open https://work-park.vercel.app/sign-in in a private window, tap **Continue
with ChatGPT**, approve on OpenAI's page, and you should land in LifePark.

## For the next developer

- Code: `app/src/lib/chatgpt-sign-in.ts` (provider, built on better-auth's generic
  OAuth plugin with OpenAI's discovery document), `app/src/lib/auth.ts`,
  `app/src/components/auth/sign-in-form.tsx`, `app/src/components/settings/chatgpt-sign-in.tsx`.
- The button uses OpenAI's approved "Continue with ChatGPT" wording and black
  format with OpenAI's own logo, drawn in LifePark's crayon style like the
  Google and Apple buttons.
- Test: `node e2e/chatgpt-flow.mjs <screenshotDir>` after `pnpm build`, with the
  stand-in OpenAI in `app/e2e/mock-openai.mjs`.
