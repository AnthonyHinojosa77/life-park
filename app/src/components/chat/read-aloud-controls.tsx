"use client";

import { ChalkFill, ChalkOutline, chalk } from "@/components/ui/chalk";
import { PlayIcon, SpeakerIcon } from "@/components/ui/icons";

export function ListenButton({
  playing,
  onClick,
}: {
  playing: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={playing}
      className="relative isolate inline-flex h-9 items-center gap-2 rounded-pill pr-4 pl-3 font-hand text-[17px] leading-none text-white active:scale-[0.97]"
    >
      <ChalkFill color={playing ? "#2f6a37" : chalk.grass} radius={10} />
      {playing ? (
        <span aria-hidden="true" className="size-3 rounded-sm bg-white" />
      ) : (
        <PlayIcon size={15} />
      )}
      {playing ? "Stop" : "Listen"}
    </button>
  );
}

export function HandsFreeToggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="Hands-free"
      title={on ? "Hands-free is on: every reply is read aloud" : "Hands-free: read every reply aloud"}
      onClick={() => onChange(!on)}
      className={`relative isolate inline-flex h-10 items-center gap-2 rounded-pill px-3 font-hand text-[17px] leading-none active:scale-[0.97] ${on ? "text-ink" : "text-muted"}`}
    >
      {on ? (
        <>
          <ChalkFill color={chalk.sun} radius={12} />
          <ChalkOutline radius={12} width={2} />
        </>
      ) : (
        <ChalkFill color={chalk.paper} radius={12} />
      )}
      <SpeakerIcon size={18} />
      <span className="hidden sm:inline">Hands-free</span>
    </button>
  );
}
