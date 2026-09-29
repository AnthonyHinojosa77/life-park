import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { BudgetPicker, ModelSwitch } from "@/components/owner/owner-controls";
import { PeopleList } from "@/components/owner/people-list";
import { Card } from "@/components/ui/card";
import { assistantModelId } from "@/lib/chat/model";
import { listPeople } from "@/lib/account";
import { formatDollars, monthlyCosts, type CostSummary } from "@/lib/costs";
import { requireOwner, trialModels } from "@/lib/owner";

export const metadata: Metadata = { title: "Owner dashboard" };

const nameOf = (id: string) => trialModels.find((m) => m.id === id)?.name ?? id;

function ByModel({ costs }: { costs: CostSummary }) {
  if (costs.byModel.length === 0) {
    return <p className="font-serif text-sm italic text-muted">No replies yet this month.</p>;
  }
  return (
    <ul className="flex flex-col divide-y-2 divide-paper">
      {costs.byModel.map((row) => (
        <li key={row.modelId} className="flex items-center justify-between py-2 text-sm">
          <span className="font-extrabold">{nameOf(row.modelId)}</span>
          <span className="text-muted">
            {row.replies} {row.replies === 1 ? "reply" : "replies"} ·{" "}
            <span className="font-extrabold text-ink">{formatDollars(row.micros)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Only for LifePark's owner: what the AI costs across everyone, and the model trial switch. */
export default async function OwnerPage() {
  const { session, settings } = await requireOwner();
  const [everyone, mine, people] = await Promise.all([monthlyCosts(null), monthlyCosts(session.user.id), listPeople()]);
  const month = everyone.monthStart.toLocaleString("en-US", { month: "long", timeZone: "UTC" });
  const budgetMicros = settings.monthlyLimitCents * 10_000;
  const share = budgetMicros > 0 ? everyone.monthMicros / budgetMicros : 0;
  const perPerson = everyone.activePeople > 0 ? Math.round(everyone.monthMicros / everyone.activePeople) : 0;
  const defaultModel = assistantModelId();

  return (
    <AppShell active="settings">
      <main className="flex flex-col gap-10 px-5 py-4 md:mx-auto md:w-full md:max-w-3xl md:py-10">
        <div className="flex flex-col gap-1">
          <h1 className="font-serif text-3xl">Owner dashboard</h1>
          <p className="text-sm font-semibold text-muted">Only you can see this page.</p>
        </div>

        <section className="flex flex-col gap-4">
          <div className="flex items-end justify-between">
            <h2 className="font-serif text-2xl">AI spend in {month}</h2>
            <span className="text-xs font-extrabold text-muted">heads-up at ${settings.monthlyLimitCents / 100}</span>
          </div>
          <Card variant={share >= 0.8 ? "stamp" : "soft"} className="flex flex-col gap-3 p-4">
            <div className="flex items-baseline gap-3">
              <span className="font-serif text-4xl">{formatDollars(everyone.monthMicros)}</span>
              <span className="text-sm font-semibold text-muted">across everyone so far</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-pill bg-tan" aria-hidden="true">
              <div
                className={`h-full rounded-pill ${share >= 0.8 ? "bg-sun" : "bg-grass"}`}
                style={{ width: `${Math.min(100, Math.round(share * 100))}%` }}
              />
            </div>
            {share >= 0.8 && (
              <p className="text-sm font-bold">Close to your monthly heads-up. Nothing is blocked.</p>
            )}
            <p className="text-sm font-semibold">
              {everyone.activePeople} {everyone.activePeople === 1 ? "person" : "people"} active ·{" "}
              {formatDollars(perPerson)} per person
            </p>
            <ByModel costs={everyone} />
          </Card>
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-extrabold">Monthly heads-up</span>
            <BudgetPicker cents={settings.monthlyLimitCents} />
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="font-serif text-2xl">Your model trial</h2>
            <p className="text-sm font-semibold text-ink-soft">
              Changes the AI for your account only. Everyone else keeps the default.
            </p>
          </div>
          <ModelSwitch current={settings.assistantModel} options={trialModels} defaultName={nameOf(defaultModel)} />
          <Card variant="soft" className="flex flex-col gap-2 p-4">
            <span className="text-[13px] font-extrabold">Your spend this month, by model</span>
            <ByModel costs={mine} />
          </Card>
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="font-serif text-2xl">People</h2>
            <p className="text-sm font-semibold text-ink-soft">
              Everyone with an account. Removing someone deletes their account and everything in it, for good.
            </p>
          </div>
          <Card variant="soft" className="p-4">
            <PeopleList
              me={session.user.id}
              people={people.map((p) => ({
                ...p,
                joinedAt: p.joinedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
              }))}
            />
          </Card>
        </section>
      </main>
    </AppShell>
  );
}
