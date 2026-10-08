"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

type Props = {
  linked: boolean;
  /** How the last attempt to add ChatGPT went, from `?chatgpt=` on the way back. */
  result?: "added" | "failed";
};

/** Adds ChatGPT as another way to sign in to this same account. */
export function ChatGPTSignIn({ linked, result }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    result === "failed" ? "ChatGPT wasn't added. That ChatGPT account may already belong to another LifePark account." : null,
  );

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
      setError("Couldn't reach ChatGPT. Try again in a moment.");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {linked ? (
        <p className="text-sm font-semibold text-ink-soft">
          {result === "added" ? "ChatGPT added. " : ""}You can also sign in with ChatGPT. LifePark only sees your ChatGPT
          name, email, and picture, never your chats.
        </p>
      ) : (
        <>
          <p className="text-sm font-semibold text-ink-soft">
            Sign in with your ChatGPT account too. LifePark only sees your ChatGPT name, email, and picture, never your chats.
          </p>
          <Button size="sm" className="self-start" disabled={busy} onClick={add}>
            {busy ? "One moment" : "Add ChatGPT sign-in"}
          </Button>
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
