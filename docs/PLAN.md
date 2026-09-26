# Build Plan: LifePark

The shared plan for building the app described in [SPEC.md](./SPEC.md). Anthony and Claude both read this file. Claude updates it in the same pull request as the work, so the checkboxes always match what has actually shipped.

**Goal:** A personal database for everyday people. You talk to an AI about your life, it files and remembers everything, reminds you, makes useful things from it, and shows it all as a park that grows.

**Who does what:** Claude builds, verifies, and merges everything. Anthony reviews design at the check-ins below and evaluates the finished product once, as a whole. The few things only Anthony can do are listed at the end of SPEC.md.

**Live site:** https://work-park.vercel.app. The address moves to lifepark.app once the domain is bought.

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
- [ ] 1.3 Owner dashboard. Cost tracking moves out of Settings into a page only Anthony can open. It includes a model switch that changes the AI for Anthony's account only, ready for the trial in 5.1.
- [ ] 1.4 Sign-in screen for normal people: Google, Apple, passkey, email and password.
- [ ] 1.5 New onboarding: connect Google, see birthdays and events arrive, then a short chat.

---

## Milestone 2: Your life goes in

**What you get:** Tell it anything and it lands in the right place.

- [ ] 2.1 The kinds of things: people, events, habits, recipes, notes, lists. Each has its own page and a plain list view.
- [ ] 2.2 Filing from chat. The AI turns what you say into saved things and confirms in one short line when unsure.
- [ ] 2.3 Photos. Snap a recipe card or an invite and it gets filed.
- [ ] 2.4 Google Calendar and Google Contacts import, with birthdays pulled from contacts.
- [ ] 2.5 Your calendar. Month, week, and day views of events, birthdays, and habits.
- [ ] 2.6 Make the calendar yours. Add a cover photo for each month, like a wall calendar.
- [ ] 2.7 Ask about your own life: "When is Sam's birthday?" or "What did I cook last week?"

**Design check-in 1 (before Milestone 3):** the personal calendar and the detailed park. Claude sends mockups of a cuter, more detailed, interactive park, with neighbors' houses, garden plots, the orchard, festival flags, and growth stages. The calendar mockups show month cover photos. Anthony reacts to the look only.

---

## Milestone 3: The park

**What you get:** Your life as a park that grows.

- [ ] 3.1 The park drawn from your real data. Every person, habit, recipe, event, note, and list has its place.
- [ ] 3.2 Growth and animation. Things sprout when added, bloom with use, and the park gently comes alive: wind, small critters, and time of day.
- [ ] 3.3 Tap anything in the park to open it. Long-press to move it.
- [ ] 3.4 A small moment each time something is added, so progress always feels visible.

---

## Milestone 4: The assistant acts on its own

**What you get:** It helps before you ask.

- [ ] 4.1 Reminders as phone notifications: birthdays, habits, events.
- [ ] 4.2 Morning summary, optional.
- [ ] 4.3 Things it makes for you: weekly recap, gift ideas, meal plan from your recipes. You approve before anything is saved.

---

## Milestone 5: Ready for other people

**What you get:** Safe and ready for invite-only testers, then the public.

- [ ] 5.1 Model trial for Anthony. Anthony uses LifePark in his own daily life with each model in turn: GPT-6 Luna, Qwen 3.8 Flash, then Gemini 3.8 Flash. Claude switches the model on his account for each round and shows what each round cost. Anthony picks the one that worked best for him, and it becomes the one AI for everyone.
- [ ] 5.2 Export everything and delete everything, from Settings.
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

- 2026-09-26: The final AI is chosen by Anthony using each of GPT-6 Luna, Qwen 3.8 Flash, and Gemini 3.8 Flash in his own daily life. The shortlist came from a cost-versus-quality check against Artificial Analysis scores.
- 2026-09-26: Customizable calendar added. Customizing means a cover photo for each month (Q16).
- 2026-09-26: The product pivots from Work Park (AI model harness) to LifePark (personal database). All answers are in SPEC.md.
- 2026-09-05: "Paper stamp" design direction, kept for LifePark.
