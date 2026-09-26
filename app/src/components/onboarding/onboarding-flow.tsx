"use client";

import { useState, useTransition } from "react";
import { completeOnboarding, skipOnboarding } from "@/app/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { CheckIcon } from "@/components/ui/icons";
import { Wordmark } from "@/components/wordmark";
import { formatPerMillion, type CatalogModel } from "@/lib/models/catalog";
import type { SettingsInput } from "@/lib/settings";

type Props = {
  name: string;
  models: CatalogModel[];
  initial: SettingsInput;
};

const steps = ["Models", "Navigation", "Voice", "Spending"] as const;
const limitPresets = [1000, 2500, 5000, 10000];

export function OnboardingFlow({ name, models, initial }: Props) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<SettingsInput>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const last = step === steps.length - 1;

  function toggleModel(id: string) {
    setDraft((d) => ({
      ...d,
      favoriteModels: d.favoriteModels.includes(id)
        ? d.favoriteModels.filter((m) => m !== id)
        : [...d.favoriteModels, id],
    }));
  }

  function finish() {
    setError(null);
    start(async () => {
      const result = await completeOnboarding(draft);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-5 pt-11 pb-10">
      <header className="flex items-center justify-between">
        <Wordmark size="sm" />
        <button
          type="button"
          onClick={() => start(() => skipOnboarding())}
          className="font-serif text-sm italic text-muted underline"
          disabled={pending}
        >
          Skip for now
        </button>
      </header>

      <ol className="flex gap-2" aria-label="Steps">
        {steps.map((s, i) => (
          <li
            key={s}
            aria-current={i === step ? "step" : undefined}
            className={`h-2 flex-1 rounded-pill ${i <= step ? "bg-grass" : "bg-tan"}`}
          >
            <span className="sr-only">{s}</span>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <section className="flex flex-col gap-4">
          <h1 className="font-serif text-3xl">Hi {name.split(" ")[0]}. Which models do you want close at hand?</h1>
          <p className="text-sm font-semibold text-muted">
            A balanced set is already chosen. Tap to add or remove. Every other model stays one search away in Settings.
          </p>
          {models.length === 0 && (
            <Card variant="soft" className="p-4 text-sm font-semibold">
              The model list could not load right now. Your balanced set is saved anyway.
            </Card>
          )}
          <ul className="flex flex-col gap-2">
            {models.map((m) => {
              const on = draft.favoriteModels.includes(m.id);
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggleModel(m.id)}
                    className={`flex w-full items-center gap-3 rounded-chip border-2 px-3 py-2.5 text-left ${
                      on ? "border-ink bg-card shadow-[var(--shadow-stamp-sm)]" : "border-tan bg-card"
                    }`}
                  >
                    <span
                      className={`flex size-6 shrink-0 items-center justify-center rounded-lg border-2 ${
                        on ? "border-ink bg-grass text-white" : "border-tan"
                      }`}
                    >
                      {on && <CheckIcon size={14} />}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-extrabold">{m.name}</span>
                      <span className="text-[11px] font-semibold text-muted">
                        {m.provider} · {formatPerMillion(m.promptPerMillion)} in · {formatPerMillion(m.completionPerMillion)} out
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {step === 1 && (
        <section className="flex flex-col gap-4">
          <h1 className="font-serif text-3xl">How do you want to get around?</h1>
          <div className="grid gap-3 sm:grid-cols-2">
            <ChoiceCard
              on={draft.navigation === "list"}
              onClick={() => setDraft({ ...draft, navigation: "list" })}
              title="A list"
              body="Projects and chats in a clean sidebar. Fast and familiar. The park map is one tap away."
            />
            <ChoiceCard
              on={draft.navigation === "park"}
              onClick={() => setDraft({ ...draft, navigation: "park" })}
              title="The park"
              body="Your work as a map: projects as lawns, chats as trees, paths between related ideas."
            />
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="flex flex-col gap-4">
          <h1 className="font-serif text-3xl">Which voice should read to you?</h1>
          <div className="grid gap-3 sm:grid-cols-2">
            <ChoiceCard
              on={draft.voice === "speechify"}
              onClick={() => setDraft({ ...draft, voice: "speechify" })}
              title="Speechify"
              body="The same natural voice on every device. Free for a generous amount each month."
            />
            <ChoiceCard
              on={draft.voice === "device"}
              onClick={() => setDraft({ ...draft, voice: "device" })}
              title="This device"
              body="The built-in voice of your phone or laptop. Always free, sounds different per device."
            />
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="flex flex-col gap-4">
          <h1 className="font-serif text-3xl">Set a monthly heads-up.</h1>
          <p className="text-sm font-semibold text-muted">
            You pay per message through your own OpenRouter key. LifePark warns you when the month nears this amount. It never blocks you.
          </p>
          <div className="flex flex-wrap gap-2">
            {limitPresets.map((cents) => (
              <button
                key={cents}
                type="button"
                onClick={() => setDraft({ ...draft, monthlyLimitCents: cents })}
                aria-pressed={draft.monthlyLimitCents === cents}
              >
                <Chip variant={draft.monthlyLimitCents === cents ? "sun" : "soft"} className="h-10 px-4 text-sm">
                  ${cents / 100}
                </Chip>
              </button>
            ))}
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-extrabold">Or a custom amount in dollars</span>
            <input
              type="number"
              min={1}
              max={10000}
              value={draft.monthlyLimitCents / 100}
              onChange={(e) =>
                setDraft({ ...draft, monthlyLimitCents: Math.round(Number(e.target.value) * 100) })
              }
              className="h-12 w-40 rounded-pill border-2 border-tan bg-card px-4 text-[15px] font-semibold outline-none focus:border-ink"
            />
          </label>
        </section>
      )}

      {error && (
        <p role="alert" className="rounded-chip bg-sun px-3 py-2 text-xs font-bold">
          {error}
        </p>
      )}

      <footer className="mt-auto flex items-center justify-between gap-3 pt-4">
        <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || pending}>
          Back
        </Button>
        {last ? (
          <Button size="lg" onClick={finish} disabled={pending}>
            {pending ? "Saving" : "Open LifePark"}
          </Button>
        ) : (
          <Button size="lg" onClick={() => setStep((s) => s + 1)} disabled={pending}>
            Next
          </Button>
        )}
      </footer>
    </main>
  );
}

function ChoiceCard({
  on,
  onClick,
  title,
  body,
}: {
  on: boolean;
  onClick: () => void;
  title: string;
  body: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={`flex flex-col gap-1.5 rounded-card border-2 p-4 text-left ${
        on ? "border-ink bg-card shadow-[var(--shadow-stamp)]" : "border-tan bg-card"
      }`}
    >
      <span className="font-serif text-xl">{title}</span>
      <span className="text-sm font-semibold text-ink-soft">{body}</span>
    </button>
  );
}
