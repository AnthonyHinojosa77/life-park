import type { ReactNode } from "react";
import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { InstallHint } from "@/components/install-hint";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "@/components/ui/icons";
import { BottomNav, SideNav, type NavKey } from "@/components/ui/nav";
import { Wordmark } from "@/components/wordmark";
import { CoheGenLink } from "@/components/cohegen-link";

type Props = {
  active: NavKey;
  /** Shown in the phone header and the laptop rail. */
  rail?: ReactNode;
  children: ReactNode;
};

/**
 * The frame around every signed-in screen: a left rail on laptops, a bottom
 * bar on phones. The rail's middle section is up to the page.
 */
export function AppShell({ active, rail, children }: Props) {
  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-68 shrink-0 flex-col gap-5 border-r-2 border-tan bg-card px-4 py-6 md:flex">
        <Wordmark size="md" />
        <CoheGenLink />
        <Link href={`/chats/${crypto.randomUUID()}`}>
          <Button size="md" icon={<PlusIcon size={18} />} className="w-full">
            New chat
          </Button>
        </Link>
        <SideNav active={active} />
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">{rail}</div>
        <SignOutButton />
      </aside>
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between px-5 pt-11 pb-2 md:hidden">
          <div className="flex flex-col">
            <Wordmark size="sm" />
            <CoheGenLink />
          </div>
          <Link href={`/chats/${crypto.randomUUID()}`} aria-label="New chat">
            <Button size="sm" icon={<PlusIcon size={16} />}>
              New
            </Button>
          </Link>
        </header>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        <InstallHint />
        <div className="md:hidden">
          <BottomNav active={active} />
        </div>
      </div>
    </div>
  );
}
