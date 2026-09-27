"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { finishOnboarding } from "@/app/onboarding/actions";
import { Button } from "@/components/ui/button";
import { ChalkOutline } from "@/components/ui/chalk";
import { Wordmark } from "@/components/wordmark";
import { connectGoogle } from "@/lib/connect-google";
import { googleServices } from "@/lib/google/services";

type Props = {
  name: string;
  /** Whether Google connections are set up on this site. */
  googleAvailable: boolean;
  /** Whether this person signed in with Google (or already linked it). */
  hasGoogle: boolean;
};

const steps = ["Welcome", "Connect"] as const;

const how = [
  { title: "Tell it anything", body: "Birthdays, plans, workouts, recipes, people. Type or talk." },
  { title: "It files everything", body: "LifePark sorts it all for you and reminds you when it matters." },
  { title: "Watch your park grow", body: "Everything you add gets a spot in your own little park." },
];

export function OnboardingFlow({ name, googleAvailable, hasGoogle }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [chosen, setChosen] = useState<string[]>(googleServices.map((s) => s.id));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const first = name.split(" ")[0];

  function toPark() {
    setError(null);
    start(async () => {
      await finishOnboarding();
      router.push("/park");
    });
  }

  function connect() {
    setError(null);
    start(async () => {
      try {
        await finishOnboarding();
        await connectGoogle(chosen, "/park");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't reach Google. Try again.");
      }
    });
  }

  function toggle(id: string) {
    setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-5 pt-11 pb-10">
      <header className="flex items-center justify-between">
        <Wordmark size="sm" />
        <button
          type="button"
          onClick={toPark}
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
        <section className="flex flex-col gap-5">
          <h1 className="font-serif text-3xl">Welcome to LifePark{first ? `, ${first}` : ""}.</h1>
          <ol className="flex flex-col gap-3">
            {how.map((h, i) => (
              <li key={h.title} className="relative isolate flex gap-3 rounded-card px-4 py-3">
                <ChalkOutline radius={22} />
                <span className="font-hand text-2xl text-grass-deep">{i + 1}</span>
                <span className="flex flex-col">
                  <span className="font-hand text-xl">{h.title}</span>
                  <span className="text-sm font-semibold text-ink-soft">{h.body}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {step === 1 && googleAvailable && (
        <section className="flex flex-col gap-4">
          <h1 className="font-serif text-3xl">
            {hasGoogle ? "Bring in your Google stuff" : "Use Google too? Connect it"}
          </h1>
          <p className="text-sm font-semibold text-ink-soft">
            {hasGoogle
              ? "Pick what LifePark may read. Your park starts growing the moment you connect."
              : "Connect a Google account to fill your park right away. Apple Calendar, Reminders, and Contacts come with the LifePark iPhone app."}{" "}
            LifePark only reads; it never changes or sends anything.
          </p>
          <ul className="flex flex-col gap-2" aria-label="Google services">
            {googleServices.map((s) => {
              const on = chosen.includes(s.id);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggle(s.id)}
                    className={`relative isolate flex w-full items-start gap-3 rounded-card bg-card px-4 py-3 text-left ${on ? "" : "border-2 border-tan opacity-70"}`}
                  >
                    {on && <ChalkOutline radius={22} width={3} />}
                    <span aria-hidden="true" className="mt-0.5 font-hand text-xl">
                      {on ? "☑" : "☐"}
                    </span>
                    <span className="flex flex-col">
                      <span className="font-hand text-xl">{s.label}</span>
                      <span className="text-sm font-semibold text-ink-soft">{s.park}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {step === 1 && !googleAvailable && (
        <section className="flex flex-col gap-4">
          <h1 className="font-serif text-3xl">Your park is ready to plant</h1>
          <p className="text-sm font-semibold text-ink-soft">
            Connecting Google is almost ready. Until then, tell LifePark about your life in chat and watch your park grow.
          </p>
        </section>
      )}

      {error && (
        <p role="alert" className="rounded-chip bg-sun px-3 py-2 text-xs font-bold">
          {error}
        </p>
      )}

      <footer className="mt-auto flex items-center justify-between gap-3 pt-4">
        <Button variant="ghost" onClick={() => setStep(0)} disabled={step === 0 || pending}>
          Back
        </Button>
        {step === 0 && (
          <Button size="lg" onClick={() => setStep(1)}>
            Let&apos;s build your park
          </Button>
        )}
        {step === 1 && googleAvailable && (
          <Button size="lg" onClick={connect} disabled={pending || chosen.length === 0}>
            {pending ? "Opening Google" : "Connect Google"}
          </Button>
        )}
        {step === 1 && !googleAvailable && (
          <Button size="lg" onClick={toPark} disabled={pending}>
            {pending ? "Opening" : "See my park"}
          </Button>
        )}
      </footer>
    </main>
  );
}
