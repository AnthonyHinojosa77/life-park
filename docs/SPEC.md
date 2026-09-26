# Product Specification: LifePark

Repository: `AnthonyHinojosa77/tony-harness`.
Written 2026-09-26 from a structured interview with Anthony (questions Q1 to Q15 of the LifePark round). Every line under **Locked** is something Anthony said. Every line under **Assumed** is a default Claude chose and Anthony has not confirmed.

This replaces the Work Park spec (an AI model harness), kept in [archive/work-park-spec.md](./archive/work-park-spec.md). The design, accounts, chat, voice, and home-screen install built for Work Park carry over.

## What it is

A personal database for everyday people, run by an AI you talk to. You tell it about your life: birthdays, workouts, recipes, plans, people, notes. It files everything for you, reminds you, and makes useful things from it. Everything you add shows up in your own park, which grows and animates as your life fills in, like a cozy park in the spirit of Animal Crossing.

It is Notion and Obsidian put together, without their setup work. Nobody designs a database. The AI does the organizing, and the park makes progress visible and fun.

It fails if a normal person cannot get value in the first few minutes without learning anything.

## Locked

### Audience

- Built for the public from day one. Anthony is the first user: if it works for him, it should work for other people. Personal use, invite-only testing, and public sign-ups are all planned for, in that order.

### The AI

- One AI model, chosen and tuned to work well inside LifePark. Users never see or pick a model. The model can be swapped later without users noticing.
- No model training. Tuning happens through instructions, tools, and the structure of the data.
- The model is chosen by Anthony using the app in his own daily life with each of GPT-6 Luna, Qwen 3.8 Flash, and Gemini 3.8 Flash in turn. Claude switches the model and reports the cost of each round. The shortlist comes from a cost-versus-quality check. Gemini 3.8 Flash is the default until then.

### Getting information in

- Chat and voice.
- Photos, such as a recipe card or a screenshot of an invite.
- Importing the calendar and contacts, so birthdays and events appear on day one. Google Calendar and Google Contacts come first, through the web app.

### The park

- Each kind of information is its own thing in the park. People are neighbors with houses, habits are garden plots, and recipes are an orchard. Things grow as they are added and used.
- Flat, top-down, drawn in the chosen "Paper stamp" style. The current park mockup is a good starting point. It gets more detailed, cuter, and more interactive, without losing taste or turning into slop.
- Nothing copies Animal Crossing's art. The feeling is the reference, not the look.

### Calendar

- A calendar view that people can make their own, with pictures added so it feels personal.
- Customizing means a cover photo for each month, like a wall calendar (Q16).

### What the AI does on its own

- Answers when asked.
- Sends reminders, like a birthday on Friday or leg day today.
- Makes useful things without being asked, like a weekly recap, gift ideas, or a meal plan from saved recipes. The user approves anything before it is saved.

### Sharing

- Private by default. Any single thing, like a recipe or a gift list, can be shared by link.
- Visiting friends' parks comes eventually, not in the first release.

### First run

- The user connects Google in the first minute. Birthdays and events fill the park right away. A short chat fills in the rest.

### App form

- A home-screen web app now, with Google import. Real iPhone and Android apps come later, for full import from the phone's own contacts and calendar.

### Money

- A free tier with limits, plus a monthly subscription. Around $8 to $10 a month is Claude's starting estimate; the price is set after research on AI cost per user and competitor pricing.

### Privacy

- Encrypted in storage and in transit.
- Users can export everything and delete everything at any time.
- The AI provider is contractually barred from training on user data.

### Old Work Park features

- Model picking, compare, the coding agent, and cost tracking are removed from what users see.
- Cost tracking stays as a private owner dashboard for Anthony.

### Look and feel

- Floating bubble buttons with offset shadows read as generic. Controls move toward a hand-drawn chalk and crayon look instead: crayon-filled buttons with rough edges, hand-lettered labels, and light chalk dust. The sign-in and sign-up screens use it first (2026-09-26).

### Name

- LifePark. lifepark.app was unregistered on 2026-09-26; lifepark.com is registered. Other apps named LifePark exist for an Istanbul concert venue, a German gym, and a church. A trademark check happens before public launch.

### Build

- Same repository and same live site. Everything is renamed to LifePark.

### How we work

- Claude builds, verifies, and merges its own pull requests. Anthony does not check features one at a time.
- Anthony reviews design only, at the check-ins in the plan.
- Anthony evaluates the finished product once, as a whole, by using it.
- All communication with Anthony is plain and non-technical. Claude automates everything it can and never asks Anthony to do multi-step technical work. When something truly needs Anthony, such as an account only he can open, Claude says exactly that and nothing more.

## Assumed

These are Claude's defaults. Any of them can be overturned by saying so.

- **Kinds of things at launch:** people, events, habits, recipes, notes, and lists. More kinds are added later without a redesign.
- **Park mapping for the rest:** events are flags on a festival board, notes are benches with a small plaque, and lists are picnic blankets. Final shapes are settled at the park design check-in.
- **Growth rules:** a thing grows when it is added, used, or completed. A habit plot blooms on a streak and wilts gently when skipped, never harshly. Nothing ever disappears on its own.
- **Chat is the front door.** The park is the second tab. A plain list of everything exists for people who want it.
- **The AI confirms before filing** anything it is not sure about, in one short line, the same pattern as confirm-before-save memory.
- **Model access stays on OpenRouter** behind the scenes, so the one model can be swapped without code changes.
- **Reminders arrive as phone notifications** through the home-screen app, plus an optional morning summary.
- **Voice** keeps Speechify with the device voice as fallback, and hands-free mode stays.
- **Accounts** keep Google, Apple, passkey, and email with password. GitHub and Microsoft sign-in are dropped from the sign-in screen, since normal people rarely use them.

## Out of scope for the first release

- Visiting friends' parks.
- Native iPhone and Android apps.
- Importing Apple's calendar or contacts directly. Apple users can export a file instead.
- Teams or shared databases.
- Choosing a model.

## Things only Anthony can do

Listed so nothing is a surprise. Claude handles everything else.

- **OpenRouter key.** The AI does not answer without it.
- **Google Cloud sign-in project.** Needed for Google sign-in and calendar and contacts import. Google must review any app that reads calendars or contacts before more than 100 people can use it. Claude prepares the review; the account must be Anthony's.
- **Payments account (Stripe).** Needed before charging anyone. It has to be in Anthony's name.
- **Domain purchase.** lifepark.app.
- **Speechify key.** Optional. The device voice works without it.
- **Vercel token.** Optional. Without it, adding the permanent database is one click in Vercel.

## Technical decisions

Carried over from Work Park unless noted.

| Area | Choice | Why |
| --- | --- | --- |
| Framework | Next.js on Vercel, TypeScript | Automatic deploys on every merge. Already live. |
| Database | Postgres (Neon) with Drizzle | Structured data for people, events, habits, and recipes, synced across devices. |
| AI | One model through OpenRouter and the Vercel AI SDK | Swappable without code changes. Tool calling files things into the database. |
| Photos | Vercel Blob, read by the model's image input | No file server to run. |
| Google import | Google Calendar and People APIs through Google sign-in | The same sign-in grants import permission. |
| Reminders | Web push through the service worker, scheduled with Vercel Cron | Works on installed home-screen apps on iPhone (iOS 16.4 and later) and Android. |
| Park | SVG drawn in code, animated with CSS and a small animation library | Crisp at any size, matches the Paper stamp style, and every object is data-driven. |
| Payments | Stripe subscriptions | Standard, handles taxes and receipts. |
| Native apps later | Capacitor wrapping the same web app | Adds phone contacts and calendar without a rewrite. |
