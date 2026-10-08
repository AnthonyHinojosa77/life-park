# Turning on Sign in with ChatGPT

LifePark has a **Continue with ChatGPT** button, built and tested against a
stand-in OpenAI. It stays hidden until OpenAI gives LifePark a client ID,
because OpenAI only offers Sign in with ChatGPT to partners it approves: "currently
available to selected commercial partners through a limited trial"
([OpenAI's docs](https://developers.openai.com/siwc/website), read 2026-10-08).

## What people get

- One tap to sign up or sign in with their ChatGPT account. LifePark receives
  their name, email, picture, and an account ID that never changes, and keeps
  those like it does for Google. It never sees their ChatGPT chats, memories, or
  plan, and doesn't keep OpenAI's sign-in tokens.
- Someone who already has a LifePark account with the same email isn't joined to
  it automatically, because OpenAI warns that a matching email alone doesn't prove
  it's the same person. The sign-in page tells them to sign in the way they did
  before, then add ChatGPT in Settings → Account → **Continue with ChatGPT**.
- Signing out of LifePark doesn't sign anyone out of ChatGPT.
- If OpenAI is down when LifePark starts up, the ChatGPT button says it isn't
  available; Google, Apple, passkeys, and email keep working. Redeploying in
  Vercel once OpenAI is back turns it on again.

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
| Use | Sign-in only, no ChatGPT plan usage |
| Scopes | `openid profile email` |
| Callback URL (exact) | `https://work-park.vercel.app/api/auth/callback/chatgpt` |

OpenAI decides whether the client gets a secret. LifePark works either way.

When LifePark moves to its custom domain, register
`https://lifepark.cohegen.net/api/auth/callback/chatgpt` with OpenAI too, before
`BETTER_AUTH_URL` is switched (the same step app/README.md lists for Google and Apple).

## 2. Put the values in Vercel

1. Open https://vercel.com, then the project for work-park.vercel.app →
   **Settings** → **Environment Variables**.
2. Add `CHATGPT_CLIENT_ID` = the client ID from OpenAI (it usually starts with
   `oaiapp_`), for **Production**.
3. Only if OpenAI also gave you a client secret: add `CHATGPT_CLIENT_SECRET` =
   that secret, for **Production**. Otherwise leave it out.
4. **Deployments** → the latest Production deployment's menu → **Redeploy**, and
   wait until it says Ready.

The button then appears on the sign-in and sign-up pages, and Settings offers
**Continue with ChatGPT** to add it to an existing account.

### Prompt for a browser agent

> Using my signed-in Chrome, add OpenAI's Sign in with ChatGPT values to my Vercel project. Do not show me or paste any secret into this chat; paste values only into the Vercel fields named below.
>
> 1. Go to https://vercel.com, open my project for work-park.vercel.app → Settings → Environment Variables.
> 2. Add CHATGPT_CLIENT_ID = [the client ID from OpenAI's email], for Production. If OpenAI's email also includes a client secret, add CHATGPT_CLIENT_SECRET = that secret, for Production; if it doesn't, add nothing else. Save.
> 3. Go to the project's Deployments, open the latest Production deployment's menu, and click Redeploy. Wait until it says Ready.
> 4. Open https://work-park.vercel.app/sign-in in a private window and confirm a "Continue with ChatGPT" button is there.
> 5. Tell me which variables exist in Vercel (names only, never values), that the redeploy is Ready, and whether the button appeared.

## 3. Check it

Open https://work-park.vercel.app/sign-in in a private window, tap **Continue
with ChatGPT**, approve on OpenAI's page, and you should land in LifePark.

## For the next developer

- Flow: OpenID Connect authorization code with PKCE (S256), a fresh state and
  nonce per sign-in, and the ID token's signature (OpenAI's JWKS), issuer,
  audience, expiry, and nonce checked before a session is created. Identity is
  the pinned issuer plus `sub`. A token response without an ID token fails.
  better-auth's "post an ID token" shortcut is refused for ChatGPT, since it
  skips state and nonce.
- Linking: a ChatGPT sign-in never attaches to an existing user
  (`allowChatGPTAccount`); explicit linking from Settings (`linkSocial`) is the
  only way, and it needs OpenAI's `email_verified`. OpenAI's access, refresh, and
  ID tokens are dropped before accounts are saved (`withoutChatGPTTokens`).
- Startup: endpoints come from OpenAI's discovery document. A failure, a 2-second
  stall, or a different issuer leaves only this provider off until the next
  start.
- Code: `app/src/lib/chatgpt-sign-in.ts` (provider on better-auth's generic OAuth
  plugin), `app/src/lib/auth.ts`, `app/src/lib/auth-providers.ts` (messages),
  `app/src/components/auth/sign-in-form.tsx`, `app/src/components/settings/chatgpt-sign-in.tsx`.
- The buttons use OpenAI's approved "Continue with ChatGPT" wording and black
  format with OpenAI's own logo (`app/src/components/auth/chatgpt-mark.tsx`),
  drawn in LifePark's crayon style like the Google and Apple buttons.
- Test: `node e2e/chatgpt-flow.mjs <screenshotDir>` after `pnpm build`, with the
  stand-in OpenAI in `app/e2e/mock-openai.mjs`.
