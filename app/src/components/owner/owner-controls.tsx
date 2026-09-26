"use client";

import { useState, useTransition } from "react";
import { setBudget, setMyModel } from "@/app/owner/actions";
import { Chip } from "@/components/ui/chip";

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}>
      <Chip variant={on ? "sun" : "soft"} className="h-10 px-4 text-sm">
        {children}
      </Chip>
    </button>
  );
}

export function ModelSwitch({
  current,
  options,
  defaultName,
}: {
  current: string | null;
  options: readonly { id: string; name: string }[];
  defaultName: string;
}) {
  const [value, setValue] = useState(current);
  const [pending, start] = useTransition();

  function pick(id: string | null) {
    setValue(id);
    start(async () => {
      await setMyModel(id);
    });
  }

  return (
    <div className="flex flex-wrap gap-2" aria-busy={pending}>
      <Toggle on={value === null} onClick={() => pick(null)}>
        Default ({defaultName})
      </Toggle>
      {options.map((m) => (
        <Toggle key={m.id} on={value === m.id} onClick={() => pick(m.id)}>
          {m.name}
        </Toggle>
      ))}
    </div>
  );
}

const budgets = [2500, 5000, 10000, 25000];

export function BudgetPicker({ cents }: { cents: number }) {
  const [value, setValue] = useState(cents);
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-wrap gap-2" aria-busy={pending}>
      {budgets.map((b) => (
        <Toggle
          key={b}
          on={value === b}
          onClick={() => {
            setValue(b);
            start(async () => {
              await setBudget(b);
            });
          }}
        >
          ${b / 100}
        </Toggle>
      ))}
    </div>
  );
}
