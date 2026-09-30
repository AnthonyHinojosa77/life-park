import type { ReactNode } from "react";
import Link from "next/link";
import { ChalkDust, ChalkOutline } from "@/components/ui/chalk";
import { Wordmark } from "@/components/wordmark";
import { AuthIntro } from "./auth-intro";
import { isPreview } from "@/lib/preview";

type Props = {
  title: string;
  footer: { text: string; linkText: string; href: string };
  children: ReactNode;
};

/**
 * Every `data-intro-step` is drawn in after the intro, in page order: text is
 * written out, the card's outline is traced, and `data-intro-for` is how many
 * seconds a piece takes.
 */
export function AuthShell({ title, footer, children }: Props) {
  return (
    <AuthIntro>
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-5 py-12">
        <div className="flex flex-col items-center gap-2 text-center">
          <div data-intro-target>
            <Wordmark size="md" />
          </div>
          <p data-intro-step="write" data-intro-for="1" className="font-serif text-lg italic text-ink-soft">
            Your life, filed, and grown into your own park.
          </p>
        </div>
        {isPreview() && (
          <p data-intro-step="write" data-intro-for="0.45" className="max-w-sm rounded-chip border-2 border-tan bg-sun/40 px-3 py-2 text-center text-xs font-bold">
            Preview: accounts and chats last until the server restarts.
          </p>
        )}
        <div data-intro-step="card" className="relative isolate flex w-full max-w-sm flex-col gap-5 rounded-card bg-card p-6">
          <ChalkOutline radius={22} width={3} className="intro-card-outline" />
          <div className="intro-card-dust absolute inset-0 overflow-hidden rounded-card">
            <ChalkDust />
          </div>
          <h1 data-intro-step="write" data-intro-for="0.75" className="relative text-center font-serif text-3xl">
            {title}
          </h1>
          <div className="relative">
            {children}
          </div>
        </div>
        <p data-intro-step="write" data-intro-for="0.5" className="text-sm font-semibold text-muted">
          {footer.text}{" "}
          <Link href={footer.href} className="font-extrabold text-ink underline">
            {footer.linkText}
          </Link>
        </p>
      </main>
    </AuthIntro>
  );
}
