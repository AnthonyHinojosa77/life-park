"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { authClient } from "@/lib/auth-client";
import { providerLabels, type SocialProvider } from "@/lib/auth-providers";

type Mode = "sign-in" | "sign-up";

type Props = {
  mode: Mode;
  providers: SocialProvider[];
};

export function SignInForm({ mode, providers }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
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
    setBusy(provider);
    await authClient.signIn.social({ provider, callbackURL: "/chats" });
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={submit} className="flex flex-col gap-4">
        {mode === "sign-up" && (
          <TextField
            label="Name"
            name="name"
            autoComplete="name"
            placeholder="Anthony"
            required
          />
        )}
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete={mode === "sign-up" ? "email" : "username webauthn"}
          placeholder="you@example.com"
          required
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
          hint={mode === "sign-up" ? "At least 10 characters." : undefined}
          minLength={10}
          required
        />
        {error && (
          <p role="alert" className="rounded-chip bg-sun px-3 py-2 text-xs font-bold">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" disabled={busy !== null}>
          {busy === "email"
            ? "One moment"
            : mode === "sign-up"
              ? "Create account"
              : "Sign in"}
        </Button>
      </form>

      {mode === "sign-in" && (
        <Button
          type="button"
          variant="stamp"
          size="lg"
          disabled={busy !== null}
          onClick={passkey}
        >
          {busy === "passkey" ? "Waiting for your device" : "Use a passkey"}
        </Button>
      )}

      {providers.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-center font-serif text-sm italic text-muted">or continue with</p>
          <div className="grid grid-cols-2 gap-2">
            {providers.map((p) => (
              <Button
                key={p}
                type="button"
                variant="soft"
                disabled={busy !== null}
                onClick={() => social(p)}
              >
                {providerLabels[p]}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
