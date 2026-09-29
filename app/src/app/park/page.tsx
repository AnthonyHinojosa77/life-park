import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { ParkView } from "@/components/park/park-view";
import { configuredProviders } from "@/lib/auth-providers";
import { googleGrants } from "@/lib/google/import";
import { ON_OPEN_AGE_MS, servicesDue } from "@/lib/refresh";
import { requireOnboarded } from "@/lib/session";
import { listParkThings } from "@/lib/things";

export const metadata: Metadata = { title: "Park" };

export default async function ParkPage({ searchParams }: PageProps<"/park">) {
  const { session } = await requireOnboarded();
  const { connect } = await searchParams;
  const userId = session.user.id;
  const [things, grants, due] = await Promise.all([
    listParkThings(userId),
    googleGrants(userId),
    servicesDue(userId, new Date(), ON_OPEN_AGE_MS),
  ]);
  const connected = grants ?? [];

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
      />
    </AppShell>
  );
}
