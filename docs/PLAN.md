# Build Plan: LifePark

The shared plan for building the app described in [SPEC.md](./SPEC.md). Anthony and Claude both read this file. Claude updates it in the same pull request as the work, so the checkboxes always match what has actually shipped.

**Goal:** A personal database for everyday people. You talk to an AI about your life, it files and remembers everything, reminds you, makes useful things from it, and shows it all as a park that grows.

**Who does what:** Claude builds, verifies, and merges everything. Anthony reviews design at the check-ins below and evaluates the finished product once, as a whole. The few things only Anthony can do are listed at the end of SPEC.md.

**Live site:** https://work-park.vercel.app and https://life-park-app.vercel.app. The address moves to lifepark.app once the domain is bought.

Status key: `[ ]` not started, `[~]` in progress, `[x]` built and verified by Claude.

The earlier Work Park plan is kept in [archive/work-park-plan.md](./archive/work-park-plan.md).

---

## Milestone 0: Carried over from Work Park (done)

Accounts with email, password, and passkeys. Chat that saves across devices. Read-aloud and hands-free. Home-screen install with an offline page. The Paper stamp design system. Live on Vercel with automatic deploys.

---

## Milestone 1: The pivot

**What you get:** The live app becomes LifePark. It is one AI, no model picking, and an onboarding that starts with your calendar.

- [x] 1.1 Rename to LifePark everywhere users can see it.
- [~] 1.2 One AI behind the scenes. Remove the model picker and favorites from users' view. Choose the model by testing candidates on filing, reminders, and recaps. Built: one assistant model set in one place, with no model picker, model names, or favorites anywhere users look, and onboarding trimmed to navigation and voice. The provisional model is Google Gemini 3.8 Flash. The final choice comes from Anthony's personal trial in step 5.1.
- [x] 1.3 Owner dashboard. Cost tracking moves out of Settings into a page only Anthony can open. It includes a model switch that changes the AI for Anthony's account only, ready for the trial in 5.1. Built at /owner: AI spend across everyone, active people, cost per person, spend by model, a monthly heads-up, and the trial switch. Everyone else gets a "not found" page. On the live site it turns on once OWNER_EMAILS holds Anthony's sign-in email in Vercel.
- [x] 1.4 Sign-in screen for normal people: Google, Apple, passkey, email and password. Google and Apple buttons sit on top in each company's required look, with email below and passkey on sign-in. GitHub and Microsoft are gone. The Google and Apple buttons appear once their credentials exist; tested with stand-in credentials, including Google's real sign-in redirect.
- [x] 1.5 New onboarding: sign in with Google or Apple, a short welcome on how LifePark works, then connect Google services (Calendar, Contacts, Tasks, Gmail, My Drive, Docs, Sheets). The park builds itself right after. Apple and email sign-ins can connect a Google account or skip. Tested end to end with a stand-in Google; it turns on for real once the Google Cloud project exists.

---

## Milestone 2: Your life goes in

**What you get:** Tell it anything and it lands in the right place.

- [~] 2.1 The kinds of things: people, events, habits, recipes, notes, lists. Each has its own page and a plain list view. Built: all six are stored, plus files and mail from Google, and tapping an area of the park lists what is in it. Separate pages are not built yet.
- [~] 2.2 Filing from chat. The AI turns what you say into saved things and confirms in one short line when unsure. Built: the assistant saves people, events, habits, recipes, notes, and lists to the park and shows "Added to your park" under its reply. Tested with a stand-in model; not yet checked with the real one.
- [ ] 2.3 Photos. Snap a recipe card or an invite and it gets filed.
- [x] 2.4 Google Calendar and Google Contacts import, with birthdays pulled from contacts. Also Tasks, Gmail, My Drive, Docs, and Sheets, all read-only. Re-importing updates instead of duplicating.
- [ ] 2.5 Your calendar. Month, week, and day views of events, birthdays, and habits.
- [ ] 2.6 Make the calendar yours. Add a cover photo for each month, like a wall calendar.
- [~] 2.7 Ask about your own life: "When is Sam's birthday?" or "What did I cook last week?" Built: the assistant can look things up in the park. Not yet checked with the real model.

- [ ] 2.8 AI conversations lawn. A LifePark connector for ChatGPT and Claude that files conversation summaries into the park, with a one-time setup guide for each app's nightly scheduled task. Gemini through a scheduled Google Takeout export to Drive. No scraping and no stored AI-app logins, per OpenAI's and Anthropic's terms.

**Design check-in 1 (before Milestone 3):** the personal calendar and the detailed park. For the park, Anthony chose to judge it live in the app instead of mockups (2026-09-27). The calendar check-in with month cover photos still happens before 2.5 and 2.6 are built.

---

## Milestone 3: The park

**What you get:** Your life as a park that grows.

- [x] 3.1 The park drawn from your real data. Every person, habit, recipe, event, note, and list has its place. Built as a map you move around like a maps app: one lawn per screen, with drag, pinch, scroll, and double-tap to move and zoom, a gentle coast after a flick, shortcut chips that glide to each lawn, and a whole-park view. Eight lawns joined by paths, with ponds, trees, and meadow between them. The pieces are detailed drawings: cottages with gardens, festival stalls with the date, garden beds, fruit trees, picnic blankets, benches, library pavilions, and mailboxes, each with a name tag. Lawns grow with no size limit. A plain list view sits beside the map.
- [~] 3.2 Growth and animation. Things sprout when added, bloom with use, and the park gently comes alive: wind, small critters, and time of day. Built: things pop up as they arrive, areas gain flowers as they grow, clouds drift, a duck swims, and a balloon marks birthdays in the next two weeks. Time of day is not built yet.
- [~] 3.3 Tap anything in the park to open it. Long-press to move it. Built: tapping a lawn lists everything on it, and tapping one thing opens its card with "Ask LifePark." Long-press to move is not built yet.
- [~] 3.4 A small moment each time something is added, so progress always feels visible. Built: new things pop up, the park shows "N of 8 areas growing," suggests the next area to fill, and empty areas carry a sign that starts a chat.

---

## Milestone 4: The assistant acts on its own

**What you get:** It helps before you ask.

- [x] 4.0 Keep the park current on its own. Built: a nightly job refreshes every connected Google service that is more than 20 hours old, oldest first, within a time budget, and opening the park quietly refreshes anything more than 12 hours old. Tested with a stand-in Google.
- [ ] 4.1 Reminders as phone notifications: birthdays, habits, events.
- [ ] 4.2 Morning summary, optional.
- [ ] 4.3 Things it makes for you: weekly recap, gift ideas, meal plan from your recipes. You approve before anything is saved.

---

## Milestone 5: Ready for other people

**What you get:** Safe and ready for invite-only testers, then the public.

- [ ] 5.1 Model trial for Anthony. Anthony uses LifePark in his own daily life with each model in turn: GPT-6 Luna, Qwen 3.8 Flash, Gemini 3.8 Flash, then GLM 5.3 Flash. Claude switches the model on his account for each round and shows what each round cost. Anthony picks the one that worked best for him, and it becomes the one AI for everyone.
- [~] 5.2 Export everything and delete everything, from Settings. Built: "Delete my account" in Settings removes the account and everything in it after typing "delete"; the same email can sign up again from the start. The owner dashboard lists everyone and can remove another person's account the same way. Export is not built yet.
- [ ] 5.3 Share one thing by link, like a recipe or a gift list.
- [ ] 5.4 Free tier limits and the monthly subscription, with price set from research and the trial's real cost per user.
- [ ] 5.5 Google's review for calendar and contacts access.
- [ ] 5.6 Trademark check and the lifepark.app domain.
- [ ] 5.7 Invite-only testers, then public sign-ups.

**Design check-in 2 (before 5.7):** the whole app on Anthony's phone, from first open to a full park.

---

## Later

- Real iPhone and Android apps for full phone import.
- Visiting friends' parks.

**Final evaluation:** Anthony uses LifePark in daily life and reports what would stop him or other people from adopting it.

---

## Decisions log

- 2026-09-29: AI conversations get their own lawn, filled automatically through a LifePark connector plus each AI app's own scheduled task, and Google Takeout for Gemini (Anthony). Browser-extension scraping and stored logins are ruled out by OpenAI's and Anthropic's terms.
- 2026-09-29: LifePark refreshes connected sources by itself nightly and when the park is opened (Anthony).
- 2026-09-30: The sign-in intro plays on every open while signed out, and the page draws itself in piece by piece after the logo (Anthony).
- 2026-09-30: The park has to look like an actual park, with each area designed around what is connected there, instead of green circles with labels (Anthony). Every lawn got a landmark and a place-specific arrangement of its things, drawn at every zoom.
- 2026-09-29: Account deletion moves up so Anthony can delete his account and test the full sign-up flow from scratch (Anthony).
- 2026-09-27: Sign-in with Google or Apple leads to a short welcome, then a connect screen, then a park that builds itself (Anthony). Google connections: Calendar, Contacts, Tasks, Gmail, My Drive, Docs, Sheets. Keep is left out because Google does not offer it to personal accounts.
- 2026-09-27: Apple sign-in users can connect Google or skip; Apple Reminders, Calendar, and Contacts wait for the iPhone app (Anthony). Apple Mail and Notes cannot be read by any other app.
- 2026-09-27: The park is judged live in the app instead of through mockups (Anthony).
- 2026-09-27: The park map goes back to the Work Park park design (organic lawns, paths, pond, compass, zoom, tap card) instead of the grid of boxes (Anthony).
- 2026-09-27: The park stops fitting everything on one screen. One lawn fills the screen and people move around like Apple Maps or Google Maps; the park pieces are redrawn in more detail (Anthony).
- 2026-09-27: Work goes straight to main, with no pull requests (Anthony, from the shared agent rules).
- 2026-09-26: GLM 5.3 Flash joins the model trial as a fourth round (Anthony). It scored highest of the four on Artificial Analysis at about $0.09 per task.
- 2026-09-26: The chalk and crayon look replaces every floating bubble across the app (Anthony).
- 2026-09-26: Sign-in and sign-up move to a hand-drawn chalk and crayon look, replacing the floating bubble buttons (Anthony, from a reference image).
- 2026-09-26: The final AI is chosen by Anthony using each of GPT-6 Luna, Qwen 3.8 Flash, and Gemini 3.8 Flash in his own daily life. The shortlist came from a cost-versus-quality check against Artificial Analysis scores.
- 2026-09-26: Customizable calendar added. Customizing means a cover photo for each month (Q16).
- 2026-09-26: The product pivots from Work Park (AI model harness) to LifePark (personal database). All answers are in SPEC.md.
- 2026-09-05: "Paper stamp" design direction, kept for LifePark.
