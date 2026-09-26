"use client";

import { useEffect } from "react";

/** Registers the service worker that makes LifePark installable and offline-aware. */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Without a worker the site still works; only the offline page is lost.
    });
  }, []);
  return null;
}
