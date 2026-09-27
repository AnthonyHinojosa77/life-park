"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChalkFill, ChalkOutline, chalk } from "@/components/ui/chalk";
import { connectGoogle } from "@/lib/connect-google";
import { countByKind, type ThingKind } from "@/lib/kinds";
import { googleServices, type GoogleServiceId } from "@/lib/google/services";
import { countLabel, nextZone, progress, zones, type Zone } from "@/lib/park/layout";
import type { ParkThing } from "@/lib/things";
import { ParkMap } from "./park-map";

type Props = {
  name: string;
  initialThings: ParkThing[];
  /** Connected services not imported yet; imported as soon as the park opens. */
  pending: GoogleServiceId[];
  /** Every Google service the person allowed. */
  connected: GoogleServiceId[];
  /** Whether Google sign-in is set up on this site at all. */
  googleAvailable: boolean;
  /** Set when the person just came back from Google without allowing access. */
  connectFailed?: boolean;
};

type Status = { service: GoogleServiceId; state: "waiting" | "working" | "done" | "error"; count?: number; error?: string };

const serviceName = (id: GoogleServiceId) => googleServices.find((s) => s.id === id)?.label ?? id;
const zoneOf = (kind: ThingKind) => zones.find((z) => z.kind === kind)!;
// A new chat id is made at the moment of the tap, so server and phone always agree on the page.
const chatWith = (starter: string) => `/chats/${crypto.randomUUID()}?prompt=${encodeURIComponent(starter)}`;

function describe(t: ParkThing) {
  const bits: string[] = [];
  if (t.date) {
    const d = new Date(t.date);
    bits.push(d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric" }));
  }
  const b = t.detail.birthday as { month: number; day: number } | null | undefined;
  if (b) bits.push(`Birthday ${new Date(2000, b.month - 1, b.day).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`);
  if (typeof t.detail.from === "string") bits.push(`From ${t.detail.from}`);
  if (typeof t.detail.location === "string") bits.push(t.detail.location);
  if (Array.isArray(t.detail.items)) bits.push(`${t.detail.items.length} items`);
  if (t.detail.type === "doc") bits.push("Google Doc");
  if (t.detail.type === "sheet") bits.push("Google Sheet");
  return bits.join(" · ");
}

export function ParkView({ name, initialThings, pending, connected, googleAvailable, connectFailed }: Props) {
  const router = useRouter();
  const [things, setThings] = useState(initialThings);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [selected, setSelected] = useState<ThingKind | null>(null);
  const [connectError, setConnectError] = useState<string | null>(
    connectFailed ? "Google didn't connect. You can try again any time." : null,
  );
  const [now] = useState(() => Date.now());
  const started = useRef(false);
  const panelRef = useRef<HTMLElement>(null);

  const counts = useMemo(() => countByKind(things), [things]);
  const { grown, total } = progress(counts);
  const next = nextZone(counts);
  const importing = statuses.some((s) => s.state === "waiting" || s.state === "working");

  async function runImports(services: GoogleServiceId[]) {
    setStatuses(services.map((service) => ({ service, state: "waiting" })));
    for (const service of services) {
      setStatuses((all) => all.map((s) => (s.service === service ? { ...s, state: "working" } : s)));
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ service }),
      }).catch(() => null);
      const body = (await res?.json().catch(() => null)) as { count?: number; error?: string } | null;
      const failed = !res || !res.ok || body?.error;
      setStatuses((all) =>
        all.map((s) =>
          s.service === service
            ? failed
              ? { ...s, state: "error", error: body?.error ?? "Couldn't reach LifePark. Try again." }
              : { ...s, state: "done", count: body?.count ?? 0 }
            : s,
        ),
      );
      // Redraw after each service so the park visibly fills in as things arrive.
      const park = await fetch("/api/park").then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (park?.things) setThings(park.things);
    }
  }

  useEffect(() => {
    if (started.current || pending.length === 0) return;
    started.current = true;
    // Kicks off the first import on arrival; the state updates happen as each one finishes.
    void runImports(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function connect() {
    setConnectError(null);
    try {
      await connectGoogle(googleServices.map((s) => s.id));
    } catch (error) {
      setConnectError(error instanceof Error ? error.message : "Couldn't reach Google.");
    }
  }

  function select(kind: ThingKind) {
    setSelected(kind);
    requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function emptyAction(z: Zone) {
    if (z.kind === "mail" || z.kind === "file") {
      if (!googleAvailable) return null;
      return { onClick: () => void connect() };
    }
    return { onClick: () => router.push(chatWith(z.starter)) };
  }

  const selectedList = selected ? [...things.filter((t) => t.kind === selected)].reverse() : [];
  const first = name.split(" ")[0] || "Your";

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pt-2 pb-8 md:py-8">
      <header className="flex flex-col gap-2 px-1">
        <h1 className="font-serif text-3xl">{first === "Your" ? "Your park" : `${first}'s park`}</h1>
        <div className="flex items-center gap-3">
          <div className="relative isolate h-3 flex-1 overflow-hidden rounded-pill bg-tan" aria-hidden="true">
            <div className="relative isolate h-full transition-[width] duration-700" style={{ width: `${(grown / total) * 100}%` }}>
              <ChalkFill color={chalk.grass} radius={999} solid />
            </div>
          </div>
          <p className="font-hand text-base text-ink-soft">
            {grown} of {total} areas growing
          </p>
        </div>
      </header>

      {statuses.length > 0 && (
        <section aria-live="polite" className="relative isolate flex flex-col gap-1 rounded-card px-4 py-3">
          <ChalkOutline radius={22} />
          <p className="font-hand text-lg">{importing ? "Building your park…" : "Your park is ready."}</p>
          <ul className="flex flex-col gap-0.5 text-sm font-semibold text-ink-soft">
            {statuses.map((s) => (
              <li key={s.service}>
                {s.state === "waiting" && `Waiting: ${serviceName(s.service)}`}
                {s.state === "working" && `Bringing in ${serviceName(s.service)}…`}
                {s.state === "done" && `✓ ${serviceName(s.service)}: ${s.count} added`}
                {s.state === "error" && `${serviceName(s.service)}: ${s.error}`}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="relative">
        <ParkMap things={things} now={now} onSelect={select} emptyAction={emptyAction} />
      </div>

      {connectError && (
        <p role="alert" className="rounded-chip bg-sun px-3 py-2 text-sm font-bold">
          {connectError}
        </p>
      )}

      {googleAvailable && connected.length === 0 && (
        <section className="relative isolate flex flex-col gap-2 rounded-card px-4 py-4">
          <ChalkOutline radius={22} />
          <h2 className="font-hand text-xl">Fill your park in seconds</h2>
          <p className="text-sm font-semibold text-ink-soft">
            Connect Google and your events, people, lists, mail, and files move in right away.
          </p>
          <Button onClick={() => void connect()} className="self-start">
            Connect Google
          </Button>
        </section>
      )}

      {next && !importing && (
        <section className="relative isolate flex items-center justify-between gap-3 rounded-card px-4 py-4">
          <ChalkOutline radius={22} />
          <div className="flex flex-col">
            <span className="text-xs font-extrabold tracking-wide text-muted uppercase">Next for your park</span>
            <span className="font-hand text-xl">{next.sign}</span>
          </div>
          <Button onClick={() => router.push(chatWith(next.starter))}>Tell LifePark</Button>
        </section>
      )}

      {selected && (
        <section ref={panelRef} className="relative isolate flex flex-col gap-2 rounded-card px-4 py-4" aria-label={zoneOf(selected).name}>
          <ChalkOutline radius={22} />
          <div className="flex items-center justify-between">
            <h2 className="font-hand text-xl">
              {zoneOf(selected).name} · {countLabel(zoneOf(selected), selectedList.length)}
            </h2>
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
              Close
            </Button>
          </div>
          <ul className="flex max-h-96 flex-col divide-y-2 divide-tan overflow-y-auto">
            {selectedList.map((t) => (
              <li key={t.id} className="flex flex-col py-2">
                <span className="font-semibold">{t.title}</span>
                {describe(t) && <span className="text-sm text-muted">{describe(t)}</span>}
              </li>
            ))}
          </ul>
          <Button variant="soft" size="sm" className="self-start" onClick={() => router.push(chatWith(zoneOf(selected).starter))}>
            Add another
          </Button>
        </section>
      )}

      {connected.length > 0 && !importing && (
        <button
          type="button"
          onClick={() => void runImports(connected)}
          className="self-center font-serif text-sm italic text-muted underline"
        >
          Refresh from Google
        </button>
      )}
    </main>
  );
}
