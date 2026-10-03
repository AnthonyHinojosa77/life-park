"use client";

import { useTransition } from "react";
import { disconnectGitHubAction } from "@/app/settings/actions";
import { Button } from "@/components/ui/button";
import { connectGitHub } from "@/lib/connect-github";

type Props = {
  available: boolean;
  /** The GitHub accounts LifePark is installed on, empty when not connected. */
  accounts: string[];
  repoCount: number;
};

/** Connects GitHub so repositories fill the Workshop, or disconnects it. */
export function GitHubConnection({ available, accounts, repoCount }: Props) {
  const [pending, start] = useTransition();
  if (!available) {
    return <p className="text-sm font-semibold text-muted">GitHub isn&apos;t set up on LifePark yet.</p>;
  }
  if (!accounts.length) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-ink-soft">
          Bring your repositories into the Workshop. LifePark asks GitHub for read-only access, and you choose which repositories it can see.
        </p>
        <Button size="sm" className="self-start" onClick={connectGitHub}>
          Connect GitHub
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-ink-soft">
        Connected to {accounts.join(", ")} · {repoCount} {repoCount === 1 ? "repository" : "repositories"} in the Workshop.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="soft" onClick={connectGitHub}>
          Change repositories
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => start(async () => void (await disconnectGitHubAction()))}
        >
          {pending ? "Disconnecting" : "Disconnect"}
        </Button>
      </div>
      <p className="text-xs font-semibold text-muted">
        To remove LifePark from GitHub entirely, uninstall it under GitHub Settings → Applications.
      </p>
    </div>
  );
}
