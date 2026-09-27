import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { ParkView } from "@/components/park/park-view";
import { configuredProviders } from "@/lib/auth-providers";
import { googleGrants } from "@/lib/google/import";
import { requireOnboarded } from "@/lib/session";
import { listConnections, listParkThings } from "@/lib/things";

export const metadata: Metadata = { title: "Park" };

export default async function ParkPage({ searchParams }: PageProps<"/park">) {
  const { session } = await requireOnboarded();
  const { connect } = await searchParams;
  const userId = session.user.id;
  const [things, grants, connections] = await Promise.all([
    listParkThings(userId),
    googleGrants(userId),
    listConnections(userId),
  ]);
  const connected = grants ?? [];
  // Anything allowed but not yet brought in successfully is imported as soon as the park opens.
  const pending = connected.filter(
    (s) => !connections.some((c) => c.service === s && c.status === "connected"),
  );

  return (
    <AppShell active="park">
      <ParkView
        name={session.user.name}
        initialThings={things}
        pending={pending}
        connected={connected}
        googleAvailable={configuredProviders().includes("google")}
        connectFailed={connect === "failed"}
      />
    </AppShell>
  );
}
