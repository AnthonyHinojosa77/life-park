"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChalkOutline } from "@/components/ui/chalk";
import { connectGoogle } from "@/lib/connect-google";
import { googleServices, type GoogleServiceId } from "@/lib/google/services";
import { countByKind, type ThingKind } from "@/lib/kinds";
import { countLabel, nextZone, progress, zones, type WorldShape, type Zone } from "@/lib/park/layout";
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

/** Wide map on laptops, tall map on phones. The server always draws the tall one first. */
const WIDE = "(min-width: 900px)";
function subscribeWide(onChange: () => void) {
  const mq = window.matchMedia(WIDE);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
function useShape(): WorldShape {
  const wide = useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE).matches,
    () => false,
  );
  return wide ? "wide" : "tall";
}

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

export function ParkView({ name, initialThings, pending, connected, googleAvailable, connectFailed }: Props) {
  const router = useRouter();
  const shape = useShape();
  const [things, setThings] = useState(initialThings);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [mode, setMode] = useState<"map" | "list">("map");
  const [lawn, setLawn] = useState<ThingKind | null>(null);
  const [thing, setThing] = useState<ParkThing | null>(null);
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
  const since = things.length ? new Date(things[0].createdAt) : null;

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

  function openLawn(kind: ThingKind) {
    setThing(null);
    setLawn(kind);
    requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }

  function emptyAction(z: Zone) {
    if (z.kind === "mail" || z.kind === "file") return googleAvailable ? () => void connect() : null;
    return () => router.push(chatWith(z.starter));
  }

  const lawnList = lawn ? [...things.filter((t) => t.kind === lawn)].reverse() : [];
  const first = name.split(" ")[0] || "Your";

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pt-2 pb-8 min-[900px]:max-w-5xl md:py-8">
      <header className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div className="flex flex-col">
          <h1 className="font-serif text-3xl">{first === "Your" ? "Your park" : `${first}'s park`}</h1>
          <p className="text-xs font-bold text-muted">
            {grown} of {total} lawns growing · {things.length} {things.length === 1 ? "thing" : "things"}
            {since && ` · growing since ${since.toLocaleDateString(undefined, { month: "long", day: "numeric" })}`}
          </p>
        </div>
        <div role="radiogroup" aria-label="Show park as" className="flex rounded-pill border-2 border-tan bg-card p-0.5">
          {(["map", "list"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              className={`rounded-pill px-3.5 py-1 text-xs font-extrabold ${mode === m ? "bg-ink text-paper" : "text-ink-soft"}`}
            >
              {m === "map" ? "Map" : "List"}
            </button>
          ))}
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

      {mode === "map" ? (
        <div className="relative">
          <ParkMap
            things={things}
            now={now}
            shape={shape}
            selectedLawn={lawn}
            selectedThing={thing?.id ?? null}
            onSelectLawn={openLawn}
            onSelectThing={(t) => {
              setThing(t);
              setLawn(null);
            }}
            emptyAction={emptyAction}
          />
          {thing && (
            <section
              aria-label={thing.title}
              className="absolute bottom-3 left-3 flex w-64 max-w-[calc(100%-5rem)] flex-col gap-1.5 rounded-card border-2 border-ink bg-card px-4 py-3"
            >
              <h2 className="font-serif text-xl leading-tight">{thing.title}</h2>
              <span className="self-start rounded-chip bg-sun px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-sun-ink uppercase">
                {zoneOf(thing.kind).name}
              </span>
              {describe(thing) && <p className="text-xs font-semibold text-ink-soft">{describe(thing)}</p>}
              <p className="text-xs font-semibold text-muted">Planted {sourceNames[thing.source] ?? ""}</p>
              <div className="mt-1 flex gap-2">
                <Button size="sm" onClick={() => router.push(chatWith(`Tell me about ${thing.title}: `))}>
                  Ask LifePark
                </Button>
                <Button size="sm" variant="soft" onClick={() => setThing(null)}>
                  Close
                </Button>
              </div>
            </section>
          )}
        </div>
      ) : (
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
      )}

      {connectError && (
        <p role="alert" className="rounded-chip bg-sun px-3 py-2 text-sm font-bold">
          {connectError}
        </p>
      )}

      {lawn && mode === "map" && (
        <section ref={panelRef} className="relative isolate flex flex-col gap-2 rounded-card px-4 py-4" aria-label={zoneOf(lawn).name}>
          <ChalkOutline radius={22} />
          <div className="flex items-center justify-between">
            <h2 className="font-hand text-xl">
              {zoneOf(lawn).name} · {countLabel(zoneOf(lawn), lawnList.length)}
            </h2>
            <Button variant="ghost" size="sm" onClick={() => setLawn(null)}>
              Close
            </Button>
          </div>
          <ul className="flex max-h-96 flex-col divide-y-2 divide-tan overflow-y-auto">
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
        </section>
      )}

      <div className="flex flex-col gap-4 min-[900px]:flex-row">
        {googleAvailable && connected.length === 0 && (
          <section className="relative isolate flex flex-1 flex-col gap-2 rounded-card px-4 py-4">
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
          <section className="relative isolate flex flex-1 items-center justify-between gap-3 rounded-card px-4 py-4">
            <ChalkOutline radius={22} />
            <div className="flex flex-col">
              <span className="text-xs font-extrabold tracking-wide text-muted uppercase">Next for your park</span>
              <span className="font-hand text-xl">{next.sign}</span>
            </div>
            <Button onClick={() => router.push(chatWith(next.starter))}>Tell LifePark</Button>
          </section>
        )}
      </div>

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
