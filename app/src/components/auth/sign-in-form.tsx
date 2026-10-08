"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChalkButton } from "@/components/ui/chalk";
import { ChatGPTMark } from "@/components/auth/chatgpt-mark";
import { TextField } from "@/components/ui/text-field";
import { authClient } from "@/lib/auth-client";
import { providerLabels, type SocialProvider } from "@/lib/auth-providers";

type Mode = "sign-in" | "sign-up";

type Props = {
  mode: Mode;
  providers: SocialProvider[];
  /** Why the last Google, Apple, or ChatGPT sign-in came back without signing in. */
  notice?: string | null;
};

export function SignInForm({ mode, providers, notice = null }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [providerError, setProviderError] = useState<string | null>(notice);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setProviderError(null);
    setBusy("email");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "");

    const result =
      mode === "sign-up"
        ? await authClient.signUp.email({ name, email, password })
        : await authClient.signIn.email({ email, password });

    setBusy(null);
    if (result.error) {
      setError(
        result.error.status === 429
          ? "Too many tries in a row. Wait a few seconds and try again."
          : (result.error.message ?? "That did not work. Try again."),
      );
      return;
    }
    router.push("/chats");
    router.refresh();
  }

  async function passkey() {
    setError(null);
    setProviderError(null);
    setBusy("passkey");
    const result = await authClient.signIn.passkey();
    setBusy(null);
    if (result?.error) {
      setError(result.error.message ?? "No passkey found for this device.");
      return;
    }
    router.push("/chats");
    router.refresh();
  }

  async function social(provider: SocialProvider) {
    setError(null);
    setProviderError(null);
    setBusy(provider);
    // A failed or cancelled sign-in comes back to this page with `?error=`.
    const result = await authClient.signIn.social({
      provider,
      callbackURL: "/chats",
      errorCallbackURL: `/${mode}?from=${provider}`,
    });
    if (result.error) {
      setBusy(null);
      setProviderError(
        result.error.status === 429
          ? "Too many tries in a row. Wait a few seconds and try again."
          : result.error.status === 404
            ? `${providerLabels[provider]} sign-in isn't available right now. Pick another way.`
            : `Couldn't reach ${providerLabels[provider]}. Try again, or pick another way.`,
      );
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {providers.length > 0 && (
        <>
          <div data-intro-step="write" data-intro-for="0.65" className="flex flex-col gap-2.5">
            {providers.map((p) => (
              <ProviderButton
                key={p}
                provider={p}
                disabled={busy !== null}
                busy={busy === p}
                onClick={() => social(p)}
              />
            ))}
          </div>
          {providerError && (
            <p role="alert" className="rounded-chip bg-sun px-3 py-2 text-xs font-bold">
              {providerError}
            </p>
          )}
          <div data-intro-step="write" data-intro-for="0.4" className="flex items-center gap-3" aria-hidden="true">
            <span className="h-0.5 flex-1 rounded-pill bg-tan" />
            <span className="font-serif text-sm italic text-muted">or with email</span>
            <span className="h-0.5 flex-1 rounded-pill bg-tan" />
          </div>
        </>
      )}

      <form onSubmit={submit} className="flex flex-col gap-4">
        {mode === "sign-up" && (
          <div data-intro-step="write">
            <TextField
              label="Name"
              name="name"
              autoComplete="name"
              placeholder="What should we call you?"
              required
            />
          </div>
        )}
        <div data-intro-step="write">
          <TextField
            label="Email"
            name="email"
            type="email"
            autoComplete={mode === "sign-up" ? "email" : "username webauthn"}
            placeholder="you@example.com"
            required
          />
        </div>
        <div data-intro-step="write">
          <TextField
            label="Password"
            name="password"
            type="password"
            autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
            hint={mode === "sign-up" ? "At least 10 characters." : undefined}
            minLength={10}
            required
          />
        </div>
        {error && (
          <p role="alert" className="rounded-chip bg-sun px-3 py-2 text-xs font-bold">
            {error}
          </p>
        )}
        <ChalkButton tone="grass" type="submit" disabled={busy !== null} className="mt-1" data-intro-step="write" data-intro-for="0.6">
          {busy === "email"
            ? "One moment"
            : mode === "sign-up"
              ? "Create account"
              : "Sign in"}
        </ChalkButton>
      </form>

      {mode === "sign-in" && (
        <ChalkButton tone="outline" type="button" disabled={busy !== null} onClick={passkey} data-intro-step="write">
          {busy === "passkey" ? "Waiting for your device" : "Use a passkey"}
        </ChalkButton>
      )}
    </div>
  );
}

const marks: Record<SocialProvider, ReactNode> = {
  google: <GoogleMark />,
  apple: <AppleMark />,
  chatgpt: <ChatGPTMark />,
};

/** Google, Apple, and ChatGPT keep their logos and "Continue with" wording, drawn in crayon. */
function ProviderButton({
  provider,
  disabled,
  busy,
  onClick,
}: {
  provider: SocialProvider;
  disabled: boolean;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <ChalkButton
      tone={provider}
      type="button"
      onClick={onClick}
      disabled={disabled}
      icon={marks[provider]}
    >
      {busy ? "One moment" : `Continue with ${providerLabels[provider]}`}
    </ChalkButton>
  );
}

function GoogleMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg width="20" height="24" viewBox="0 0 17 20" fill="currentColor" aria-hidden="true">
      <path d="M14.1 10.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9-.1 0-2.7-1-2.7-4.1zM11.6 3c.7-.9 1.2-2 1-3.2-1 0-2.3.7-3 1.6-.7.8-1.3 2-1.1 3.1 1.1.1 2.3-.6 3.1-1.5z" />
    </svg>
  );
}
