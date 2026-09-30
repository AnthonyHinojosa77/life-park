"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Wordmark } from "@/components/wordmark";

type Phase = "draw" | "move" | "reveal" | "done";

/** Pause on the finished logo before it moves up. */
const HOLD_MS = 350;
const MOVE_MS = 750;
/** The first piece of the page starts drawing this long after the logo lands. */
const REVEAL_LEAD_S = 0.15;
/** Each piece starts when the one before it is this far through its own drawing. */
const OVERLAP = 0.7;
/** How long a piece takes to draw, by kind, unless it says otherwise (`data-intro-for`). */
const DRAW_S: Record<string, number> = { write: 0.6, card: 1.5 };
/** A safety net so the page never stays half-drawn if an animation never reports back. */
const REVEAL_CAP_MS = 9000;

// Runs before the first paint, so anyone who prefers less motion never sees a
// flash of the big logo.
const skipScript = `try{if(matchMedia("(prefers-reduced-motion: reduce)").matches)document.currentScript.parentElement.setAttribute("data-intro","done")}catch(e){}`;

function reducedMotion() {
  try {
    return matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

// Set once the logo has played in this visit, so hopping between sign-in and
// sign-up does not replay it; a fresh open of the app starts over.
let logoPlayed = false;

/**
 * The sign-in and sign-up intro, every time the app is opened signed out: the
 * LifePark name and tree are drawn large in the middle of the screen, then
 * shrink into their spot at the top, and the rest of the page draws itself in
 * piece by piece. Tap anywhere to skip ahead.
 */
export function AuthIntro({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>("draw");
  const rootRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  const skipLogo = () => {
    timers.current.forEach((t) => clearTimeout(t));
    markRef.current?.getAnimations().forEach((a) => a.cancel());
    setPhase("reveal");
  };

  // Decide before paint on client-side navigations, too.
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (reducedMotion()) setPhase("done");
    else if (logoPlayed) setPhase("reveal");
  }, []);

  useEffect(() => {
    if (phase !== "draw") return;
    const overlay = overlayRef.current;
    if (!overlay) return;
    logoPlayed = true;
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

  // Schedule the pieces of the page in the order they appear, each starting
  // as the one before it is most of the way drawn. Done before paint, so no
  // piece shows up early.
  useLayoutEffect(() => {
    if (phase !== "reveal" || !rootRef.current) return;
    let at = REVEAL_LEAD_S;
    for (const piece of rootRef.current.querySelectorAll<HTMLElement>("[data-intro-step]")) {
      const kind = piece.dataset.introStep || "write";
      const seconds = Number(piece.dataset.introFor) || DRAW_S[kind] || DRAW_S.write;
      piece.style.setProperty("--at", `${at.toFixed(2)}s`);
      piece.style.setProperty("--for", `${seconds}s`);
      at += seconds * OVERLAP;
    }
  }, [phase]);

  // The page is done once its last piece has finished drawing.
  useEffect(() => {
    if (phase !== "reveal" || !rootRef.current) return;
    const root = rootRef.current;
    let cancelled = false;
    const cap = window.setTimeout(() => !cancelled && setPhase("done"), REVEAL_CAP_MS);
    // Animations exist only after the browser has applied the new styles.
    const frame = requestAnimationFrame(() => {
      const drawing = root.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => undefined));
      void Promise.all(drawing).then(() => !cancelled && setPhase("done"));
    });
    return () => {
      cancelled = true;
      clearTimeout(cap);
      cancelAnimationFrame(frame);
    };
  }, [phase]);

  // A tap while the page is drawing finishes it at once, and still lands on
  // whatever was tapped.
  const skipReveal = () => {
    if (phase !== "reveal" || !rootRef.current) return;
    rootRef.current.getAnimations({ subtree: true }).forEach((a) => a.finish());
    setPhase("done");
  };

  return (
    <div ref={rootRef} data-intro={phase} suppressHydrationWarning className="flex flex-1 flex-col" onPointerDownCapture={skipReveal}>
      <script dangerouslySetInnerHTML={{ __html: skipScript }} />
      {(phase === "draw" || phase === "move") && (
        <div
          ref={overlayRef}
          data-intro-overlay
          className="intro-overlay fixed inset-0 z-50 cursor-pointer"
          onClick={skipLogo}
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
