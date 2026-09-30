"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Wordmark } from "@/components/wordmark";

type Phase = "draw" | "move" | "reveal" | "done";

const SEEN = "lifepark-intro-seen";
/** Pause on the finished logo before it moves up. */
const HOLD_MS = 350;
const MOVE_MS = 750;
/** Long enough for the last staged piece to finish drawing in. */
const REVEAL_MS = 1400;

// Runs before the first paint on a full page load, so a returning visitor (or
// anyone who prefers less motion) never sees a flash of the big logo.
const skipScript = `try{if(sessionStorage.getItem("${SEEN}")||matchMedia("(prefers-reduced-motion: reduce)").matches)document.currentScript.parentElement.setAttribute("data-intro","done")}catch(e){}`;

function shouldSkip() {
  try {
    return Boolean(sessionStorage.getItem(SEEN)) || matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * The sign-in and sign-up intro, once per visit: the LifePark name and tree
 * are drawn large in the middle of the screen, then shrink into their spot at
 * the top, and the rest of the page draws in after. Tap anywhere to skip.
 */
export function AuthIntro({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>("draw");
  const overlayRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  const finish = () => {
    timers.current.forEach((t) => clearTimeout(t));
    markRef.current?.getAnimations().forEach((a) => a.cancel());
    setPhase("done");
  };

  // Decide before paint on client-side navigations, too.
  useLayoutEffect(() => {
    // Returning visitors and reduced-motion users go straight to the page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (shouldSkip()) setPhase("done");
  }, []);

  useEffect(() => {
    if (phase !== "draw") return;
    const overlay = overlayRef.current;
    if (!overlay) return;
    try {
      sessionStorage.setItem(SEEN, "1");
    } catch {}
    let cancelled = false;
    const drawing = overlay.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => undefined));
    const cap = new Promise((r) => setTimeout(r, 3200));
    void Promise.race([Promise.all(drawing), cap]).then(() => {
      if (!cancelled) timers.current.push(window.setTimeout(() => setPhase("move"), HOLD_MS));
    });
    return () => {
      cancelled = true;
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "move") return;
    const mark = markRef.current;
    const target = document.querySelector<HTMLElement>("[data-intro-target]");
    if (!mark || !target) {
      setPhase("reveal");
      return;
    }
    // Shrink the big logo onto the real one at the top: start where it is now,
    // end exactly on top of the page's own wordmark, then swap them.
    const from = mark.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    Object.assign(mark.style, { left: `${to.left}px`, top: `${to.top}px`, transformOrigin: "0 0" });
    const flight = mark.animate(
      [
        { transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width})` },
        { transform: "translate(0, 0) scale(1)" },
      ],
      { duration: MOVE_MS, easing: "cubic-bezier(0.65, 0, 0.25, 1)", fill: "forwards" },
    );
    flight.finished.then(() => setPhase("reveal")).catch(() => undefined);
    return () => flight.cancel();
  }, [phase]);

  useEffect(() => {
    if (phase !== "reveal") return;
    const t = window.setTimeout(() => setPhase("done"), REVEAL_MS);
    return () => clearTimeout(t);
  }, [phase]);

  return (
    <div data-intro={phase} suppressHydrationWarning className="flex flex-1 flex-col">
      <script dangerouslySetInnerHTML={{ __html: skipScript }} />
      {(phase === "draw" || phase === "move") && (
        <div
          ref={overlayRef}
          data-intro-overlay
          className="intro-overlay fixed inset-0 z-50 cursor-pointer"
          onClick={finish}
          role="presentation"
        >
          <div ref={markRef} className="intro-mark">
            <Wordmark size="md" drawn />
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
