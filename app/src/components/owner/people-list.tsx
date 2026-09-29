"use client";

import { useState, useTransition } from "react";
import { removePerson } from "@/app/owner/actions";
import { Button } from "@/components/ui/button";
import type { Person } from "@/lib/account";

type Row = Omit<Person, "joinedAt"> & { joinedAt: string };

/** Everyone with an account, with a two-tap Remove for each other person. */
export function PeopleList({ people, me }: { people: Row[]; me: string }) {
  const [arming, setArming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function remove(email: string) {
    setError(null);
    start(async () => {
      const result = await removePerson(email);
      if (result?.error) setError(result.error);
      setArming(null);
    });
  }

  return (
    <div className="flex flex-col gap-2" aria-busy={pending}>
      {error && (
        <p role="alert" className="rounded-chip bg-sun px-3 py-2 text-sm font-bold">
          {error}
        </p>
      )}
      <ul className="flex flex-col divide-y-2 divide-paper" aria-label="People">
        {people.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-extrabold">
                {p.email}
                {p.id === me && <span className="text-muted"> (you)</span>}
              </span>
              <span className="text-xs font-semibold text-muted">
                {p.name} · joined {p.joinedAt} · {p.things} {p.things === 1 ? "thing" : "things"}
                {p.google ? " · Google connected" : ""}
              </span>
            </div>
            {p.id !== me &&
              (arming === p.email ? (
                <div className="flex gap-2">
                  <Button size="sm" variant="danger" onClick={() => remove(p.email)} disabled={pending} aria-label={`Really remove ${p.email}`}>
                    {pending ? "Removing" : "Really remove"}
                  </Button>
                  <Button size="sm" variant="soft" onClick={() => setArming(null)} disabled={pending}>
                    Keep
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setArming(p.email)} aria-label={`Remove ${p.email}`}>
                  Remove
                </Button>
              ))}
          </li>
        ))}
      </ul>
    </div>
  );
}
