import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Preferences } from "@/components/settings/preferences";
import { RulesEditor } from "@/components/settings/rules-editor";
import { isOwner } from "@/lib/owner";
import { getRules } from "@/lib/rules";
import { requireOnboarded } from "@/lib/session";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { session, settings } = await requireOnboarded();
  const rules = await getRules(session.user.id);
  const owner = isOwner(session.user.email);

  return (
    <AppShell active="settings">
      <main className="flex flex-col gap-10 px-5 py-4 md:mx-auto md:w-full md:max-w-3xl md:py-10">
        <h1 className="font-serif text-3xl">Settings</h1>

        <section className="flex flex-col gap-4">
          <h2 className="font-serif text-2xl">Preferences</h2>
          <Preferences
            navigation={settings.navigation}
            voice={settings.voice}
          />
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="font-serif text-2xl">Rules</h2>
          <p className="text-sm font-semibold text-ink-soft">
            Sent to every model with every message. Edit here, or keep it identical to the
            repository&apos;s AGENTS.md.
          </p>
          <RulesEditor
            content={rules.content}
            edited={rules.edited}
            updatedAt={rules.updatedAt ? rules.updatedAt.toLocaleString("en-US", { timeZone: "UTC" }) : null}
          />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-serif text-2xl">Account</h2>
          <p className="text-sm font-semibold text-ink-soft">
            Signed in as {session.user.email}.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <SignOutButton />
            {owner && (
              <Link href="/owner" className="text-sm font-extrabold underline">
                Owner dashboard
              </Link>
            )}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
