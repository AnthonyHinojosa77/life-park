"use client";

import { useState, useTransition } from "react";
import { restoreDefaultRules, updateRules } from "@/app/settings/actions";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";

type Props = {
  content: string;
  edited: boolean;
  updatedAt: string | null;
};

export function RulesEditor({ content, edited, updatedAt }: Props) {
  const [text, setText] = useState(content);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dirty = text !== content;

  function save() {
    setNote(null);
    start(async () => {
      const r = await updateRules(text);
      setNote(r.error ?? "Saved. Every new message uses these rules.");
    });
  }

  function restore() {
    setNote(null);
    start(async () => {
      await restoreDefaultRules();
      setNote("Back to the repository version.");
    });
  }

  function download() {
    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "AGENTS.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Chip variant={edited ? "sun" : "grass"}>
          {edited ? "Edited in LifePark" : "Same as the repository"}
        </Chip>
        {updatedAt && (
          <span className="text-xs font-semibold text-muted">Last saved {updatedAt}</span>
        )}
      </div>
      <textarea
        aria-label="Rules"
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        rows={22}
        className="w-full rounded-card border-2 border-tan bg-card p-4 font-mono text-base leading-relaxed md:text-[13px] outline-none focus:border-ink"
      />
      {note && (
        <p role="status" className="rounded-chip bg-grass-light px-3 py-2 text-xs font-bold text-grass-deep">
          {note}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={save} disabled={!dirty || pending}>
          {pending ? "Saving" : "Save rules"}
        </Button>
        <Button variant="soft" onClick={download} type="button">
          Download as AGENTS.md
        </Button>
        {edited && (
          <Button variant="ghost" onClick={restore} disabled={pending} type="button">
            Restore repository version
          </Button>
        )}
      </div>
      <p className="text-xs font-semibold text-muted">
        The downloaded file is the exact text sent to every model. Commit it as AGENTS.md so the
        repository and the app stay in step. Automatic sync to GitHub arrives with the GitHub
        connection in milestone 4.
      </p>
    </div>
  );
}
