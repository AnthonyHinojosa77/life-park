"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useClientSnapshot, useLocalFlag } from "@/lib/client-store";

type InstallPromptEvent = Event & { prompt: () => Promise<void> };

function environment() {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const phone = window.matchMedia("(max-width: 767px)").matches;
  if (standalone || !phone) return "none" as const;
  return /iPhone|iPad|iPod/.test(navigator.userAgent) ? ("ios" as const) : ("android" as const);
}

/**
 * A one-line nudge to put LifePark on the home screen. Hidden once installed,
 * once dismissed, and on laptops. Android gets a real Install button once the
 * browser offers one; iOS gets the two taps Safari requires.
 */
export function InstallHint() {
  const env = useClientSnapshot(environment, "none");
  const [dismissed, setDismissed] = useLocalFlag("work-park:install-hint-dismissed");
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (env === "none" || dismissed) return null;
  if (env === "android" && !promptEvent) return null;

  return (
    <div className="mx-4 mb-2 flex items-center gap-3 rounded-chip border-2 border-tan bg-card px-3 py-2 text-xs font-bold md:hidden">
      <span className="flex-1">
        {env === "android"
          ? "Put LifePark on your home screen."
          : "Add to your home screen: tap Share, then “Add to Home Screen”."}
      </span>
      {env === "android" && promptEvent && (
        <Button size="sm" onClick={() => promptEvent.prompt().then(() => setDismissed(true))}>
          Install
        </Button>
      )}
      <button type="button" onClick={() => setDismissed(true)} className="text-muted underline">
        Later
      </button>
    </div>
  );
}
