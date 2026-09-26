"use client";

import { useState, useTransition } from "react";
import { updatePreferences } from "@/app/settings/actions";
import { Chip } from "@/components/ui/chip";

type Props = {
  navigation: "list" | "park";
  voice: "speechify" | "device";
};

export function Preferences(initial: Props) {
  const [prefs, setPrefs] = useState(initial);
  const [pending, start] = useTransition();

  function apply(patch: Partial<Props>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    start(async () => {
      await updatePreferences(patch);
    });
  }

  return (
    <div className="flex flex-col gap-5" aria-busy={pending}>
      <Group label="Navigation">
        <Toggle on={prefs.navigation === "list"} onClick={() => apply({ navigation: "list" })}>
          List
        </Toggle>
        <Toggle on={prefs.navigation === "park"} onClick={() => apply({ navigation: "park" })}>
          Park map
        </Toggle>
      </Group>
      <Group label="Read-aloud voice">
        <Toggle on={prefs.voice === "speechify"} onClick={() => apply({ voice: "speechify" })}>
          Speechify
        </Toggle>
        <Toggle on={prefs.voice === "device"} onClick={() => apply({ voice: "device" })}>
          This device
        </Toggle>
      </Group>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-extrabold">{label}</span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}>
      <Chip variant={on ? "sun" : "soft"} className="h-10 px-4 text-sm">
        {children}
      </Chip>
    </button>
  );
}
