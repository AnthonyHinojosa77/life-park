"use client";

import { useState, useTransition } from "react";
import { completeOnboarding, skipOnboarding } from "@/app/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";
import type { SettingsInput } from "@/lib/settings";

type Props = {
  name: string;
  initial: SettingsInput;
};

const steps = ["Navigation", "Voice"] as const;

export function OnboardingFlow({ name, initial }: Props) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<SettingsInput>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const last = step === steps.length - 1;

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
          <h1 className="font-serif text-3xl">Hi {name.split(" ")[0]}. How do you want to get around?</h1>
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

      {step === 1 && (
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
