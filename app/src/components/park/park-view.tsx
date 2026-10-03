"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChalkOutline } from "@/components/ui/chalk";
import { ParkIcon } from "@/components/ui/icons";
import { connectGitHub } from "@/lib/connect-github";
import { connectGoogle } from "@/lib/connect-google";
import { googleServices } from "@/lib/google/services";
import { lawnFor, serviceName, type ImportService } from "@/lib/import-services";
import { countByKind, type ThingKind } from "@/lib/kinds";
import { groupThings, type Group } from "@/lib/park/groups";
import { countLabel, nextZone, progress, zones, type Zone } from "@/lib/park/layout";
import type { ParkThing } from "@/lib/things";
import { ParkMap, type Insets, type ParkMapHandle } from "./park-map";

type Props = {
  name: string;
  initialThings: ParkThing[];
  /** Connected services not imported yet; imported as soon as the park opens. */
  pending: ImportService[];
  /** Connected services last brought in over 12 hours ago; refreshed quietly in the background. */
  stale?: ImportService[];
  /** Every Google service the person allowed. */
  connected: ImportService[];
  /** Whether Google sign-in is set up on this site at all. */
  googleAvailable: boolean;
  /** Set when the person just came back from Google without allowing access. */
  connectFailed?: boolean;
  /** Whether GitHub is set up on this site at all. */
  githubAvailable?: boolean;
  /** Set when the person just came back from GitHub and it didn't work. */
  githubNotice?: string | null;
};

type Status = { service: ImportService; state: "waiting" | "working" | "done" | "error"; count?: number; error?: string };

const zoneOf = (kind: ThingKind) => zones.find((z) => z.kind === kind)!;
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
  if (t.kind === "repo") {
    if (typeof t.detail.language === "string") bits.push(t.detail.language);
    if (t.detail.private === true) bits.push("Private");
    if (t.detail.archived === true) bits.push("Archived");
    if (typeof t.detail.stars === "number" && t.detail.stars > 0) bits.push(`★ ${t.detail.stars}`);
    if (typeof t.detail.description === "string") bits.push(t.detail.description);
  }
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
  github: "from GitHub",
};

/** One chip for every small choice over the map: a lawn to jump to, a category, a quick action. */
function Chip({
  accent,
  count,
  on = false,
  here = false,
  className = "",
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { accent?: string; count?: number; on?: boolean; here?: boolean }) {
  const look = on ? "border-ink bg-ink text-paper" : here ? "border-ink bg-sun text-ink" : "border-ink/70 bg-card text-ink";
  return (
    <button type="button" className={`pointer-events-auto flex shrink-0 items-center gap-1.5 rounded-pill border-2 px-3 py-1.5 text-xs font-extrabold whitespace-nowrap ${look} ${className}`} {...rest}>
      {accent && <span className={`h-2.5 w-2.5 rounded-full border ${on ? "border-paper" : "border-ink"}`} style={{ background: accent }} aria-hidden="true" />}
      {children}
      {count !== undefined && <span className={on ? "text-paper/80" : "text-muted"}>{count}</span>}
    </button>
  );
}

/** Marks a scrolling row while more of it lies to the right, so its edge fades only then. */
function moreToScroll(el: HTMLElement | null) {
  if (!el) return;
  el.dataset.more = el.scrollLeft + el.clientWidth < el.scrollWidth - 2 ? "1" : "0";
}

/** A floating panel over the map, drawn in the crayon look. */
function Float({ className = "", children, label }: { className?: string; children: React.ReactNode; label?: string }) {
  return (
    <section aria-label={label} className={`pointer-events-auto relative isolate rounded-card bg-card ${className}`}>
      <ChalkOutline radius={22} />
      {children}
    </section>
  );
}

export function ParkView({ name, initialThings, pending, stale = [], connected, googleAvailable, connectFailed, githubAvailable = false, githubNotice = null }: Props) {
  const router = useRouter();
  const mapRef = useRef<ParkMapHandle>(null);
  const [things, setThings] = useState(initialThings);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [showStatus, setShowStatus] = useState(true);
  const [mode, setMode] = useState<"map" | "list">("map");
  // The lawn whose categories are showing on the map, and the category opened to show everything in it.
  const [openLawn, setOpenLawn] = useState<ThingKind | null>(null);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [thing, setThing] = useState<ParkThing | null>(null);
  const [here, setHere] = useState<ThingKind | null>(null);
  const [connectError, setConnectError] = useState<string | null>(
    connectFailed ? "Google didn't connect. You can try again any time." : githubNotice,
  );
  const [now] = useState(() => Date.now());
  const started = useRef(false);
  // How much of the map the floating panels cover, measured, so fitting never hides anything.
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const chipsRef = useRef<HTMLElement>(null);
  const [insets, setInsets] = useState<Insets>({ top: 124, bottom: 92, right: 0 });
  useEffect(() => {
    const measure = () => {
      const top = topRef.current?.getBoundingClientRect().height ?? 0;
      const bottom = bottomRef.current?.getBoundingClientRect().height ?? 0;
      // The zoom buttons hang on the right; on a phone they take a strip of the map.
      const right = window.innerWidth < 640 ? 64 : 0;
      setInsets((i) => (i.top === top && i.bottom === bottom && i.right === right ? i : { top, bottom, right }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (topRef.current) ro.observe(topRef.current);
    if (bottomRef.current) ro.observe(bottomRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const counts = useMemo(() => countByKind(things), [things]);
  const groups = useMemo(
    () => Object.fromEntries(zones.map((z) => [z.kind, groupThings(z.kind, things.filter((t) => t.kind === z.kind), now)])) as Record<ThingKind, Group[]>,
    [things, now],
  );
  const { grown, total } = progress(counts);
  const next = nextZone(counts);
  const importing = statuses.some((s) => s.state === "waiting" || s.state === "working");
  // Open on the first lawn with something on it, so there is always something to see.
  const [startAt] = useState<ThingKind>(() => zones.find((z) => counts[z.kind] > 0)?.kind ?? "person");

  async function runImports(services: ImportService[]) {
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
  async function refreshQuietly(services: ImportService[]) {
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

  /** A chip jump closes whatever is open and flies to the lawn. */
  function go(kind: ThingKind) {
    setThing(null);
    setOpenLawn(null);
    setOpenGroup(null);
    mapRef.current?.flyTo(kind, { closing: openLawn !== null });
  }

  /** Tapping a lawn opens its categories; tapping it again closes them. */
  function toggleLawn(kind: ThingKind) {
    setThing(null);
    setOpenGroup(null);
    setOpenLawn(openLawn === kind ? null : kind);
  }

  function toggleGroup(kind: ThingKind, id: string | null) {
    setThing(null);
    setOpenLawn(kind);
    setOpenGroup(id);
  }

  function emptyAction(z: Zone) {
    if (z.kind === "repo") return githubAvailable ? connectGitHub : null;
    if (z.kind === "mail" || z.kind === "file") return googleAvailable ? () => void connect() : null;
    return () => router.push(chatWith(z.starter));
  }

  const onCenterLawn = useCallback((kind: ThingKind) => setHere(kind), []);
  // The chip for the lawn under the camera stays in view as the map moves.
  useEffect(() => {
    if (!here || !chipsRef.current) return;
    chipsRef.current.querySelector<HTMLElement>(`[data-chip="${here}"]`)?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [here]);
  const lawn = openLawn;
  // The header chip points at the open lawn while one is open, else the lawn under the camera.
  const current = openLawn ?? here;
  const groupRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!openGroup || !groupRef.current) return;
    groupRef.current.querySelector<HTMLElement>(`[data-chip="${openGroup}"]`)?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [openGroup]);
  const lawnGroups = lawn ? groups[lawn] : [];
  const lawnCount = lawn ? counts[lawn] : 0;
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
        {connectError && (
          <p role="alert" className="rounded-chip border-2 border-ink bg-sun px-3 py-2 text-sm font-bold">
            {connectError}
          </p>
        )}
        <section aria-label="Everything in your park" className="flex flex-col gap-3">
          {zones
            .filter((z) => counts[z.kind] > 0)
            .map((z) => (
              <div key={z.kind} className="relative isolate flex flex-col gap-2 rounded-card px-4 py-3">
                <ChalkOutline radius={22} />
                <h2 className="font-serif text-2xl leading-tight">
                  {z.name} <span className="font-sans text-xs font-extrabold text-muted">{countLabel(z, counts[z.kind])}</span>
                </h2>
                {groups[z.kind].map((g) => (
                  <section key={g.id} aria-label={g.name}>
                    <h3 className="flex items-center gap-1.5 text-sm font-extrabold">
                      <span className="h-2.5 w-2.5 rounded-full border border-ink" style={{ background: z.accent }} aria-hidden="true" />
                      {g.name} <span className="text-muted">{g.things.length}</span>
                    </h3>
                    <ul className="flex flex-col divide-y-2 divide-tan">
                      {g.things.map((t) => (
                        <li key={t.id} className="flex flex-col py-1.5">
                          <span className="font-semibold">{t.title}</span>
                          {describe(t) && <span className="text-sm text-muted">{describe(t)}</span>}
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            ))}
          {things.length === 0 && (
            <div className="flex items-center justify-between gap-3 px-1">
              <p className="text-sm font-semibold text-muted">Nothing planted yet.</p>
              <Button size="sm" onClick={() => router.push(chatWith(zones[0].starter))}>
                Tell LifePark
              </Button>
            </div>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="relative min-h-[440px] flex-1 overflow-hidden">
      <ParkMap
        ref={mapRef}
        things={things}
        parkName={title}
        now={now}
        startAt={startAt}
        groups={groups}
        openLawn={openLawn}
        openGroup={openGroup}
        selectedThing={thing?.id ?? null}
        insets={insets}
        onSelectLawn={toggleLawn}
        onOpenGroup={toggleGroup}
        onSelectThing={setThing}
        emptyAction={emptyAction}
        onCenterLawn={onCenterLawn}
      />

      {/* Everything floating over the map. Gaps between panels let touches reach the map. */}
      <div ref={topRef} className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-2 p-3">
        {header}
        <nav ref={(el) => { (chipsRef as React.MutableRefObject<HTMLElement | null>).current = el; moreToScroll(el); }} onScroll={(e) => moreToScroll(e.currentTarget)} aria-label="Lawns" className="chip-row pointer-events-auto -mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none]">
          {zones.map((z) => (
            <Chip
              key={z.kind}
              data-chip={z.kind}
              aria-label={`Go to ${z.name}`}
              aria-current={current === z.kind ? "location" : undefined}
              onClick={() => go(z.kind)}
              accent={z.accent}
              here={current === z.kind}
              count={counts[z.kind] || undefined}
            >
              {z.name}
            </Chip>
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

      <div ref={bottomRef} className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-start gap-2 p-3 md:items-center">
        {thing && (
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
              {typeof thing.detail.link === "string" && thing.detail.link.startsWith("https://") && (
                <Button size="sm" variant="soft" onClick={() => window.open(thing.detail.link as string, "_blank", "noopener")}>
                  {thing.kind === "repo" ? "Open on GitHub" : "Open"}
                </Button>
              )}
              <Button size="sm" variant="soft" onClick={() => setThing(null)}>
                Close
              </Button>
            </div>
          </Float>
        )}
        {lawn ? (
          <Float label={zoneOf(lawn).name} className="flex w-full max-w-sm flex-col gap-1.5 px-4 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-serif text-xl leading-tight">
                {zoneOf(lawn).name} <span className="font-sans text-xs font-extrabold text-muted">{countLabel(zoneOf(lawn), lawnCount)}</span>
              </h2>
              <div className="flex gap-1">
                {lawn === "repo" ? (
                  githubAvailable && (
                    <Button variant="soft" size="sm" onClick={connectGitHub}>
                      Choose
                    </Button>
                  )
                ) : (
                  <Button variant="soft" size="sm" onClick={() => router.push(chatWith(zoneOf(lawn).starter))}>
                    Add
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => toggleLawn(lawn)}>
                  Close
                </Button>
              </div>
            </div>
            {/* Its categories; the open one shows everything it holds on the map. */}
            <div ref={(el) => { (groupRef as React.MutableRefObject<HTMLDivElement | null>).current = el; moreToScroll(el); }} onScroll={(e) => moreToScroll(e.currentTarget)} role="group" aria-label={`${zoneOf(lawn).name} categories`} className="chip-row -mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none]">
              {lawnGroups.map((g) => {
                const on = openGroup === g.id;
                return (
                  <Chip key={g.id} data-chip={g.id} aria-pressed={on} onClick={() => toggleGroup(lawn, on ? null : g.id)} accent={zoneOf(lawn).accent} on={on} count={g.things.length}>
                    {g.name}
                  </Chip>
                );
              })}
            </div>
          </Float>
        ) : thing ? null : (
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
              <Chip onClick={() => void runImports(connected)}>{connected.includes("github") && connected.length > 1 ? "Refresh" : connected.includes("github") ? "Refresh from GitHub" : "Refresh from Google"}</Chip>
            )}
          </>
        )}
      </div>
    </main>
  );
}
