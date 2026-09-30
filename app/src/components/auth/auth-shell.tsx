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

/** `--step` orders how the page draws in after the intro. */
const step = (n: number) => ({ "data-intro-step": "", style: { "--step": n } as React.CSSProperties });

export function AuthShell({ title, footer, children }: Props) {
  return (
    <AuthIntro>
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-5 py-12">
        <div className="flex flex-col items-center gap-2 text-center">
          <div data-intro-target>
            <Wordmark size="md" />
          </div>
          <p {...step(0)} className="font-serif text-lg italic text-ink-soft">
            Your life, filed, and grown into your own park.
          </p>
        </div>
        {isPreview() && (
          <p {...step(1)} className="max-w-sm rounded-chip border-2 border-tan bg-sun/40 px-3 py-2 text-center text-xs font-bold">
            Preview: accounts and chats last until the server restarts.
          </p>
        )}
        <div {...step(1)} className="relative isolate flex w-full max-w-sm flex-col gap-5 rounded-card bg-card p-6">
          <ChalkOutline radius={22} width={3} className="intro-card-outline" />
          <div className="absolute inset-0 overflow-hidden rounded-card">
            <ChalkDust />
          </div>
          <h1 {...step(3)} className="relative text-center font-serif text-3xl">
            {title}
          </h1>
          <div {...step(4)} className="relative">
            {children}
          </div>
        </div>
        <p {...step(5)} className="text-sm font-semibold text-muted">
          {footer.text}{" "}
          <Link href={footer.href} className="font-extrabold text-ink underline">
            {footer.linkText}
          </Link>
        </p>
      </main>
    </AuthIntro>
  );
}
