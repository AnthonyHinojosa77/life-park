"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChalkOutline } from "@/components/ui/chalk";
import { ParkIcon } from "@/components/ui/icons";
import { connectGoogle } from "@/lib/connect-google";
import { googleServices, type GoogleServiceId } from "@/lib/google/services";
import { countByKind, type ThingKind } from "@/lib/kinds";
import { countLabel, nextZone, progress, zones, type Zone } from "@/lib/park/layout";
import type { ParkThing } from "@/lib/things";
import { ParkMap, type ParkMapHandle } from "./park-map";

type Props = {
  name: string;
  initialThings: ParkThing[];
  /** Connected services not imported yet; imported as soon as the park opens. */
  pending: GoogleServiceId[];
  /** Connected services last brought in over 12 hours ago; refreshed quietly in the background. */
  stale?: GoogleServiceId[];
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
/** The lawn each Google service fills. */
const lawnFor: Record<GoogleServiceId, ThingKind> = {
  calendar: "event",
  contacts: "person",
  tasks: "list",
  gmail: "mail",
  drive: "file",
  docs: "file",
  sheets: "file",
};
// A new chat id is made at the moment of the tap, so server and phone always agree on the page.
const chatWith = (starter: string) => `/chats/${crypto.randomUUID()}?prompt=${encodeURIComponent(starter)}`;

function describe(t: ParkThing) {
  const bits: string[] = [];
  if (t.date) {
    const d = new Date(t.date);
    bits.push(
      d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
      }),
    );
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

const sourceNames: Record<string, string> = {
  chat: "from chat",
  calendar: "from Google Calendar",
  contacts: "from Google Contacts",
  tasks: "from Google Tasks",
  gmail: "from Gmail",
  drive: "from My Drive",
  docs: "from Google Docs",
  sheets: "from Google Sheets",
};

/** A floating panel over the map, drawn in the crayon look. */
function Float({ className = "", children, label }: { className?: string; children: React.ReactNode; label?: string }) {
  return (
    <section aria-label={label} className={`pointer-events-auto relative isolate rounded-card bg-card/95 ${className}`}>
      <ChalkOutline radius={22} />
      {children}
    </section>
  );
}

export function ParkView({ name, initialThings, pending, stale = [], connected, googleAvailable, connectFailed }: Props) {
  const router = useRouter();
  const mapRef = useRef<ParkMapHandle>(null);
  const [things, setThings] = useState(initialThings);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [showStatus, setShowStatus] = useState(true);
  const [mode, setMode] = useState<"map" | "list">("map");
  const [lawn, setLawn] = useState<ThingKind | null>(null);
  const [thing, setThing] = useState<ParkThing | null>(null);
  const [here, setHere] = useState<ThingKind | null>(null);
  const [connectError, setConnectError] = useState<string | null>(
    connectFailed ? "Google didn't connect. You can try again any time." : null,
  );
  const [now] = useState(() => Date.now());
  const started = useRef(false);

  const counts = useMemo(() => countByKind(things), [things]);
  const { grown, total } = progress(counts);
  const next = nextZone(counts);
  const importing = statuses.some((s) => s.state === "waiting" || s.state === "working");
  // Open on the first lawn with something on it, so there is always something to see.
  const [startAt] = useState<ThingKind>(() => zones.find((z) => counts[z.kind] > 0)?.kind ?? "person");

  async function runImports(services: GoogleServiceId[]) {
    setShowStatus(true);
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
      // Redraw after each service, and fly to the lawn that just filled, so you watch things move in.
      const park = await fetch("/api/park").then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (park?.things) setThings(park.things);
      if (!failed && (body?.count ?? 0) > 0) mapRef.current?.flyTo(lawnFor[service]);
    }
  }

  /** Brings overdue services up to date without any panel; the park just updates. */
  async function refreshQuietly(services: GoogleServiceId[]) {
    for (const service of services) {
      await fetch("/api/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ service }),
      }).catch(() => null);
    }
    const park = await fetch("/api/park").then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (park?.things) setThings(park.things);
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    // New connections import visibly on arrival; overdue ones refresh quietly after.
    void (async () => {
      if (pending.length) await runImports(pending);
      if (stale.length) await refreshQuietly(stale);
    })();
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

  function go(kind: ThingKind) {
    setThing(null);
    setLawn(null);
    mapRef.current?.flyTo(kind);
  }

  function emptyAction(z: Zone) {
    if (z.kind === "mail" || z.kind === "file") return googleAvailable ? () => void connect() : null;
    return () => router.push(chatWith(z.starter));
  }

  const onCenterLawn = useCallback((kind: ThingKind) => setHere(kind), []);
  const lawnList = lawn ? [...things.filter((t) => t.kind === lawn)].reverse() : [];
  const first = name.split(" ")[0] || "Your";
  const title = first === "Your" ? "Your park" : `${first}'s park`;

  const header = (
    <div className="pointer-events-auto flex items-start justify-between gap-2">
      <Float className="px-4 py-2.5">
        <h1 className="font-serif text-2xl leading-none">{title}</h1>
        <p className="mt-1 text-xs font-bold text-muted">
          {grown} of {total} lawns growing · {things.length} {things.length === 1 ? "thing" : "things"}
        </p>
      </Float>
      <div role="radiogroup" aria-label="Show park as" className="flex rounded-pill border-2 border-ink bg-card p-0.5">
        {(["map", "list"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => setMode(m)}
            className={`rounded-pill px-3.5 py-1.5 text-xs font-extrabold ${mode === m ? "bg-ink text-paper" : "text-ink-soft"}`}
          >
            {m === "map" ? "Map" : "List"}
          </button>
        ))}
      </div>
    </div>
  );

  const statusPanel = statuses.length > 0 && showStatus && (
    <Float label="Park building" className="px-4 py-3">
      <div aria-live="polite" className="flex items-start justify-between gap-3">
        <div>
          <p className="font-hand text-lg">{importing ? "Building your park…" : "Your park is ready."}</p>
          <ul className="flex flex-col gap-0.5 text-xs font-semibold text-ink-soft">
            {statuses.map((s) => (
              <li key={s.service}>
                {s.state === "waiting" && `Waiting: ${serviceName(s.service)}`}
                {s.state === "working" && `Bringing in ${serviceName(s.service)}…`}
                {s.state === "done" && `✓ ${serviceName(s.service)}: ${s.count} added`}
                {s.state === "error" && `${serviceName(s.service)}: ${s.error}`}
              </li>
            ))}
          </ul>
        </div>
        {!importing && (
          <button type="button" onClick={() => setShowStatus(false)} aria-label="Dismiss" className="text-lg font-bold text-muted">
            ×
          </button>
        )}
      </div>
    </Float>
  );

  if (mode === "list") {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 pt-2 pb-8 md:py-8">
        {header}
        {statusPanel}
        <section aria-label="Everything in your park" className="flex flex-col gap-3">
          {zones
            .filter((z) => counts[z.kind] > 0)
            .map((z) => (
              <div key={z.kind} className="relative isolate flex flex-col gap-1 rounded-card px-4 py-3">
                <ChalkOutline radius={22} />
                <h2 className="font-hand text-xl">
                  {z.name} · {countLabel(z, counts[z.kind])}
                </h2>
                <ul className="flex flex-col divide-y-2 divide-tan">
                  {[...things.filter((t) => t.kind === z.kind)].reverse().map((t) => (
                    <li key={t.id} className="flex flex-col py-1.5">
                      <span className="font-semibold">{t.title}</span>
                      {describe(t) && <span className="text-sm text-muted">{describe(t)}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          {things.length === 0 && <p className="px-1 text-sm font-semibold text-muted">Nothing planted yet.</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="relative min-h-[440px] flex-1 overflow-hidden">
      <ParkMap
        ref={mapRef}
        things={things}
        now={now}
        startAt={startAt}
        selectedLawn={lawn}
        selectedThing={thing?.id ?? null}
        onSelectLawn={(kind) => {
          setThing(null);
          setLawn(kind);
        }}
        onSelectThing={(t) => {
          setLawn(null);
          setThing(t);
        }}
        emptyAction={emptyAction}
        onCenterLawn={onCenterLawn}
      />

      {/* Everything floating over the map. Gaps between panels let touches reach the map. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-2 p-3">
        {header}
        <nav aria-label="Lawns" className="pointer-events-auto -mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none]">
          {zones.map((z) => (
            <button
              key={z.kind}
              type="button"
              aria-label={`Go to ${z.name}`}
              aria-current={here === z.kind ? "location" : undefined}
              onClick={() => go(z.kind)}
              className={`flex shrink-0 items-center gap-1.5 rounded-pill border-2 px-3 py-1.5 text-xs font-extrabold whitespace-nowrap ${
                here === z.kind ? "border-ink bg-ink text-paper" : "border-ink/70 bg-card text-ink"
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-full border border-ink" style={{ background: z.accent }} aria-hidden="true" />
              {z.name}
              {counts[z.kind] > 0 && <span className={here === z.kind ? "text-paper/80" : "text-muted"}>{counts[z.kind]}</span>}
            </button>
          ))}
        </nav>
        {statusPanel && <div className="max-w-sm">{statusPanel}</div>}
        {connectError && (
          <p role="alert" className="pointer-events-auto max-w-sm rounded-chip border-2 border-ink bg-sun px-3 py-2 text-sm font-bold">
            {connectError}
          </p>
        )}
      </div>

      <div className="absolute top-1/2 right-3 flex -translate-y-1/2 flex-col gap-2">
        <div className="flex flex-col overflow-hidden rounded-chip border-2 border-ink bg-card">
          <button type="button" aria-label="Zoom in" onClick={() => mapRef.current?.zoomBy(1.6)} className="px-3 py-1.5 text-xl leading-none font-bold">
            +
          </button>
          <span className="h-0.5 bg-ink" />
          <button type="button" aria-label="Zoom out" onClick={() => mapRef.current?.zoomBy(1 / 1.6)} className="px-3 py-1.5 text-xl leading-none font-bold">
            −
          </button>
        </div>
        <button
          type="button"
          aria-label="Show the whole park"
          onClick={() => mapRef.current?.overview()}
          className="flex items-center justify-center rounded-chip border-2 border-ink bg-card p-2"
        >
          <ParkIcon size={20} />
        </button>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-start gap-2 p-3">
        {thing ? (
          <Float label={thing.title} className="flex w-full max-w-sm flex-col gap-1.5 px-4 py-3">
            <h2 className="font-serif text-2xl leading-tight">{thing.title}</h2>
            <span className="self-start rounded-chip bg-sun px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-sun-ink uppercase">
              {zoneOf(thing.kind).name}
            </span>
            {describe(thing) && <p className="text-sm font-semibold text-ink-soft">{describe(thing)}</p>}
            <p className="text-xs font-semibold text-muted">Planted {sourceNames[thing.source] ?? ""}</p>
            <div className="mt-1 flex gap-2">
              <Button size="sm" onClick={() => router.push(chatWith(`Tell me about ${thing.title}: `))}>
                Ask LifePark
              </Button>
              <Button size="sm" variant="soft" onClick={() => setThing(null)}>
                Close
              </Button>
            </div>
          </Float>
        ) : lawn ? (
          <Float label={zoneOf(lawn).name} className="flex max-h-[45dvh] w-full max-w-sm flex-col gap-2 px-4 py-3">
            <div className="flex items-center justify-between">
              <h2 className="font-hand text-xl">
                {zoneOf(lawn).name} · {countLabel(zoneOf(lawn), lawnList.length)}
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setLawn(null)}>
                Close
              </Button>
            </div>
            <ul className="flex min-h-0 flex-col divide-y-2 divide-tan overflow-y-auto">
              {lawnList.map((t) => (
                <li key={t.id} className="flex flex-col py-2">
                  <span className="font-semibold">{t.title}</span>
                  {describe(t) && <span className="text-sm text-muted">{describe(t)}</span>}
                </li>
              ))}
            </ul>
            <Button variant="soft" size="sm" className="self-start" onClick={() => router.push(chatWith(zoneOf(lawn).starter))}>
              Add another
            </Button>
          </Float>
        ) : (
          <>
            {googleAvailable && connected.length === 0 && (
              <Float className="flex w-full max-w-sm items-center justify-between gap-3 px-4 py-3">
                <div className="flex flex-col">
                  <span className="font-hand text-lg leading-tight">Fill your park in seconds</span>
                  <span className="text-xs font-semibold text-ink-soft">Connect Google to move your life in.</span>
                </div>
                <Button size="sm" onClick={() => void connect()}>
                  Connect Google
                </Button>
              </Float>
            )}
            {next && !importing && (
              <Float className="flex w-full max-w-sm items-center justify-between gap-3 px-4 py-3">
                <div className="flex flex-col">
                  <span className="text-[10px] font-extrabold tracking-wide text-muted uppercase">Next for your park</span>
                  <span className="font-hand text-lg leading-tight">{next.sign}</span>
                </div>
                <Button size="sm" onClick={() => router.push(chatWith(next.starter))}>
                  Tell LifePark
                </Button>
              </Float>
            )}
            {connected.length > 0 && !importing && (
              <button
                type="button"
                onClick={() => void runImports(connected)}
                className="pointer-events-auto rounded-pill border-2 border-ink/60 bg-card px-3 py-1 font-serif text-xs italic text-ink-soft"
              >
                Refresh from Google
              </button>
            )}
          </>
        )}
      </div>
    </main>
  );
}
