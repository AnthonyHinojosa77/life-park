import type { ReactNode } from "react";
import Link from "next/link";
import { ChalkDefs, ChalkDust } from "@/components/ui/chalk";
import { Wordmark } from "@/components/wordmark";
import { isPreview } from "@/lib/preview";

type Props = {
  title: string;
  footer: { text: string; linkText: string; href: string };
  children: ReactNode;
};

export function AuthShell({ title, footer, children }: Props) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-5 py-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <Wordmark size="md" />
        <p className="font-serif text-lg italic text-ink-soft">Your life, filed by AI and grown into a park.</p>
      </div>
      {isPreview() && (
        <p className="max-w-sm rounded-chip border-2 border-tan bg-sun/40 px-3 py-2 text-center text-xs font-bold">
          Preview: accounts and chats last until the server restarts.
        </p>
      )}
      <ChalkDefs />
      <div className="relative flex w-full max-w-sm flex-col gap-5 overflow-hidden rounded-card border-2 border-ink bg-card p-6">
        <ChalkDust />
        <h1 className="relative font-serif text-3xl">{title}</h1>
        <div className="relative">{children}</div>
      </div>
      <p className="text-sm font-semibold text-muted">
        {footer.text}{" "}
        <Link href={footer.href} className="font-extrabold text-ink underline">
          {footer.linkText}
        </Link>
      </p>
    </main>
  );
}
