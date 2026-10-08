"use client";

import { useEffect, useRef, useState } from "react";
import { ChatGPTMark } from "@/components/auth/chatgpt-mark";
import { ChalkButton } from "@/components/ui/chalk";
import { authClient } from "@/lib/auth-client";
import { chatgptLinkErrorMessage } from "@/lib/auth-providers";

type Props = {
  linked: boolean;
  /** How the last attempt to add ChatGPT went, from `?chatgpt=` on the way back. */
  result?: "added" | "failed";
  /** Why it failed, from `?error=`. */
  reason?: string;
};

/** Adds ChatGPT as another way to sign in to this same account. */
export function ChatGPTSignIn({ linked, result, reason }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(result === "failed" ? chatgptLinkErrorMessage(reason) : null);

  // Coming back from ChatGPT lands at the top of Settings; bring the outcome into view.
  useEffect(() => {
    if (result) ref.current?.scrollIntoView({ block: "center" });
  }, [result]);

  async function add() {
    setBusy(true);
    setError(null);
    const { error } = await authClient.linkSocial({
      provider: "chatgpt",
      callbackURL: "/settings?chatgpt=added",
      errorCallbackURL: "/settings?chatgpt=failed",
    });
    if (error) {
      setBusy(false);
      setError(
        error.status === 429
          ? "Too many tries in a row. Wait a few seconds and try again."
          : error.status === 404
            ? "ChatGPT sign-in isn't available right now. Try again later."
            : "Couldn't reach ChatGPT. Try again in a moment.",
      );
    }
  }

  return (
    <div ref={ref} className="flex flex-col gap-3">
      {linked ? (
        <p className="text-sm font-semibold text-ink-soft">
          {result === "added" ? "ChatGPT added. " : ""}You can also sign in with ChatGPT. LifePark only sees your ChatGPT
          name, email, and picture, never your chats.
        </p>
      ) : (
        <>
          <p className="text-sm font-semibold text-ink-soft">
            Add ChatGPT as another way to sign in to this account. LifePark only sees your ChatGPT name, email, and picture,
            never your chats.
          </p>
          <ChalkButton tone="chatgpt" type="button" className="max-w-sm" disabled={busy} onClick={add} icon={<ChatGPTMark />}>
            {busy ? "One moment" : "Continue with ChatGPT"}
          </ChalkButton>
        </>
      )}
      {error && (
        <p role="alert" className="rounded-chip bg-sun px-3 py-2 text-xs font-bold">
          {error}
        </p>
      )}
    </div>
  );
}
