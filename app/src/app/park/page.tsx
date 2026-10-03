import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { ParkView } from "@/components/park/park-view";
import { configuredProviders } from "@/lib/auth-providers";
import { githubAvailable } from "@/lib/github/app";
import { connectedServices, ON_OPEN_AGE_MS, servicesDue } from "@/lib/refresh";
import { requireOnboarded } from "@/lib/session";
import { listParkThings } from "@/lib/things";

export const metadata: Metadata = { title: "Park" };

export default async function ParkPage({ searchParams }: PageProps<"/park">) {
  const { session } = await requireOnboarded();
  const { connect, github } = await searchParams;
  const userId = session.user.id;
  const [things, connected, due] = await Promise.all([
    listParkThings(userId),
    connectedServices(userId),
    servicesDue(userId, new Date(), ON_OPEN_AGE_MS),
  ]);

  return (
    <AppShell active="park">
      <ParkView
        name={session.user.name}
        initialThings={things}
        pending={due.fresh}
        stale={due.stale}
        connected={connected}
        googleAvailable={configuredProviders().includes("google")}
        connectFailed={connect === "failed"}
        githubAvailable={githubAvailable()}
        githubNotice={github === "failed" ? "GitHub didn't connect. You can try again any time." : github === "unavailable" ? "GitHub isn't set up on LifePark yet." : null}
      />
    </AppShell>
  );
}
