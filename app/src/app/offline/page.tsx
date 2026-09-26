import type { Metadata } from "next";
import { Wordmark } from "@/components/wordmark";

export const metadata: Metadata = { title: "Offline" };

/** Shown by the service worker when a page can't load without a connection. */
export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <Wordmark size="md" />
      <h1 className="font-serif text-3xl">The park is closed for now.</h1>
      <p className="max-w-xs text-sm font-semibold text-muted">
        You&apos;re offline. LifePark needs a connection to reach your assistant. Everything you saved is safe
        and will be here when you&apos;re back.
      </p>
    </main>
  );
}
