import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Preferences } from "@/components/settings/preferences";
import { RulesEditor } from "@/components/settings/rules-editor";
import { Card } from "@/components/ui/card";
import { formatDollars, monthlyCosts } from "@/lib/costs";
import { fetchCatalog } from "@/lib/models/catalog";
import { getRules } from "@/lib/rules";
import { requireOnboarded } from "@/lib/session";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { session, settings } = await requireOnboarded();
  const [rules, costs, catalog] = await Promise.all([
    getRules(session.user.id),
    monthlyCosts(session.user.id),
    fetchCatalog().catch(() => []),
  ]);
  const names = new Map(catalog.map((m) => [m.id, m.name]));
  const limitMicros = settings.monthlyLimitCents * 10_000;
  const share = limitMicros > 0 ? costs.monthMicros / limitMicros : 0;
  const month = costs.monthStart.toLocaleString("en-US", { month: "long", timeZone: "UTC" });

  return (
    <AppShell active="settings">
      <main className="flex flex-col gap-10 px-5 py-4 md:mx-auto md:w-full md:max-w-3xl md:py-10">
        <h1 className="font-serif text-3xl">Settings</h1>

        <section className="flex flex-col gap-4">
          <div className="flex items-end justify-between">
            <h2 className="font-serif text-2xl">Spending in {month}</h2>
            <span className="text-xs font-extrabold text-muted">
              heads-up at ${settings.monthlyLimitCents / 100}
            </span>
          </div>
          <Card variant={share >= 0.8 ? "stamp" : "soft"} className="flex flex-col gap-3 p-4">
            <div className="flex items-baseline gap-3">
              <span className="font-serif text-4xl">{formatDollars(costs.monthMicros)}</span>
              <span className="text-sm font-semibold text-muted">so far this month</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-pill bg-tan" aria-hidden="true">
              <div
                className={`h-full rounded-pill ${share >= 0.8 ? "bg-sun" : "bg-grass"}`}
                style={{ width: `${Math.min(100, Math.round(share * 100))}%` }}
              />
            </div>
            {share >= 0.8 && (
              <p className="text-sm font-bold">
                Close to your monthly heads-up. Nothing is blocked; this is just so you know.
              </p>
            )}
            {costs.byModel.length > 0 ? (
              <ul className="flex flex-col divide-y-2 divide-paper">
                {costs.byModel.map((row) => (
                  <li key={row.modelId} className="flex items-center justify-between py-2 text-sm">
                    <span className="font-extrabold">{names.get(row.modelId) ?? row.modelId}</span>
                    <span className="text-muted">
                      {row.replies} {row.replies === 1 ? "reply" : "replies"} ·{" "}
                      <span className="font-extrabold text-ink">{formatDollars(row.micros)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="font-serif text-sm italic text-muted">No spend yet this month.</p>
            )}
          </Card>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="font-serif text-2xl">Preferences</h2>
          <Preferences
            navigation={settings.navigation}
            voice={settings.voice}
            monthlyLimitCents={settings.monthlyLimitCents}
          />
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="font-serif text-2xl">Rules</h2>
          <p className="text-sm font-semibold text-ink-soft">
            Sent to every model with every message. Edit here, or keep it identical to the
            repository&apos;s AGENTS.md.
          </p>
          <RulesEditor
            content={rules.content}
            edited={rules.edited}
            updatedAt={rules.updatedAt ? rules.updatedAt.toLocaleString("en-US", { timeZone: "UTC" }) : null}
          />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-serif text-2xl">Account</h2>
          <p className="text-sm font-semibold text-ink-soft">
            Signed in as {session.user.email}.
          </p>
          <div>
            <SignOutButton />
          </div>
        </section>
      </main>
    </AppShell>
  );
}
