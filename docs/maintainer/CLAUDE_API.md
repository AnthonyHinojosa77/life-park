# Connecting LifePark's assistant to your Claude API key

LifePark's assistant runs on Claude, called directly through Anthropic's API and
billed to your own Anthropic account. Everyone gets **Claude Opus 5.5**; from
the owner dashboard you can switch your own account to **Claude Sonnet 5.5** or
**Claude Haiku 5.5** to compare. Until the key is in Vercel, the chat says the
assistant isn't switched on yet.

## 1. Create the key

1. Sign in at https://platform.claude.com (or create an account and add billing).
2. Go to **Settings → API keys** (https://platform.claude.com/settings/keys) and
   click **Create key**. Name it `LifePark`, pick an expiration, and link it to yourself.
   (Anthropic suggests a service account key for production services; a personal
   key stops working only if you leave your own organization.)
3. Copy the key (it starts with `sk-ant-`). The Console shows it only once.

Source: [Get your Claude API key](https://platform.claude.com/docs/en/get-api-key) (read 2026-10-09).

## 2. Put it in Vercel

1. Open https://vercel.com, then the project for work-park.vercel.app →
   **Settings** → **Environment Variables**.
2. Add `ANTHROPIC_API_KEY` = the key, for **Production** (and Preview if you use preview links).
3. Delete `OPENROUTER_API_KEY` if it is still there; LifePark no longer reads it.
4. **Deployments** → the latest Production deployment's menu → **Redeploy**, and
   wait until it says Ready.

Optional: `LIFEPARK_MODEL` = `claude-sonnet-5-5` or `claude-haiku-5-5` changes the
model for everyone. Leave it out to keep Claude Opus 5.5.

### Prompt for a browser agent

> Using my signed-in Chrome, add my Claude API key to my Vercel project. Do not show me or paste the key into this chat; paste it only into the Vercel field named below.
>
> 1. Go to https://platform.claude.com/settings/keys. Click Create key, name it "LifePark", choose an expiration, link it to me, and create it. Copy the key (it starts with sk-ant-; it is shown only once).
> 2. Go to https://vercel.com, open my project for work-park.vercel.app → Settings → Environment Variables. Add ANTHROPIC_API_KEY = the key, for Production and Preview. If OPENROUTER_API_KEY exists, delete it. Save.
> 3. Go to the project's Deployments, open the latest Production deployment's menu, and click Redeploy. Wait until it says Ready.
> 4. Open https://work-park.vercel.app, sign in, start a new chat, and send "Hello". Confirm a reply appears.
> 5. Tell me that the key exists in the Claude Console and ANTHROPIC_API_KEY exists in Vercel (names only, never the key), that the redeploy is Ready, and whether the chat replied.

## Smart routing (owner trial only)

In the owner dashboard's trial switch, **Smart routing (Haiku first)** sends each
of your messages to Claude Haiku 5.5 first. Haiku answers everyday messages
itself and passes harder ones to Claude Sonnet 5.5, which answers or passes the
hardest to Claude Opus 5.5. Nobody sees the hand-off. A model can pass a message
on only before it has done anything (saved or looked something up), so nothing
runs twice, and a message Haiku declines goes up to Sonnet. "Your spend this
month, by model" shows which model answered each reply; each reply's cost
includes every model that looked at it. Everyone else stays on the default model.

## 3. Check it

Send a message in a new chat. The owner dashboard (Settings → Owner dashboard)
shows what each reply cost, priced from Anthropic's published rates.

## Costs (Anthropic's prices, read 2026-10-09)

| Model | Input | Output | Cached input |
| --- | --- | --- | --- |
| Claude Opus 5.5 | $4 / million tokens | $20 / million tokens | $0.20 / million tokens |
| Claude Sonnet 5.5 | $2 | $10 | $0.10 |
| Claude Haiku 5.5 (prompts up to 100,000 tokens) | $0.10 | $0.50 | $0.01 |

Source: https://platform.claude.com/docs/en/about-claude/pricing. LifePark reuses
the start of each conversation from Anthropic's cache, so input in a back-and-forth
is mostly billed at the cached rate. The cache lasts 5 minutes; a message after a
longer pause re-stores it at 1.25 times the input price.

## For the next developer

- Code: `app/src/lib/chat/agent.ts` (the reply loop: streams Claude's words into
  the chat, runs the park tools, up to four rounds), `app/src/lib/chat/model.ts`
  (models and client), `app/src/lib/chat/pricing.ts`, `app/src/app/api/chat/route.ts`.
- Built on Anthropic's official TypeScript SDK (`@anthropic-ai/sdk`). The Vercel
  AI SDK only carries the stream to the chat screen.
- Request shape for the 5.5 models: no `thinking` field (thinking is always on),
  `output_config.effort: "medium"`, no forced `tool_choice`, top-level
  `cache_control` for automatic prompt caching, and `fallbacks: "default"` (beta
  `server-side-fallback-2026-07-01`) on Opus and Sonnet so a safety-classifier
  decline is retried on Anthropic's recommended model. Haiku has no server-side
  fallback; a final decline shows "I can't help with that one."
- Smart routing: `app/src/lib/chat/router.ts` gives Haiku and Sonnet a hidden
  `hand_off` tool and a routing note in the system prompt; the agent loop honours
  it only on a model's first step, discards that draft with `reset-step`, and the
  next model answers from the same history.
- Earlier turns go back as plain words; thinking blocks are only replayed, byte
  for byte, within one reply's tool loop (Claude rejects edited thinking).
- Test: `e2e/mock-anthropic.mjs` is a stand-in that enforces those rules; the
  chat route tests and the chat, owner, and park flows run against it.
