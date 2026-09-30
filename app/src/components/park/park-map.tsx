"use client";

import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import type { ThingKind } from "@/lib/kinds";
import { buildWorld, countLabel, hash, lawnPath, placeLawn, SAMPLE_SCALE, stageOf, streamPath, waterPath, zones, type Placement, type World, type Zone } from "@/lib/park/layout";
import type { Group } from "@/lib/park/groups";
import type { ParkThing } from "@/lib/things";
import { countByKind } from "@/lib/kinds";
import { Bridge, DecorFigure, Figure, FurnitureFigure, Gate, INK, Lamp, Landmark, RowDressing } from "./park-figures";

type Props = {
  things: ParkThing[];
  /** Whose park it is, for the sign over the gate. */
  parkName: string;
  /** The current time, from the parent, so drawing stays predictable. */
  now: number;
  /** The lawn to show first. */
  startAt: ThingKind;
  /** Each lawn's categories, in order. */
  groups: Record<ThingKind, Group[]>;
  /** The lawn whose categories are showing, and the category showing everything in it. */
  openLawn: ThingKind | null;
  openGroup: string | null;
  selectedLawn: ThingKind | null;
  selectedThing: string | null;
  onSelectLawn: (kind: ThingKind) => void;
  onOpenGroup: (kind: ThingKind, id: string | null) => void;
  onSelectThing: (thing: ParkThing) => void;
  /** What an empty lawn's sign does: start a chat, or connect Google. Null means it is just a sign. */
  emptyAction: (zone: Zone) => (() => void) | null;
  /** Tells the parent which lawn is nearest the middle of the screen as the map moves. */
  onCenterLawn?: (kind: ThingKind) => void;
};

export type ParkMapHandle = {
  /** Glides the map to a lawn, like a maps app flying to a place. */
  flyTo: (kind: ThingKind) => void;
  /** Shows the whole park at once. */
  overview: () => void;
  zoomBy: (factor: number) => void;
};

/** The camera: which map point sits in the middle of the screen, and how much it is magnified. */
type Camera = { x: number; y: number; k: number };

const LAWN = "#bfe3b4";
const LAWN_STRIPE = "#b0d9a4";
const LAWN_EDGE = "#7fbf83";
const MEADOW = "#d7e8c8";
const MEADOW_DARK = "#c9dfb6";
const PATH = "#efe3c4";
const PATH_EDGE = "#dccb9f";
const WATER = "#a9d3ea";
const WATER_DEEP = "#8fc3e2";
const SHORE = "#efe0b8";
const MAX_ZOOM = 2.6;

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Screen space taken by the panels floating over the map's top and bottom edges. */
const INSET_TOP = 124;
const INSET_BOTTOM = 92;

/** How much detail to draw: far shows the shapes, mid the signs, near the names on every thing. */
type Lod = "far" | "mid" | "near";
const lodFor = (k: number): Lod => (k < 0.24 ? "far" : k < 0.6 ? "mid" : "near");

function lawnView(world: World, kind: ThingKind, w: number, h: number): Camera {
  const l = world.lawns[kind];
  // One lawn fills the open space between the floating panels, with a little meadow around it.
  const open = Math.max(200, h - INSET_TOP - INSET_BOTTOM);
  const k = Math.min(MAX_ZOOM, w / (l.w * 1.08), open / (l.h * 1.08));
  const screenY = INSET_TOP + open / 2;
  return { x: l.x, y: l.y - (screenY - h / 2) / k, k };
}

function worldView(world: World, w: number, h: number): Camera {
  const open = Math.max(200, h - INSET_TOP - INSET_BOTTOM);
  const k = Math.min(w / world.width, open / world.height) * 0.98;
  return { x: world.width / 2, y: world.height / 2 - (INSET_TOP + open / 2 - h / 2) / k, k };
}

const activate = (fn: () => void) => (e: KeyboardEvent) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fn();
  }
};

const short = (s: string, n = 18) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** A name tag under a thing, sized to its text. */
function NameTag({ text, y }: { text: string; y: number }) {
  const label = short(text);
  const w = label.length * 7.4 + 20;
  return (
    <g transform={`translate(0 ${y})`} pointerEvents="none">
      <rect x={-w / 2} y={0} width={w} height={22} rx={11} fill="#fffaf0" stroke={INK} strokeWidth={1.6} />
      <text y={15.5} textAnchor="middle" fontSize={13} fontWeight={700} fill={INK}>
        {label}
      </text>
    </g>
  );
}

/** A lawn's wooden sign: its name and how much is on it. */
function Sign({ z, n, x, y, scale = 1 }: { z: Zone; n: number; x: number; y: number; scale?: number }) {
  const title = z.name;
  const sub = n > 0 ? countLabel(z, n) : z.sign;
  const w = Math.max(title.length * 15, sub.length * 8.6) + 44;
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <rect x={-w / 2 + 18} y={30} width={7} height={34} fill="#7d5234" stroke={INK} strokeWidth={1.6} />
      <rect x={w / 2 - 25} y={30} width={7} height={34} fill="#7d5234" stroke={INK} strokeWidth={1.6} />
      <rect x={-w / 2} y={-30} width={w} height={64} rx={10} fill="#f4e0b0" stroke={INK} strokeWidth={2.4} />
      <rect x={-w / 2 + 5} y={-25} width={w - 10} height={54} rx={7} fill="none" stroke="#d8bd84" strokeWidth={1.5} />
      <circle cx={-w / 2 + 12} cy={-18} r={2.2} fill={INK} opacity={0.5} />
      <circle cx={w / 2 - 12} cy={-18} r={2.2} fill={INK} opacity={0.5} />
      <text y={2} textAnchor="middle" className="font-serif" fontSize={27} fill={INK}>
        {title}
      </text>
      <text y={22} textAnchor="middle" fontSize={13} fontWeight={800} fill={z.accent}>
        {sub}
      </text>
    </g>
  );
}

/**
 * Someone's life as a park they move around like a maps app: one lawn fills
 * the screen, and dragging, pinching, scrolling, or double-tapping moves and
 * zooms to the others. Each lawn holds one kind of thing and grows with it.
 */
export const ParkMap = forwardRef<ParkMapHandle, Props>(function ParkMap(
  { things, parkName, now, startAt, groups, openLawn, openGroup, selectedLawn, selectedThing, onSelectLawn, onOpenGroup, onSelectThing, emptyAction, onCenterLawn },
  ref,
) {
  const boxRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [cam, setCam] = useState<Camera | null>(null);
  const camRef = useRef<Camera | null>(null);
  const anim = useRef<number | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    start: Camera;
    // One finger: where it went down. Two: the pinch's starting spread and middle.
    px: number;
    py: number;
    dist: number;
    moved: boolean;
    trail: { x: number; y: number; t: number }[];
  } | null>(null);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const centered = useRef<ThingKind | null>(null);

  const ready = cam !== null;
  const counts = useMemo(() => countByKind(things), [things]);
  // Every lawn's layout, which depends on what is open, and the park laid out around them.
  const placements = useMemo(() => {
    const out = {} as Record<ThingKind, Placement>;
    for (const z of zones) {
      const g = groups[z.kind].map((x) => ({ id: x.id, count: x.things.length }));
      out[z.kind] = placeLawn(z.kind, g, openLawn === z.kind, openLawn === z.kind ? openGroup : null);
    }
    return out;
  }, [groups, openLawn, openGroup]);
  const world = useMemo(() => buildWorld(placements), [placements]);
  const byKind = useMemo(() => {
    const m = new Map<ThingKind, ParkThing[]>();
    for (const t of things) m.set(t.kind, [...(m.get(t.kind) ?? []), t]);
    // Newest first; events soonest first.
    for (const [kind, list] of m) {
      if (kind === "event") {
        const time = (t: ParkThing) => (t.date ? Date.parse(t.date) : 0);
        const up = list.filter((t) => time(t) >= now).sort((a, b) => time(a) - time(b));
        const past = list.filter((t) => time(t) < now).sort((a, b) => time(b) - time(a));
        m.set(kind, [...up, ...past]);
      } else m.set(kind, [...list].reverse());
    }
    return m;
  }, [things, now]);

  const clamp = useCallback(
    (c: Camera): Camera => {
      if (!size) return c;
      const fit = worldView(world, size.w, size.h).k;
      const k = Math.min(MAX_ZOOM, Math.max(fit * 0.9, c.k));
      // Keep some of the park on screen wherever you drag.
      const mx = size.w / 2 / k;
      const my = size.h / 2 / k;
      return {
        k,
        x: Math.min(world.width - Math.min(mx, world.width / 2) * 0.2, Math.max(Math.min(mx, world.width / 2) * 0.2, c.x)),
        y: Math.min(world.height - Math.min(my, world.height / 2) * 0.2, Math.max(Math.min(my, world.height / 2) * 0.2, c.y)),
      };
    },
    [size, world],
  );

  const apply = useCallback(
    (c: Camera) => {
      const next = clamp(c);
      camRef.current = next;
      setCam(next);
    },
    [clamp],
  );

  const stop = () => {
    if (anim.current !== null) cancelAnimationFrame(anim.current);
    anim.current = null;
  };

  const glide = useCallback(
    (to: Camera, ms = 750) => {
      stop();
      const from = camRef.current;
      if (!from) return apply(to);
      const dist = Math.hypot(to.x - from.x, to.y - from.y) * Math.min(from.k, to.k);
      // Far trips pull back mid-flight, like a maps app.
      const dip = Math.min(0.45, dist / 3000);
      const start = performance.now();
      const step = (t: number) => {
        const p = Math.min(1, (t - start) / ms);
        const e = ease(p);
        const k = (from.k + (to.k - from.k) * e) * (1 - dip * Math.sin(Math.PI * p));
        apply({ x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, k });
        anim.current = p < 1 ? requestAnimationFrame(step) : null;
      };
      anim.current = requestAnimationFrame(step);
    },
    [apply],
  );

  useImperativeHandle(
    ref,
    () => ({
      flyTo: (kind) => size && glide(lawnView(world, kind, size.w, size.h)),
      overview: () => size && glide(worldView(world, size.w, size.h)),
      zoomBy: (f) => camRef.current && glide({ ...camRef.current, k: camRef.current.k * f }, 280),
    }),
    [size, world, glide],
  );

  // Measure the screen area, and start on the first lawn once it is known.
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize((s) => (s && s.w === r.width && s.h === r.height ? s : { w: r.width, h: r.height }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!size || camRef.current) return;
    const start = lawnView(world, startAt, size.w, size.h);
    camRef.current = start;
    // The first camera can only be chosen once the screen size is known.
    setCam(start);
  }, [size, world, startAt]);

  // Whatever opens, fly to fit it: a lawn's categories, or one category's things.
  const opened = useRef<string | null>(null);
  useEffect(() => {
    if (!size || !camRef.current) return;
    const key = openLawn ? `${openLawn}/${openGroup ?? ""}` : null;
    if (key === opened.current) return;
    opened.current = key;
    if (!openLawn) return;
    const l = world.lawns[openLawn];
    const plot = openGroup ? placements[openLawn].plots.find((p) => p.id === openGroup) : null;
    const open = Math.max(200, size.h - INSET_TOP - INSET_BOTTOM);
    if (plot) {
      const k = Math.min(MAX_ZOOM, size.w / (plot.w * 1.1), open / ((plot.h + 60) * 1.1));
      glide({ x: l.x + plot.x, y: l.y + plot.y - (INSET_TOP + open / 2 - size.h / 2) / k, k });
    } else glide(lawnView(world, openLawn, size.w, size.h));
  }, [openLawn, openGroup, world, placements, size, glide]);

  // Tell the parent which lawn is in the middle of the open space as the map moves.
  useEffect(() => {
    if (!cam || !onCenterLawn || !size) return;
    const open = Math.max(200, size.h - INSET_TOP - INSET_BOTTOM);
    const midY = cam.y + (INSET_TOP + open / 2 - size.h / 2) / cam.k;
    let best: ThingKind = startAt;
    let bestD = Infinity;
    for (const l of Object.values(world.lawns)) {
      const d = Math.hypot(l.x - cam.x, l.y - midY) / l.r;
      if (d < bestD) {
        bestD = d;
        best = l.kind;
      }
    }
    if (centered.current !== best) {
      centered.current = best;
      onCenterLawn(best);
    }
  }, [cam, world, onCenterLawn, startAt, size]);

  // Scroll wheel and trackpad zoom around the pointer. Needs a non-passive listener.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const c = camRef.current;
      if (!c || !size) return;
      e.preventDefault();
      stop();
      const r = el.getBoundingClientRect();
      const sx = e.clientX - r.left;
      const sy = e.clientY - r.top;
      const wx = c.x + (sx - size.w / 2) / c.k;
      const wy = c.y + (sy - size.h / 2) / c.k;
      const k = clamp({ ...c, k: c.k * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)) }).k;
      apply({ k, x: wx - (sx - size.w / 2) / k, y: wy - (sy - size.h / 2) / k });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [size, apply, clamp, ready]);

  function local(e: { clientX: number; clientY: number }) {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function beginGesture() {
    const c = camRef.current;
    if (!c) return;
    const pts = [...pointers.current.values()];
    const mid = pts.reduce((a, p) => ({ x: a.x + p.x / pts.length, y: a.y + p.y / pts.length }), { x: 0, y: 0 });
    const dist = pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
    gesture.current = { start: c, px: mid.x, py: mid.y, dist, moved: gesture.current?.moved ?? false, trail: [] };
  }

  function down(e: PointerEvent) {
    stop();
    pointers.current.set(e.pointerId, local(e));
    beginGesture();
  }

  function move(e: PointerEvent) {
    if (!pointers.current.has(e.pointerId) || !size) return;
    pointers.current.set(e.pointerId, local(e));
    const g = gesture.current;
    if (!g) return;
    const pts = [...pointers.current.values()];
    const mid = pts.reduce((a, p) => ({ x: a.x + p.x / pts.length, y: a.y + p.y / pts.length }), { x: 0, y: 0 });
    if (!g.moved && Math.hypot(mid.x - g.px, mid.y - g.py) < 6 && pts.length < 2) return;
    g.moved = true;
    let k = g.start.k;
    if (pts.length > 1 && g.dist > 0) {
      k = clamp({ ...g.start, k: g.start.k * (Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) / g.dist) }).k;
    }
    // The map point that was under the fingers stays under them.
    const wx = g.start.x + (g.px - size.w / 2) / g.start.k;
    const wy = g.start.y + (g.py - size.h / 2) / g.start.k;
    apply({ k, x: wx - (mid.x - size.w / 2) / k, y: wy - (mid.y - size.h / 2) / k });
    g.trail = [...g.trail.slice(-4), { x: mid.x, y: mid.y, t: performance.now() }];
  }

  function up(e: PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (pointers.current.size > 0) {
      // A finger lifted mid-pinch: carry on panning with the one left.
      beginGesture();
      return;
    }
    gesture.current = null;
    if (!g || !size) return;
    if (g.moved) {
      // Swallow the click that ends a drag, so moving the map never opens anything.
      const swallow = (ev: Event) => ev.stopPropagation();
      window.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
      // Let the map coast a little after a flick.
      const [a, b] = [g.trail[0], g.trail[g.trail.length - 1]];
      if (a && b && b.t > a.t && performance.now() - b.t < 80) {
        let vx = (b.x - a.x) / (b.t - a.t);
        let vy = (b.y - a.y) / (b.t - a.t);
        let last = performance.now();
        const coast = (t: number) => {
          const c = camRef.current!;
          const dt = t - last;
          last = t;
          apply({ ...c, x: c.x - (vx * dt) / c.k, y: c.y - (vy * dt) / c.k });
          vx *= Math.pow(0.992, dt);
          vy *= Math.pow(0.992, dt);
          anim.current = Math.hypot(vx, vy) > 0.02 ? requestAnimationFrame(coast) : null;
        };
        anim.current = requestAnimationFrame(coast);
      }
      return;
    }
    // Double-tap zooms in where you tapped.
    const p = local(e);
    const t = performance.now();
    const prev = lastTap.current;
    if (prev && t - prev.t < 320 && Math.hypot(p.x - prev.x, p.y - prev.y) < 30) {
      lastTap.current = null;
      const c = camRef.current!;
      const wx = c.x + (p.x - size.w / 2) / c.k;
      const wy = c.y + (p.y - size.h / 2) / c.k;
      const k = clamp({ ...c, k: c.k * 1.8 }).k;
      glide({ k, x: wx - (p.x - size.w / 2) / k, y: wy - (p.y - size.h / 2) / k }, 300);
    } else lastTap.current = { t, x: p.x, y: p.y };
  }

  const k = cam?.k ?? 1;
  const lod = lodFor(k);
  // Zoomed far out, signs grow in half steps so they still read, like labels on a map.
  const signScale = lod === "far" ? Math.min(2.5, Math.max(1, Math.round((0.5 / k) * 2) / 2)) : 1;
  const summary = zones.map((z) => countLabel(z, counts[z.kind])).join(", ");

  // The scene only re-renders when what is on it changes, never while the camera moves.
  const handlers = useRef({ onSelectLawn, onOpenGroup, onSelectThing, emptyAction });
  useLayoutEffect(() => {
    handlers.current = { onSelectLawn, onOpenGroup, onSelectThing, emptyAction };
  });
  const stable = useMemo(
    () => ({
      onSelectLawn: (kind: ThingKind) => handlers.current.onSelectLawn(kind),
      onOpenGroup: (kind: ThingKind, id: string | null) => handlers.current.onOpenGroup(kind, id),
      onSelectThing: (t: ParkThing) => handlers.current.onSelectThing(t),
      emptyAction: (z: Zone) => handlers.current.emptyAction(z),
    }),
    [],
  );
  // What the empty lawns offer can change (say, once Google is connected), so ask again per render of the parent.
  const emptyKinds = zones.filter((z) => counts[z.kind] === 0 && emptyAction(z) !== null).map((z) => z.kind).join(",");

  return (
    <div ref={boxRef} className="absolute inset-0 overflow-hidden" style={{ background: MEADOW }}>
      {size && cam && (
        <svg
          ref={svgRef}
          width={size.w}
          height={size.h}
          className="block touch-none select-none"
          role="group"
          aria-label={`Your park: ${summary}. Drag to move around, pinch or scroll to zoom.`}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        >
          <defs>
            <pattern id="meadow" width="46" height="46" patternUnits="userSpaceOnUse">
              <path d="M8 30 l2 -6 l2 6 M30 12 l2 -6 l2 6" fill="none" stroke="#b9d3a6" strokeWidth={1.6} strokeLinecap="round" />
            </pattern>
            <pattern id="mowed" width="64" height="64" patternUnits="userSpaceOnUse" patternTransform="rotate(-18)">
              <rect width="32" height="64" fill={LAWN_STRIPE} opacity={0.55} />
            </pattern>
            <pattern id="gravel" width="18" height="18" patternUnits="userSpaceOnUse">
              <circle cx="4" cy="5" r="1.1" fill="#cdb98a" />
              <circle cx="13" cy="12" r="1.3" fill="#cdb98a" />
              <circle cx="9" cy="15" r="0.9" fill="#e6d6ad" />
            </pattern>
            <pattern id="ripples" width="90" height="60" patternUnits="userSpaceOnUse">
              <path d="M6 20 q8 -6 16 0 t16 0 M48 44 q8 -6 16 0 t16 0" fill="none" stroke="#c7e4f3" strokeWidth={2} strokeLinecap="round" />
            </pattern>
            <clipPath id="picnic-clip">
              <path d="M-38 -22 L36 -24 L38 22 L-36 24 Z" />
            </clipPath>
          </defs>
          <g transform={`translate(${size.w / 2 - cam.x * k} ${size.h / 2 - cam.y * k}) scale(${k})`}>
            <Scene
              world={world}
              placements={placements}
              groups={groups}
              openLawn={openLawn}
              openGroup={openGroup}
              byKind={byKind}
              now={now}
              lod={lod}
              signScale={signScale}
              parkName={parkName}
              selectedLawn={selectedLawn}
              selectedThing={selectedThing}
              emptyKinds={emptyKinds}
              {...stable}
            />
          </g>
        </svg>
      )}
    </div>
  );
});

type SceneProps = {
  world: World;
  placements: Record<ThingKind, Placement>;
  groups: Record<ThingKind, Group[]>;
  openLawn: ThingKind | null;
  openGroup: string | null;
  byKind: Map<ThingKind, ParkThing[]>;
  now: number;
  lod: Lod;
  signScale: number;
  parkName: string;
  selectedLawn: ThingKind | null;
  selectedThing: string | null;
  emptyKinds: string;
  onSelectLawn: (kind: ThingKind) => void;
  onOpenGroup: (kind: ThingKind, id: string | null) => void;
  onSelectThing: (thing: ParkThing) => void;
  emptyAction: (zone: Zone) => (() => void) | null;
};

/** A category's little sign on its plot. */
function PlotSign({ name, n, open, accent }: { name: string; n: number; open: boolean; accent: string }) {
  const label = `${name} · ${n}`;
  const w = label.length * 8.2 + 36;
  return (
    <g>
      <rect x={-w / 2} y={-16} width={w} height={32} rx={16} fill={open ? INK : "#fffaf0"} stroke={INK} strokeWidth={2} />
      <circle cx={-w / 2 + 16} cy={0} r={5} fill={accent} stroke={open ? "#fffaf0" : INK} strokeWidth={1.2} />
      <text x={8} y={5} textAnchor="middle" fontSize={14} fontWeight={800} fill={open ? "#fffaf0" : INK}>
        {label}
      </text>
    </g>
  );
}

/** Everything in the park, in map units. Memoized: moving the camera never redraws it. */
const Scene = memo(function Scene({ world, placements, groups, openLawn, openGroup, byKind, now, lod, signScale, parkName, selectedLawn, selectedThing, emptyKinds, onSelectLawn, onOpenGroup, onSelectThing, emptyAction }: SceneProps) {
  void openGroup;
  return (
    <>
      <rect x={-2000} y={-2000} width={world.width + 4000} height={world.height + 4000} fill={MEADOW} />
      {/* Soft darker patches keep the meadow from looking flat. */}
      {Array.from({ length: 14 }, (_, i) => {
        const h = hash(`patch${i}`);
        return <ellipse key={i} cx={(h % 1000) / 1000 * world.width} cy={((h >>> 10) % 1000) / 1000 * world.height} rx={180 + (h % 200)} ry={110 + ((h >>> 5) % 120)} fill={MEADOW_DARK} opacity={0.55} />;
      })}
      <rect x={-2000} y={-2000} width={world.width + 4000} height={world.height + 4000} fill="url(#meadow)" />

      {/* Paths between lawns, and in from the gate: a darker edge under a gravel walkway. */}
      {[PATH_EDGE, PATH, "url(#gravel)"].map((color, layer) => (
        <g key={layer} fill="none" stroke={color} strokeWidth={layer === 0 ? 50 : 40} strokeLinecap="round">
          {world.paths.map(([a, b]) => {
            const p = world.lawns[a];
            const q = world.lawns[b];
            const bend = ((hash(a + b) % 60) - 30) / 220;
            const mx = (p.x + q.x) / 2 + (q.y - p.y) * bend;
            const my = (p.y + q.y) / 2 - (q.x - p.x) * bend;
            return <path key={a + b} d={`M${p.x} ${p.y} Q${mx} ${my} ${q.x} ${q.y}`} />;
          })}
          <path d={`M${world.gate.x} ${world.gate.y + 60} V${(world.lawns.habit.y + world.lawns.note.y) / 2}`} />
        </g>
      ))}

      {/* The lake and the duck pond, with a sandy shore, then the stream between them. */}
      {[world.lake, ...world.ponds].map((w, i) => {
        const d = waterPath(w, hash(`water${i}`));
        return (
          <g key={i} aria-hidden="true">
            <path d={d} fill={SHORE} stroke="#dccb9f" strokeWidth={4} transform={`translate(${w.x} ${w.y}) scale(1.08) translate(${-w.x} ${-w.y})`} />
            <path d={d} fill={WATER} stroke={WATER_DEEP} strokeWidth={3} />
            <path d={d} fill={WATER_DEEP} opacity={0.5} transform={`translate(${w.x} ${w.y}) scale(0.72) translate(${-w.x} ${-w.y})`} />
            <path d={d} fill="url(#ripples)" />
          </g>
        );
      })}
      <path d={streamPath(world.stream)} fill="none" stroke={SHORE} strokeWidth={44} strokeLinecap="round" />
      <path d={streamPath(world.stream)} fill="none" stroke={WATER} strokeWidth={30} strokeLinecap="round" />
      <path d={streamPath(world.stream)} fill="none" stroke="#c7e4f3" strokeWidth={4} strokeLinecap="round" strokeDasharray="14 26" opacity={0.8} />
      {world.bridges.map((b, i) => (
        <g key={i} transform={`translate(${b.x} ${b.y})`} aria-hidden="true" pointerEvents="none">
          <Bridge a={b.a} />
        </g>
      ))}

      {/* Everything standing on the meadow, drawn back to front. */}
      {[
        ...world.decor.map((d) => ({ y: d.y, el: <DecorFigure kind={d.kind} s={d.s} />, x: d.x })),
        ...world.lamps.map((l) => ({ y: l.y, el: <Lamp />, x: l.x })),
        ...world.furniture.map((f) => ({ y: f.y, el: <FurnitureFigure f={f} />, x: f.x })),
      ]
        .sort((a, b) => a.y - b.y)
        .map((d, i) => (
          <g key={i} transform={`translate(${d.x} ${d.y})`} aria-hidden="true" pointerEvents="none">
            {d.el}
          </g>
        ))}
      {/* A low picket fence around the grounds, open at the gate. */}
      {(() => {
        const inset = 70;
        const gap = 150;
        const d = `M${world.gate.x + gap / 2} ${world.height - inset} H${world.width - inset - 40} Q${world.width - inset} ${world.height - inset} ${world.width - inset} ${world.height - inset - 40} V${inset + 40} Q${world.width - inset} ${inset} ${world.width - inset - 40} ${inset} H${inset + 40} Q${inset} ${inset} ${inset} ${inset + 40} V${world.height - inset - 40} Q${inset} ${world.height - inset} ${inset + 40} ${world.height - inset} H${world.gate.x - gap / 2}`;
        return (
          <g fill="none" aria-hidden="true" pointerEvents="none">
            <path d={d} stroke="#e6d6ad" strokeWidth={10} strokeLinecap="round" />
            <path d={d} stroke="#b9814a" strokeWidth={3} />
            <path d={d} stroke="#8a5a2b" strokeWidth={7} strokeDasharray="4 30" strokeLinecap="round" />
          </g>
        );
      })()}
      <g transform={`translate(${world.gate.x} ${world.gate.y})`} aria-hidden="true" pointerEvents="none">
        <Gate name={parkName} />
      </g>

      {zones.map((z) => {
        const l = world.lawns[z.kind];
        const items = byKind.get(z.kind) ?? [];
        const n = items.length;
        const place = placements[z.kind];
        const outline = lawnPath(0, 0, l.w, l.h, hash(z.kind));
        const selected = selectedLawn === z.kind;
        const isOpen = openLawn === z.kind;
        const action = n === 0 && emptyKinds.split(",").includes(z.kind) ? emptyAction(z) : null;
        const open = () => onSelectLawn(z.kind);
        const signY = place.signY - (signScale - 1) * 64;
        const lawnGroups = groups[z.kind];
        return (
          <g
            key={z.kind}
            data-zone={z.kind}
            data-stage={stageOf(n)}
            data-open={isOpen || undefined}
            style={{ transform: `translate(${l.x}px, ${l.y}px)`, transition: "transform 550ms cubic-bezier(0.2, 0.7, 0.2, 1)" }}
          >
            <g onClick={n > 0 ? open : action ?? undefined} className={n > 0 || action ? "cursor-pointer" : undefined}>
              <path d={outline} fill={n > 0 ? LAWN : "#cfe6c4"} stroke={LAWN_EDGE} strokeWidth={5} strokeDasharray={n > 0 ? undefined : "18 14"} />
              {n > 0 && <path d={outline} fill="url(#mowed)" />}
              {/* A clipped hedge just inside the edge. */}
              <path d={outline} fill="none" stroke="#6faa73" strokeWidth={9} strokeDasharray="3 13" strokeLinecap="round" opacity={0.7} transform="scale(0.965)" />
              {selected && <path d={outline} fill="none" stroke={INK} strokeWidth={5} filter="url(#chalk-line)" />}
              <g transform={`translate(0 ${place.landmarkY})`} opacity={n > 0 ? 1 : 0.55} aria-hidden="true">
                <Landmark kind={z.kind} />
              </g>
            </g>

            {n > 0 ? (
              <g
                role="button"
                tabIndex={0}
                aria-label={`${z.name}: ${countLabel(z, n)}. ${isOpen ? "Close it." : "Open it."}`}
                aria-expanded={isOpen}
                onClick={open}
                onKeyDown={activate(open)}
                className="cursor-pointer outline-none"
              >
                <Sign z={z} n={n} x={0} y={signY} scale={signScale} />
              </g>
            ) : action ? (
              <g role="button" tabIndex={0} aria-label={`${z.name}: ${z.sign}`} onClick={action} onKeyDown={activate(action)} className="park-sign cursor-pointer outline-none">
                <Sign z={z} n={0} x={0} y={signY} scale={signScale} />
              </g>
            ) : (
              <Sign z={z} n={0} x={0} y={signY} scale={signScale} />
            )}

            {/* Open: a plot per category, with a few of its things, or all of them once it is opened too. */}
            {isOpen &&
              place.plots.map((plot) => {
                const group = lawnGroups.find((g) => g.id === plot.id);
                if (!group) return null;
                const shown = plot.open ? group.things : group.things.slice(0, plot.spots.length);
                const toggle = () => onOpenGroup(z.kind, plot.open ? null : plot.id);
                const scale = plot.open ? 1 : SAMPLE_SCALE;
                return (
                  <g key={plot.id} transform={`translate(${plot.x} ${plot.y})`} data-plot={plot.id} data-open={plot.open || undefined}>
                    <rect x={-plot.w / 2} y={-plot.h / 2} width={plot.w} height={plot.h} rx={28} fill="#d2ebc6" stroke="#9ccf9a" strokeWidth={3} onClick={toggle} className="cursor-pointer" />
                    <g transform={`scale(${scale})`} aria-hidden="true" pointerEvents="none">
                      <RowDressing kind={z.kind} rows={plot.rows.map((r) => ({ y: r.y / scale, x0: r.x0 / scale, x1: r.x1 / scale }))} />
                    </g>
                    <g
                      transform={`translate(0 ${plot.signY})`}
                      role="button"
                      tabIndex={0}
                      aria-label={`${group.name}: ${countLabel(z, group.things.length)}. ${plot.open ? "Close it." : "Open it."}`}
                      aria-expanded={plot.open}
                      onClick={toggle}
                      onKeyDown={activate(toggle)}
                      className="cursor-pointer outline-none"
                    >
                      <PlotSign name={group.name} n={group.things.length} open={plot.open} accent={z.accent} />
                    </g>
                    {shown.map((t, i) => {
                      const s = plot.spots[i];
                      if (!s) return null;
                      const pick = () => onSelectThing(t);
                      return (
                        <g
                          key={t.id}
                          transform={`translate(${s.x} ${s.y}) scale(${scale})`}
                          role="button"
                          tabIndex={0}
                          aria-label={`${t.title}, ${z.one}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            pick();
                          }}
                          onKeyDown={activate(pick)}
                          className="cursor-pointer outline-none"
                        >
                          <g className="park-item" style={{ animationDelay: `${Math.min(i * 30, 1200)}ms` }}>
                            <circle r={40} fill="transparent" />
                            {selectedThing === t.id && <circle r={52} fill="#fffaf0" opacity={0.6} stroke={INK} strokeWidth={2.4} strokeDasharray="8 6" />}
                            <Figure t={t} now={now} i={i} />
                          </g>
                          {(plot.open ? lod === "near" : lod !== "far") && <NameTag text={t.title} y={36} />}
                        </g>
                      );
                    })}
                  </g>
                );
              })}
          </g>
        );
      })}
    </>
  );
});
