# Product Specification: LifePark

Repository: `AnthonyHinojosa77/life-park` (renamed from `tony-harness` on 2026-09-27).
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
- The model is chosen by Anthony using the app in his own daily life with each of GPT-6 Luna, Qwen 3.8 Flash, Gemini 3.8 Flash, and GLM 5.3 Flash in turn. Claude switches the model and reports the cost of each round. The shortlist comes from a cost-versus-quality check. Gemini 3.8 Flash is the default until then.

### Getting information in

- Chat and voice.
- Photos, such as a recipe card or a screenshot of an invite.
- Importing the calendar and contacts, so birthdays and events appear on day one. Google Calendar and Google Contacts come first, through the web app.
- Google connections, all read-only: Calendar, Contacts, Tasks, Gmail, My Drive, Docs, and Sheets (2026-09-27). Google Keep is left out because Google offers it only to company Workspace accounts, not personal ones.
- Apple: Sign in with Apple is on the web now. Websites cannot read Apple Mail, Notes, or Reminders, so people who sign in with Apple can connect a Google account or skip. Apple Calendar, Reminders, and Contacts come with the iPhone app; Apple Mail and Notes are closed even to iPhone apps.

### AI conversations (2026-09-29)

- Conversations people have with AI apps (ChatGPT, Claude, Gemini) are summarized and filed in the park on their own lawn, so AI work is tracked with everything else, without the person keeping up with it.
- It must be automatic and stay within each company's terms. OpenAI and Anthropic forbid automatically extracting chats, automated access to their apps, and sharing account logins, so LifePark never stores AI-app logins and never scrapes them, including through a browser extension.
- Routes, in order:
  1. A LifePark connector that people add inside ChatGPT and Claude, plus one scheduled task in each app ("every night, summarize today's conversations and save them to LifePark"). Both are features those apps offer; they need a paid plan in each app. Summaries come from what the AI recalls, not exact transcripts.
  2. Gemini: a Google Takeout export scheduled every 2 months into Google Drive, which LifePark picks up on its own. This needs permission to open files in Drive.
  3. Conversations held inside LifePark's own chat are tracked by default.
- Google does not offer a way for other apps to read Gemini chats directly, and neither OpenAI nor Anthropic offers one for personal accounts (checked 2026-09-29).

### Keeping the park current (2026-09-29)

- LifePark refreshes every connected Google service and GitHub by itself every night, and again quietly whenever the park is opened more than 12 hours after its last refresh.

### GitHub (2026-10-03)

- People can bring their GitHub repositories into the park, onto a ninth lawn, the Workshop: one shed per repository, flagged in its language's color, grouped by language with archived ones apart, and a card that opens the repository on GitHub.
- It uses a LifePark GitHub App with read-only "Metadata" access. People install it on GitHub, choose which repositories it may see (all or a few, private ones included), and can change that choice or disconnect any time from Settings.
- An installation is only accepted after the person confirms it is theirs by signing in with GitHub; an installation id in a link alone is never trusted.

### Sign in with ChatGPT (2026-10-08)

- People can sign up or sign in with their ChatGPT account (Anthony asked for it). OpenAI shares only name, email, picture, and a permanent account ID; never chats.
- OpenAI offers it only to partners it approves, so the button stays hidden until OpenAI issues LifePark a client ID (docs/maintainer/CHATGPT_SIGNIN.md).
- A ChatGPT sign-in never joins an existing account by itself, since OpenAI says a matching email isn't proof of ownership; the person signs in the old way and adds ChatGPT from Settings.
- Paying for LifePark's AI with a ChatGPT plan is not part of it. OpenAI offers that to open-source and selected private apps through a separate sign-up.

### The park

- Each kind of information is its own thing in the park. People are neighbors with houses, habits are garden plots, and recipes are an orchard. Things grow as they are added and used.
- The park is a map you move around like Apple Maps or Google Maps (2026-09-27): one lawn fills the screen, and dragging, pinching, scrolling, or double-tapping moves and zooms to the rest. Shortcut chips glide straight to any lawn, and one button shows the whole park. It keeps the Work Park park vocabulary: grass lawns joined by paths, ponds, trees, and a card when one thing is tapped. Each kind of thing has its own lawn, which grows with no size limit. A plain list view sits beside the map.
- The park builds itself as soon as accounts are connected, so people see their park right away. Empty areas show a sign that starts a chat to fill them, and the park always suggests the next area to grow (2026-09-27).
- Every lawn is one place, drawn once, however much it holds (2026-09-30): the Neighborhood is a corner café, the Festival board a bandstand, the Library a library, the Post office a post office, the Garden a greenhouse, the Orchard a barn, the Picnic lawn a gazebo, and the Bench walk a fountain. Empty lawns show their landmark faded; a closed lawn shows a glimpse of its first few things below the landmark and grows in steps with what it holds. On a screen wider than it is tall the park lays out four lawns across in two rows, with the lake in the middle band and the stream running to a pond on the right. Tapping a lawn opens its categories as plots around the landmark, each showing a few of its things; tapping a category opens everything in it, arranged the way that place would have it (houses along streets, books on shelves, mailboxes along a lane, stalls on the board); tapping a thing opens its card. The categories are built from what is known: neighbors by family, birthdays coming up, and streets by first letter; events by today, this week, this month, later, and past; letters by sender; files by type; recipes by course; notes and habits by age; lists by where they came from. Around the lawns is a real park (2026-09-30): a lake with a sandy shore, a dock, a rowboat, ducks, lily pads, and reeds; a stream from it down the middle with wooden footbridges where the paths cross, ending in a duck pond; a playground, picnic tables, an ice-cream cart, flower beds, benches and lamp posts along gravel paths, oaks, pines, willows by the water, blossom trees, bushes, and rocks, thicker toward the picket fence around the grounds; and an arch with the park's name at the gate.
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

- The user signs in with Google or Apple, reads a short welcome on how LifePark works, then is asked to connect the services that match the sign-in they chose. The park builds itself from what comes in. A short chat fills in the rest (2026-09-27).

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

- Floating bubble buttons with offset shadows read as generic. Controls move toward a hand-drawn chalk and crayon look instead: crayon-filled buttons with rough edges, hand-lettered labels, and light chalk dust. It now covers the whole app: buttons, the message box, cards, chips, the menus, and the logo badge (2026-09-26). No offset shadows remain.

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
- **Park mapping for the rest:** events are flags on a festival board, notes are benches with a small plaque, lists are picnic blankets, files are books in the library, and mail arrives at the post office.
- **Growth rules:** a thing grows when it is added, used, or completed. A habit plot blooms on a streak and wilts gently when skipped, never harshly. Nothing ever disappears on its own.
- **Chat is the front door.** The park is the second tab. A plain list of everything exists for people who want it.
- **The AI confirms before filing** anything it is not sure about, in one short line, the same pattern as confirm-before-save memory.
- **The assistant runs on Claude** (2026-10-09, Anthony): Claude Opus 5.5 by default, called directly through Anthropic's API with Anthony's own API key, so the model can be switched without code changes. Claude Sonnet 5.5 and Claude Haiku 5.5 are in his trial switch.
- **Reminders arrive as phone notifications** through the home-screen app, plus an optional morning summary.
- **Voice** keeps Speechify with the device voice as fallback, and hands-free mode stays.
- **Accounts** keep Google, Apple, ChatGPT, passkey, and email with password. GitHub and Microsoft sign-in are dropped from the sign-in screen, since normal people rarely use them.

## Out of scope for the first release

- Visiting friends' parks.
- Native iPhone and Android apps.
- Importing Apple's calendar, contacts, or reminders directly. Apple users can connect Google or export a file instead.
- Apple Mail and Apple Notes. Apple offers no way for other apps to read them.
- Google Keep. Google offers it only to company Workspace accounts.
- Teams or shared databases.
- Choosing a model.

## Things only Anthony can do

Listed so nothing is a surprise. Claude handles everything else.

- **Anthropic API key.** The AI does not answer without it (steps in docs/maintainer/CLAUDE_API.md).
- **Google Cloud sign-in project.** Needed for Google sign-in and every Google connection. Google must review any app that reads calendars or contacts before more than 100 people can use it. Gmail and Drive are "restricted" permissions that also need a paid outside security assessment before public launch (price not yet checked). Claude prepares the reviews; the account must be Anthony's.
- **Apple Developer account.** $99 a year, needed for Sign in with Apple.
- **Payments account (Stripe).** Needed before charging anyone. It has to be in Anthony's name.
- **Domain purchase.** lifepark.app.
- **GitHub App.** Register LifePark's GitHub App in Anthony's GitHub account and put its four values in Vercel (steps and a browser-agent prompt in docs/maintainer/GITHUB_APP.md). Until then the Workshop shows a sign and Settings says GitHub isn't set up.
- **Sign in with ChatGPT access.** Apply through OpenAI's interest form and put the client ID in Vercel (steps in docs/maintainer/CHATGPT_SIGNIN.md). Until then the ChatGPT button stays hidden.
- **Speechify key.** Optional. The device voice works without it.
- **Vercel token.** Optional. Without it, adding the permanent database is one click in Vercel.

## Technical decisions

Carried over from Work Park unless noted.

| Area | Choice | Why |
| --- | --- | --- |
| Framework | Next.js on Vercel, TypeScript | Automatic deploys on every merge. Already live. |
| Database | Postgres (Neon) with Drizzle | Structured data for people, events, habits, and recipes, synced across devices. |
| AI | Claude through Anthropic's official TypeScript SDK; the Vercel AI SDK only carries the stream to the chat screen | Direct from Anthropic on the owner's account. Tool calling files things into the database. |
| Photos | Vercel Blob, read by the model's image input | No file server to run. |
| Google import | Google Calendar and People APIs through Google sign-in | The same sign-in grants import permission. |
| Reminders | Web push through the service worker, scheduled with Vercel Cron | Works on installed home-screen apps on iPhone (iOS 16.4 and later) and Android. |
| Park | SVG drawn in code, animated with CSS and a small animation library | Crisp at any size, matches the Paper stamp style, and every object is data-driven. |
| Payments | Stripe subscriptions | Standard, handles taxes and receipts. |
| Native apps later | Capacitor wrapping the same web app | Adds phone contacts and calendar without a rewrite. |
