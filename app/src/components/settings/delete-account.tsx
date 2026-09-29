"use client";

import { useState, useTransition } from "react";
import { deleteMyAccount } from "@/app/settings/actions";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";

/** Deletes the account for good, behind a typed confirmation. */
export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <Button variant="danger" size="sm" className="self-start" onClick={() => setOpen(true)}>
        Delete my account
      </Button>
    );
  }

  return (
    <form
      className="flex max-w-md flex-col gap-3 rounded-card border-2 border-[#b3372c] bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const result = await deleteMyAccount(typed);
          if (result?.error) setError(result.error);
        });
      }}
    >
      <p className="text-sm font-semibold">
        This deletes your account, your park, your chats, and your connected accounts for good. It can&apos;t be undone.
      </p>
      <TextField label='Type "delete" to confirm' value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
      {error && (
        <p role="alert" className="text-sm font-bold text-[#b3372c]">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" variant="danger" size="sm" disabled={pending || typed.trim().toLowerCase() !== "delete"}>
          {pending ? "Deleting" : "Delete everything"}
        </Button>
        <Button type="button" variant="soft" size="sm" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
