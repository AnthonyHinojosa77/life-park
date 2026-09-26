> Archived 2026-09-26. Work Park was an AI model harness. The product became LifePark; see ../SPEC.md and ../PLAN.md.

# Product Specification

Product name: **Work Park** (chosen by Anthony on 2026-09-05 after a check of existing uses, domains, and trademarks).
Repository: `AnthonyHinojosa77/tony-harness`.
Written 2026-09-05 from a structured interview with Anthony. Every line under **Locked** is something Anthony said. Every line under **Assumed** is a default Claude chose and Anthony has not confirmed.

## What it is

A personal AI workspace that Anthony owns end to end. Every AI model is reachable through one app, every model runs under Anthony's own rules, and the app decides how to work on a request without making him pick a mode first. It replaces his daily use of the Claude and ChatGPT apps and of coding agents like Claude Code and Codex, on his phones and his laptop, with no dependence on any one vendor's app.

It fails if it does not cover his high-frequency uses at least as smoothly as the vendor apps do: a clean interface, phone and laptop parity, cross-device sync, read-aloud, and models that actually follow his instructions.

## Locked

### Purpose and scope

- Model-agnostic harness. Models are listed and selectable, like Cursor or Perplexity. Anthony decides the workflow.
- Two reasons for building it: no lock-in to any vendor harness, and models that work inside his criteria better than vendor apps allow.
- Chat, research, and coding launch together as one seamless agent, not as separate or phased features.
- For Anthony only for now. Built so others can be added once it has replaced his current AI use.
- "Organizations" in earlier notes meant organizing the interface, not multi-user teams.

### Interface

- Home-screen web app first. Anthony has never used one and reserves the right to switch to native apps. He has an iPhone and an Android phone.
- Look and feel: light, friendly, rounded, consumer-grade, in the family of Airbnb, Duolingo, and Notion. The earlier dark obsidian direction is retired.
- The full experience works on phones. The default interface stays simple and automated.
- An optional developer portal exposes code review, technical controls, and an IDE-style workspace. On the phone it covers starting tasks, reading summaries, reviewing changes, and approving. The editor comes with the laptop version. Details of the portal are Claude's call.
- Cost tracking lives in Settings, never in the workspace.
- Onboarding sets preferences. It offers a balanced default model selection or helps choose, and asks whether the main navigation is a list or a visual network.
- Navigation: both a normal sidebar list and a connected visual network of projects, conversations, and files are possible. Onboarding preference decides which is primary.

### Capabilities in chat

- Ask, Compare, Research, Code, and Pipeline exist as invisible capabilities picked automatically from natural language. The chat interface does not show a strategy picker.
- Web search, file and image attachments, cloud drives, and code execution are available from day one as invisible capabilities.
- Cloud drives: Google Drive and OneDrive. Read anything Anthony points at. Write only into a dedicated app folder.
- Compare uses a judge model Anthony selects. The judge evaluates evidence and flags incorrect claims. It does not declare a winner.
- Skills work both as slash commands and as automatic behaviors. Each type is clearly labeled in chat and managed in a simple Settings screen.

### Workflows area

- A separate productivity feature, outside chat, where strategies are chosen deliberately.
- Two forms: run a single strategy on demand with models and judge set by hand, and run a saved multi-step plan that is named once and reused. The single-strategy form ships first.

### Coding agent

- Cloud containers are created automatically to run code and tests. Work is saved to permanent cloud storage.
- A built-in cloud workspace is the default place for project files. GitHub is optional and connected through a GitHub App.
- Permissions are adjustable, up to full autonomy with no repeated approvals. Default for a fresh task: ask before anything irreversible, such as deleting files, pushing to a main branch, or spending above a limit.

### Memory and projects

- Conversations, files, and projects are organized and connected.
- Long-term memory is maintained automatically, but the model asks before saving. It proposes the memory in plain text, Anthony confirms or adjusts it, and only then is it saved. The check-in is brief, just enough to confirm alignment.
- Every saved memory is visible in Settings and can be deleted. A small "remembered" note appears on the response where a memory was saved.

### Models and rules

- OpenRouter is the only model provider at launch. One key, every model.
- The main model picker shows a manageable favorites list. The full searchable OpenRouter catalog lives in Settings.
- Anthony's operating rules, currently `AGENTS.md` in this repository, are the system prompt on every request. The app stores the live copy, lets him edit it in Settings, and exports it back to the repository so the two never drift.
- Whatever makes models follow custom instructions best is the deciding factor for how the existing AI Agent System files are used.

### Design direction

- Light, friendly, rounded, consumer-grade, in the family of Airbnb, Duolingo, and Notion.
- The Work Park name is carried into the interface through subtle motifs, not a literal theme park.
- The visual network view of projects, conversations, and files should read like a park map: paths between related conversations, clusters as lawns or groves, landmarks for important projects, with the park's shape growing out of how Anthony organizes his work.
- Chosen style (2026-09-05, after three rounds of options): "Paper stamp". Cream paper background, Nunito for interface text, Instrument Serif for the wordmark and headlines. Grass-green pressed buttons with a darker bottom edge. Sunny yellow for the capability chip and the judge note. Dark green ink outline with an offset solid shadow used only for emphasis: the answer card, the composer, the wordmark badge, the active navigation item, and the selected item on the park map. Everything else uses soft tan borders.
- Park map vocabulary: lawns are projects (grass texture, soft green edge, ink outline when selected); trees are conversations (three-lobed canopies that grow with the conversation); cream path ribbons link related conversations; pavilions are files; a pond is the archive; grey saplings at the edge are unsorted chats; a signboard key, compass, and zoom controls frame the map; selecting a tree opens a card with Open and Move to lawn.
- The design canvas with every round and the final screens: https://claude.ai/code/artifact/40322a13-0bb7-4fdf-9c6b-19477a0d3647

### Voice

- Read-aloud on every response through a play button, plus a hands-free toggle that reads every response automatically.
- Speechify's developer API is the main voice. The device's built-in voice is the free fallback.

### Accounts and hosting

- A real login and account system, not a passcode. Sign-in methods: Google, Apple, GitHub, Microsoft 365, passkey, and email with password.
- Hosted on Vercel. Anthony is open to the Mac Mini later if everything is automated and explained simply.
- Free Vercel web address now. A custom domain after the name is chosen.

### How we work

- Claude builds in this repository, verifies each piece itself, and merges its own pull requests. Anthony does not review features one at a time; a feature-by-feature check cannot show whether the app is worth adopting.
- Anthony reviews design only during the build, at a few defined check-ins, reacting to how things look and feel.
- Anthony evaluates the finished product once, as a whole, by using it in place of ChatGPT and Claude, and reports what would stop him from adopting it.
- All communication with Anthony is plain, clear, and non-technical. Claude automates as much as possible and never asks Anthony to perform multi-step technical procedures.

## Assumed

These are Claude's defaults. Any of them can be overturned by saying so.

- Compare's judge model gets web search so it can check claims against sources.
- The app's own database is the source of truth for conversations, settings, rules, and memories. Drives are import and export targets, not storage.
- The cloud workspace holds each project's files. The coding agent works on a copy inside a container and saves results back to the workspace. GitHub sync is a per-project option.
- Onboarding is short, skippable, and re-openable from Settings. It also sets a monthly spending limit with an alert.
- The automatic strategy choice is shown as a small label on the response that can be tapped to switch, so a wrong guess is a one-tap fix rather than a rephrase.
- The visual network view renders on phones but is expected to be used mostly on the laptop.
- The developer portal's phone version is review-and-approve only. Hand-editing code on a phone is not built.
- Speechify's free developer tier (50,000 characters per month at the time of writing) is enough to start. Anthony's consumer Speechify subscription does not cover API use.

## Out of scope for the first release

- Multi-user accounts, sharing, and team features. The data model allows them; no screens are built.
- Native iPhone or Android apps. The web app is built so it can be wrapped later without a rewrite.
- Direct provider keys for Anthropic, OpenAI, or Google. OpenRouter covers them.
- Full code editor on the phone.
- Hosting on the Mac Mini.
- Custom domain.

## Still open

- Domain purchase. On 2026-09-05, workpark.ai and workpark.so were unregistered and workpark.com was registered with no site, expiring 2026-10-06. A lapsed small-business tool named Workpark and a live Turkish attendance app named WorkPark exist; the only trademark filing on the name was abandoned in 2019. A formal trademark clearance has not been done.

## Technical decisions

Claude's choices, listed so a future session or a different model can continue without re-deciding. Plain-language reason after each.

| Area | Choice | Why |
| --- | --- | --- |
| Framework | Next.js on Vercel, TypeScript | Vercel deploys it automatically on every merge and gives preview links per pull request. |
| Long-running agent work | Vercel Workflows | No time limit on a run. Verified against Vercel docs dated 2026-09-03. |
| Code execution | Vercel Sandbox | Free tier on Hobby, automatic snapshot on stop, resume by name. E2B or Daytona are fallbacks if limits bite. |
| Database | Postgres on Vercel (Neon) | Managed, free at this usage, instant sync across devices. |
| File storage | Vercel Blob | Attachments and workspace files without running a file server. |
| Model access | OpenRouter through the Vercel AI SDK | Tool calling, streaming, web search, per-request cost, and a priced model catalog are all supported. Verified against OpenRouter docs. |
| Auth | A library supporting Google, Apple, GitHub, Microsoft, passkey, and email/password | Matches Q29. Exact library chosen at scaffold time. |
| Voice | Speechify API with Web Speech API fallback | Matches Q6. |
| Installable app | PWA with a service worker and web manifest | Home-screen install on iOS and Android from one codebase. Capacitor can wrap it later for native. |
| Design system | Tailwind with a light, rounded, friendly token set | Matches Q32. |

## Delivery order

Anthony asked for one seamless product, not phased features. Delivery still has to happen in some order, so this is the order in which parts of the single product become usable in the preview link. Nothing is a separate product.

1. Sign-in, onboarding, chat with OpenRouter, rules as system prompt, cost tracking in Settings, read-aloud, home-screen install. This is the first preview Anthony can use daily.
2. Automatic capability selection, web search, attachments, Compare with judge, Research.
3. Projects, memory with confirm-before-save, sidebar list navigation.
4. Cloud workspace, coding agent in Vercel Sandbox, permissions, developer portal, GitHub App.
5. Workflows area with single-strategy runs, then saved plans.
6. Cloud drive connections, visual network view, skills management screen.

Each step ships as a pull request with a preview link and a two-minute "what to try" note.
