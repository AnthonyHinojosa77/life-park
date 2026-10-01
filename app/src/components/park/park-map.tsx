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
  type ReactNode,
} from "react";
import type { ThingKind } from "@/lib/kinds";
import {
  buildWorld,
  countLabel,
  hash,
  lawnPath,
  placeLawn,
  spacingOf,
  stageOf,
  streamPath,
  waterPath,
  zones,
  type Curve,
  type Orientation,
  type Placement,
  type World,
  type Zone,
} from "@/lib/park/layout";
import type { Group } from "@/lib/park/groups";
import type { ParkThing } from "@/lib/things";
import { countByKind } from "@/lib/kinds";
import { Bridge, DecorFigure, Figure, FurnitureFigure, Gate, INK, Lamp, Landmark, RowDressing } from "./park-figures";

/** Screen space taken by what floats over the map's edges, so fitting never hides anything. */
export type Insets = { top: number; bottom: number; right: number };

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
  selectedThing: string | null;
  insets: Insets;
  onSelectLawn: (kind: ThingKind) => void;
  onOpenGroup: (kind: ThingKind, id: string | null) => void;
  onSelectThing: (thing: ParkThing) => void;
  /** What an empty lawn's sign does: start a chat, or connect Google. Null means it is just a sign. */
  emptyAction: (zone: Zone) => (() => void) | null;
  /** Tells the parent which lawn is nearest the middle of the screen as the map moves. */
  onCenterLawn?: (kind: ThingKind) => void;
};

export type ParkMapHandle = {
  /** Glides the map to a lawn, like a maps app flying to a place. `closing` when the jump also closes an open lawn. */
  flyTo: (kind: ThingKind, opts?: { closing?: boolean }) => void;
  /** Shows the whole park at once. */
  overview: () => void;
  zoomBy: (factor: number) => void;
};

/** The camera: which map point sits in the middle of the screen, and how much it is magnified. */
type Camera = { x: number; y: number; k: number };

const LAWN = "#bfe3b4";
const LAWN_STRIPE = "#b0d9a4";
const LAWN_EMPTY = "#cfe6c4";
const HEDGE = "#6faa73";
const MEADOW = "#d7e8c8";
const MEADOW_DARK = "#c9dfb6";
const PATH = "#efe3c4";
const PATH_EDGE = "#dccb9f";
const WATER = "#a9d3ea";
const WATER_DEEP = "#8fc3e2";
const SHORE = "#efe0b8";
const PLOT = "#cfe8c2";
const MAX_ZOOM = 2.6;

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** How much detail to draw: far shows shapes, mid signs, near the names on open plots, close every name. */
type Lod = "far" | "mid" | "near" | "close";
const lodFor = (k: number): Lod => (k < 0.16 ? "far" : k < 0.6 ? "mid" : k < 0.9 ? "near" : "close");

/** A camera that fits a `w` by `h` box centered on `x`,`y` into the open part of the screen. */
function fitView(x: number, y: number, w: number, h: number, size: { w: number; h: number }, insets: Insets): Camera {
  const openW = Math.max(160, size.w - insets.right);
  const openH = Math.max(200, size.h - insets.top - insets.bottom);
  const k = Math.min(MAX_ZOOM, openW / w, openH / h);
  // The box sits in the middle of the open space, not the screen.
  return { x: x - (openW / 2 - size.w / 2) / k, y: y - (insets.top + openH / 2 - size.h / 2) / k, k };
}

function lawnView(world: World, kind: ThingKind, size: { w: number; h: number }, insets: Insets, place?: Placement): Camera {
  const l = world.lawns[kind];
  const w = place?.w ?? l.w;
  const h = place?.h ?? l.h;
  return fitView(l.x, l.y, w * 1.08, h * 1.08, size, insets);
}

/** The whole park: the fenced grounds filling the open part of the screen, with nothing past the fence showing. */
function worldView(world: World, size: { w: number; h: number }, insets: Insets): Camera {
  const openW = Math.max(160, size.w - insets.right);
  const openH = Math.max(200, size.h - insets.top - insets.bottom);
  const w = world.width - world.fence * 2;
  const h = world.height - world.fence * 2;
  const k = Math.min(MAX_ZOOM, Math.max(openW / w, openH / h));
  return { x: world.width / 2 - (openW / 2 - size.w / 2) / k, y: world.height / 2 - (insets.top + openH / 2 - size.h / 2) / k, k };
}

const activate = (fn: () => void) => (e: KeyboardEvent) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fn();
  }
};

/** Darkens a hex color toward ink, for text that has to read on cream. */
function inked(hex: string, amount = 0.62) {
  const n = parseInt(hex.slice(1), 16);
  const ink = [0x2b, 0x3a, 0x31];
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v, i) => Math.round(v * (1 - amount) + ink[i] * amount));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** A name tag under a thing, no wider than the room the thing has. */
function NameTag({ text, y, maxW }: { text: string; y: number; maxW: number }) {
  const fit = Math.max(3, Math.floor((maxW - 20) / 7.4));
  const label = text.length > fit ? `${text.slice(0, fit - 1)}…` : text;
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
function Sign({ z, n, y, scale = 1, brief = false }: { z: Zone; n: number; y: number; scale?: number; brief?: boolean }) {
  const title = z.name;
  const sub = n > 0 ? countLabel(z, n) : z.sign;
  const w = signWidth(z, n);
  const h = brief ? 40 : 56;
  return (
    <g transform={`translate(0 ${y}) scale(${scale})`}>
      <rect x={-w / 2 + 16} y={h / 2 - 4} width={7} height={30} fill="#7d5234" stroke={INK} strokeWidth={1.6} />
      <rect x={w / 2 - 23} y={h / 2 - 4} width={7} height={30} fill="#7d5234" stroke={INK} strokeWidth={1.6} />
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={9} fill="#f4e0b0" stroke={INK} strokeWidth={2.2} />
      <rect x={-w / 2 + 5} y={-h / 2 + 5} width={w - 10} height={h - 10} rx={6} fill="none" stroke="#d8bd84" strokeWidth={1.4} />
      <text y={brief ? 7 : -3} textAnchor="middle" className="font-serif" fontSize={24} fill={INK}>
        {title}
      </text>
      {!brief && (
        <>
          <circle cx={-(sub.length * 6.6) / 2 - 8} cy={14} r={4} fill={z.accent} stroke={INK} strokeWidth={1} />
          <text x={4} y={18} textAnchor="middle" fontSize={12} fontWeight={800} fill={inked(z.accent)}>
            {sub}
          </text>
        </>
      )}
    </g>
  );
}

function signWidth(z: Zone, n: number) {
  const sub = n > 0 ? countLabel(z, n) : z.sign;
  return Math.max(z.name.length * 12.5, sub.length * 6.6 + 24) + 40;
}

/** A category's little sign on its plot. */
function PlotSign({ name, n, open, accent, maxW }: { name: string; n: number; open: boolean; accent: string; maxW: number }) {
  const room = Math.max(4, Math.floor((maxW - 44) / 8) - `${n}`.length - 3);
  const label = `${name.length > room ? `${name.slice(0, room - 1)}…` : name} · ${n}`;
  const w = label.length * 8 + 36;
  return (
    <g>
      <rect x={-w / 2} y={-15} width={w} height={30} rx={15} fill={open ? INK : "#fffaf0"} stroke={INK} strokeWidth={2} />
      <circle cx={-w / 2 + 15} cy={0} r={5} fill={accent} stroke={open ? "#fffaf0" : INK} strokeWidth={1.2} />
      <text x={7} y={5} textAnchor="middle" fontSize={14} fontWeight={800} fill={open ? "#fffaf0" : INK}>
        {label}
      </text>
    </g>
  );
}

/**
 * Someone's life as a park they move around like a maps app: one lawn fills
 * the screen, and dragging, pinching, scrolling, or double-tapping moves and
 * zooms to the others. Each lawn is one place; opened, it shows its categories.
 */
export const ParkMap = forwardRef<ParkMapHandle, Props>(function ParkMap(
  { things, parkName, now, startAt, groups, openLawn, openGroup, selectedThing, insets, onSelectLawn, onOpenGroup, onSelectThing, emptyAction, onCenterLawn },
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
  const skipRefit = useRef(false);
  /** True once the person has moved the map or something has flown it; the first view is only refit before then. */
  const settled = useRef(false);

  const ready = cam !== null;
  const counts = useMemo(() => countByKind(things), [things]);
  const groupCounts = useMemo(() => {
    const out = {} as Record<ThingKind, { id: string; count: number }[]>;
    for (const z of zones) out[z.kind] = groups[z.kind].map((g) => ({ id: g.id, count: g.things.length }));
    return out;
  }, [groups]);
  // Every lawn's closed layout: its size grows in steps with what it holds, and
  // it shows a glimpse of the first few things.
  const closedPlacements = useMemo(() => {
    const out = {} as Record<ThingKind, Placement>;
    for (const z of zones) out[z.kind] = placeLawn(z.kind, groupCounts[z.kind], false, null);
    return out;
  }, [groupCounts]);
  // The park is laid out from every lawn closed, two columns on a tall screen
  // and four on a wide one; it never moves when a lawn opens.
  const orientation: Orientation = size && size.w > size.h ? "landscape" : "portrait";
  const world = useMemo(() => {
    const sizes = {} as Record<ThingKind, { w: number; h: number }>;
    for (const z of zones) sizes[z.kind] = { w: closedPlacements[z.kind].w, h: closedPlacements[z.kind].h };
    return buildWorld(sizes, parkName, orientation);
  }, [closedPlacements, parkName, orientation]);
  // The open lawn's own layout, drawn bigger over its spot.
  const openPlacement = useMemo(() => (openLawn ? placeLawn(openLawn, groupCounts[openLawn], true, openGroup) : null), [openLawn, openGroup, groupCounts]);
  // The open lawn is drawn inside the fence: moved in from the edge, and scaled down when it could not fit.
  const openFrame = useMemo(() => {
    if (!openLawn || !openPlacement) return null;
    const l = world.lawns[openLawn];
    const inset = world.fence + 30;
    const roomW = world.width - inset * 2;
    const roomH = world.height - inset * 2;
    const s = Math.min(1, roomW / openPlacement.w, roomH / openPlacement.h);
    const w = openPlacement.w * s;
    const h = openPlacement.h * s;
    const x = Math.min(world.width - inset - w / 2, Math.max(inset + w / 2, l.x));
    const y = Math.min(world.height - inset - h / 2, Math.max(inset + h / 2, l.y));
    return { x, y, s, w, h };
  }, [openLawn, openPlacement, world]);
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
      const fit = worldView(world, size, insets).k;
      const k = Math.min(MAX_ZOOM, Math.max(fit, c.k));
      // The open part of the screen (between the panels) never shows past the
      // fence: its edges stay inside the grounds, or the grounds sit centered
      // in it when they are smaller.
      const f = world.fence;
      const hw = size.w / 2 / k;
      const hh = size.h / 2 / k;
      const openW = (size.w - insets.right) / k;
      const openH = (size.h - insets.top - insets.bottom) / k;
      const fencedW = world.width - f * 2;
      const fencedH = world.height - f * 2;
      return {
        k,
        x: openW >= fencedW ? world.width / 2 + hw - openW / 2 : Math.min(world.width - f - hw + insets.right / k, Math.max(f + hw, c.x)),
        y: openH >= fencedH ? world.height / 2 + hh - insets.top / k - openH / 2 : Math.min(world.height - f - hh + insets.bottom / k, Math.max(f + hh - insets.top / k, c.y)),
      };
    },
    [size, world, insets],
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
      settled.current = true;
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
      flyTo: (kind, opts) => {
        if (!size) return;
        // A jump wins over the refit that closing a lawn would otherwise make.
        if (opts?.closing) skipRefit.current = true;
        if (!opts?.closing && kind === openLawn && openFrame) glide(fitView(openFrame.x, openFrame.y, openFrame.w * 1.08, openFrame.h * 1.08, size, insets));
        else glide(lawnView(world, kind, size, insets));
      },
      overview: () => {
        if (!size) return;
        glide(worldView(world, size, insets));
      },
      zoomBy: (f) => camRef.current && glide({ ...camRef.current, k: camRef.current.k * f }, 280),
    }),
    [size, world, glide, insets, openLawn, openFrame],
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
    if (!size) return;
    if (camRef.current && settled.current) return;
    // The first camera can only be chosen once the screen size is known, and is
    // chosen again when the panels over the map have been measured.
    const start = lawnView(world, startAt, size, insets);
    camRef.current = start;
    setCam(start);
  }, [size, world, startAt, insets]);

  // Whatever opens, fly to fit it: a lawn's categories, or one category's
  // things. When a lawn closes, fly back to it at its closed size.
  const opened = useRef<{ lawn: ThingKind | null; group: string | null }>({ lawn: null, group: null });
  useEffect(() => {
    if (!size || !camRef.current) return;
    const prev = opened.current;
    if (prev.lawn === openLawn && prev.group === openGroup) return;
    opened.current = { lawn: openLawn, group: openGroup };
    if (!openLawn) {
      if (prev.lawn && !skipRefit.current) glide(lawnView(world, prev.lawn, size, insets));
      skipRefit.current = false;
      return;
    }
    skipRefit.current = false;
    if (!openFrame || !openPlacement) return;
    const f = openFrame;
    const plot = openGroup ? openPlacement.plots.find((p) => p.id === openGroup) : null;
    if (plot) {
      const px = f.x + plot.x * f.s;
      const py = f.y + plot.y * f.s;
      const fit = fitView(px, py, plot.w * f.s * 1.12, plot.h * f.s * 1.12 + 40, size, insets);
      if (fit.k >= 0.6) glide(fit);
      else {
        // Too much to fit at a readable size: show the top of it close enough to read, and let the person pan.
        const k = 0.6;
        const openW = Math.max(160, size.w - insets.right);
        const openH = Math.max(200, size.h - insets.top - insets.bottom);
        const topY = py - (plot.h * f.s) / 2;
        glide({ k, x: px - (openW / 2 - size.w / 2) / k, y: topY + openH / 2 / k - 30 - (insets.top + openH / 2 - size.h / 2) / k });
      }
    } else glide(fitView(f.x, f.y, f.w * 1.08, f.h * 1.08, size, insets));
  }, [openLawn, openGroup, world, openPlacement, openFrame, size, glide, insets]);

  // A picked thing slides into the open part of the screen, so its card never covers it.
  useEffect(() => {
    if (!selectedThing || !openLawn || !openPlacement || !openFrame || !size || !camRef.current) return;
    const f = openFrame;
    for (const plot of openPlacement.plots) {
      const group = groups[openLawn].find((g) => g.id === plot.id);
      if (!group) continue;
      const i = (plot.open ? group.things : group.things.slice(0, plot.spots.length)).findIndex((t) => t.id === selectedThing);
      if (i < 0) continue;
      const s = plot.spots[i];
      const c = camRef.current;
      const openW = Math.max(160, size.w - insets.right);
      const openH = Math.max(200, size.h - insets.top - insets.bottom);
      glide({ k: c.k, x: f.x + (plot.x + s.x) * f.s - (openW / 2 - size.w / 2) / c.k, y: f.y + (plot.y + s.y) * f.s - (insets.top + openH / 2 - size.h / 2) / c.k }, 400);
      return;
    }
  }, [selectedThing, openLawn, openPlacement, openFrame, groups, size, insets, glide]);

  // Tell the parent which lawn is in the middle of the open space as the map moves.
  useEffect(() => {
    if (!cam || !onCenterLawn || !size) return;
    const open = Math.max(200, size.h - insets.top - insets.bottom);
    const midY = cam.y + (insets.top + open / 2 - size.h / 2) / cam.k;
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
  }, [cam, world, onCenterLawn, startAt, size, insets]);

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
    settled.current = true;
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
  // Zoomed out, signs grow in half steps so they still read, like labels on a map.
  const signScale = k < 0.4 ? Math.min(2.6, Math.max(1, Math.round((0.4 / k) * 2) / 2)) : 1;
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
      // Looked up at the moment of the tap, so it is never stale.
      emptyAction: (z: Zone) => handlers.current.emptyAction(z)?.(),
    }),
    [],
  );
  // Which empty lawns have something to offer can change (say, once Google is connected).
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
            <pattern id="meadow2" width="71" height="97" patternUnits="userSpaceOnUse" patternTransform="rotate(23)">
              <path d="M14 60 l2 -7 l2 7 M52 22 l2 -7 l2 7 M40 84 l2 -6 l2 6" fill="none" stroke="#bfd8ad" strokeWidth={1.5} strokeLinecap="round" />
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
              groups={groups}
              openLawn={openLawn}
              openPlacement={openPlacement}
              openFrame={openFrame}
              closedPlacements={closedPlacements}
              byKind={byKind}
              now={now}
              lod={lod}
              signScale={signScale}
              parkName={parkName}
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
  groups: Record<ThingKind, Group[]>;
  openLawn: ThingKind | null;
  openPlacement: Placement | null;
  openFrame: { x: number; y: number; s: number; w: number; h: number } | null;
  closedPlacements: Record<ThingKind, Placement>;
  byKind: Map<ThingKind, ParkThing[]>;
  now: number;
  lod: Lod;
  signScale: number;
  parkName: string;
  selectedThing: string | null;
  emptyKinds: string;
  onSelectLawn: (kind: ThingKind) => void;
  onOpenGroup: (kind: ThingKind, id: string | null) => void;
  onSelectThing: (thing: ParkThing) => void;
  emptyAction: (zone: Zone) => void;
};

const curveD = (c: Curve) => `M${c.p.x} ${c.p.y} Q${c.c.x} ${c.c.y} ${c.q.x} ${c.q.y}`;

/** Everything in the park, in map units. Memoized: moving the camera never redraws it. */
const Scene = memo(function Scene({ world, groups, openLawn, openPlacement, openFrame, closedPlacements, byKind, now, lod, signScale, parkName, selectedThing, emptyKinds, onSelectLawn, onOpenGroup, onSelectThing, emptyAction }: SceneProps) {
  const far = lod === "far";
  const fenceD = (() => {
    const i = world.fence;
    const gap = world.gate.w + 24;
    return `M${world.gate.x + gap / 2} ${world.height - i} H${world.width - i - 40} Q${world.width - i} ${world.height - i} ${world.width - i} ${world.height - i - 40} V${i + 40} Q${world.width - i} ${i} ${world.width - i - 40} ${i} H${i + 40} Q${i} ${i} ${i} ${i + 40} V${world.height - i - 40} Q${i} ${world.height - i} ${i + 40} ${world.height - i} H${world.gate.x - gap / 2}`;
  })();

  /** One lawn: its outline, landmark, sign, and, if it is the open one, its plots. */
  const lawn = (z: Zone, open: boolean) => {
    const l = world.lawns[z.kind];
    const items = byKind.get(z.kind) ?? [];
    const n = items.length;
    const place = open && openPlacement ? openPlacement : closedPlacements[z.kind];
    const outline = lawnPath(0, 0, place.w, place.h, hash(z.kind));
    const hedge = lawnPath(0, 0, place.w - 30, place.h - 30, hash(z.kind));
    const offers = n === 0 && emptyKinds.split(",").includes(z.kind);
    const toggle = () => onSelectLawn(z.kind);
    const act = offers ? () => emptyAction(z) : undefined;
    const scale = Math.min(signScale, (l.w * 0.9) / signWidth(z, n));
    const signY = place.signY - (scale - 1) * 30;
    const lawnGroups = groups[z.kind];
    const { dx, dy } = spacingOf(z.kind);
    const hit = Math.min(40, dx / 2, dy / 2);
    return (
      <g key={z.kind} data-zone={z.kind} data-stage={stageOf(n)} data-open={open || undefined} transform={open && openFrame ? `translate(${openFrame.x} ${openFrame.y}) scale(${openFrame.s})` : `translate(${l.x} ${l.y})`}>
        {open && <path d={outline} fill={INK} opacity={0.14} transform="translate(0 14)" />}
        {/* Only the sign and the landmark open a lawn; the grass itself does nothing once it is open. */}
        <g onClick={open ? undefined : n > 0 ? toggle : act} className={!open && (n > 0 || offers) ? "cursor-pointer" : undefined}>
          <path d={outline} fill={n > 0 ? LAWN : LAWN_EMPTY} />
          {n > 0 && <path d={outline} fill="url(#mowed)" />}
          {/* One clipped hedge just inside the edge: a solid band with a lighter top, faded on an empty lawn. */}
          <g opacity={n > 0 ? 1 : 0.45}>
            <path d={hedge} fill="none" stroke={HEDGE} strokeWidth={12} />
            <path d={hedge} fill="none" stroke="#8fd69c" strokeWidth={3} strokeDasharray="6 9" strokeLinecap="round" transform="translate(0 -3)" />
          </g>
          <path d={outline} fill="none" stroke={INK} strokeWidth={1.6} opacity={0.55} />
          <g transform={`translate(0 ${place.landmarkY})`} opacity={n > 0 ? 1 : 0.55} aria-hidden="true" onClick={open ? toggle : undefined} className={open ? "cursor-pointer" : undefined}>
            <Landmark kind={z.kind} />
          </g>
        </g>

        {/* Closed: a glimpse of what is here, arranged as it would be, below the landmark. */}
        {!open && place.glimpse.length > 0 && (
          <g>
            <g aria-hidden="true" pointerEvents="none">
              <RowDressing kind={z.kind} rows={place.glimpseRows} />
            </g>
            {items.slice(0, place.glimpse.length).map((t, i) => {
              const s = place.glimpse[i];
              const pick = () => onSelectThing(t);
              return (
                <g
                  key={t.id}
                  transform={`translate(${s.x} ${s.y})`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${t.title}, ${z.one}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    pick();
                  }}
                  onKeyDown={activate(pick)}
                  className="park-thing cursor-pointer"
                >
                  <circle r={hit} fill="transparent" />
                  {selectedThing === t.id && <circle r={hit + 8} fill="#fffaf0" opacity={0.6} stroke={INK} strokeWidth={2.4} strokeDasharray="8 6" />}
                  <Figure t={t} now={now} i={i} />
                </g>
              );
            })}
          </g>
        )}

        {n > 0 ? (
          <g
            role="button"
            tabIndex={0}
            aria-label={`${z.name}: ${countLabel(z, n)}. ${open ? "Close it." : "Open it."}`}
            aria-expanded={open}
            onClick={toggle}
            onKeyDown={activate(toggle)}
            className="park-sign cursor-pointer"
          >
            <Sign z={z} n={n} y={signY} scale={scale} brief={far} />
          </g>
        ) : act ? (
          <g role="button" tabIndex={0} aria-label={`${z.name}: ${z.sign}`} onClick={act} onKeyDown={activate(act)} className="park-sign cursor-pointer" opacity={0.75}>
            <Sign z={z} n={0} y={signY} scale={scale} brief={far} />
          </g>
        ) : (
          <g opacity={0.75}>
            <Sign z={z} n={0} y={signY} scale={scale} brief={far} />
          </g>
        )}

        {/* Open: a plot per category, with a few of its things, or all of them once it is opened too. */}
        {open &&
          place.plots.map((plot) => {
            const group = lawnGroups.find((g) => g.id === plot.id);
            if (!group) return null;
            const shown = plot.open ? group.things : group.things.slice(0, plot.spots.length);
            const toggleGroup = () => onOpenGroup(z.kind, plot.open ? null : plot.id);
            const bed = lawnPath(0, 0, plot.w, plot.h, hash(plot.id), 16, 0.03);
            // Names only where they can be read: on an open plot up close, on a sample only closer still. Files show theirs when picked.
            const tags = !far && (plot.open ? lod !== "mid" : lod === "close");
            const tagLayer: { key: string; el: ReactNode }[] = [];
            return (
              <g key={plot.id} transform={`translate(${plot.x} ${plot.y})`} data-plot={plot.id} data-open={plot.open || undefined}>
                <path d={bed} fill={PLOT} stroke={PATH_EDGE} strokeWidth={6} />
                <path d={bed} fill="none" stroke={INK} strokeWidth={1.6} opacity={0.6} />
                <g aria-hidden="true" pointerEvents="none">
                  <RowDressing kind={z.kind} rows={plot.rows} />
                </g>
                <g transform={`translate(0 ${plot.signY}) scale(${signScale})`}>
                  <g
                    role="button"
                    tabIndex={0}
                    aria-label={`${group.name}: ${countLabel(z, group.things.length)}. ${plot.open ? "Close it." : "Open it."}`}
                    aria-expanded={plot.open}
                    onClick={toggleGroup}
                    onKeyDown={activate(toggleGroup)}
                    className="park-sign cursor-pointer"
                  >
                    <PlotSign name={group.name} n={group.things.length} open={plot.open} accent={z.accent} maxW={plot.w} />
                  </g>
                </g>
                {shown.map((t, i) => {
                  const s = plot.spots[i];
                  if (!s) return null;
                  const pick = () => onSelectThing(t);
                  const picked = selectedThing === t.id;
                  if ((tags && z.kind !== "file") || picked) {
                    tagLayer.push({
                      key: t.id,
                      el: (
                        <g key={t.id} transform={`translate(${s.x} ${s.y})`}>
                          <NameTag text={t.title} y={34} maxW={picked ? 160 : dx * 0.96} />
                        </g>
                      ),
                    });
                  }
                  return (
                    <g
                      key={t.id}
                      transform={`translate(${s.x} ${s.y})`}
                      role="button"
                      tabIndex={0}
                      aria-label={`${t.title}, ${z.one}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        pick();
                      }}
                      onKeyDown={activate(pick)}
                      className="park-thing cursor-pointer"
                    >
                      <g className="park-item" style={{ animationDelay: `${Math.min(i * 30, 1200)}ms` }}>
                        <circle r={hit} fill="transparent" />
                        {picked && <circle r={hit + 8} fill="#fffaf0" opacity={0.6} stroke={INK} strokeWidth={2.4} strokeDasharray="8 6" />}
                        <Figure t={t} now={now} i={i} />
                      </g>
                    </g>
                  );
                })}
                {/* Names go on after every figure, so no house covers its neighbor's name; the picked one last of all. */}
                <g pointerEvents="none">{tagLayer.sort((a, b) => Number(a.key === selectedThing) - Number(b.key === selectedThing)).map((t) => t.el)}</g>
              </g>
            );
          })}
      </g>
    );
  };

  return (
    <>
      <rect x={-2000} y={-2000} width={world.width + 4000} height={world.height + 4000} fill={MEADOW} />
      {/* Soft darker patches keep the meadow from looking flat. */}
      {Array.from({ length: 14 }, (_, i) => {
        const h = hash(`patch${i}`);
        const f = world.fence + 80;
        return <ellipse key={i} cx={f + ((h % 1000) / 1000) * (world.width - 2 * f)} cy={f + (((h >>> 10) % 1000) / 1000) * (world.height - 2 * f)} rx={160 + (h % 160)} ry={100 + ((h >>> 5) % 100)} fill={MEADOW_DARK} opacity={0.55} />;
      })}
      <rect x={-2000} y={-2000} width={world.width + 4000} height={world.height + 4000} fill="url(#meadow)" />
      <rect x={-2000} y={-2000} width={world.width + 4000} height={world.height + 4000} fill="url(#meadow2)" />

      {/* A low picket fence around the grounds, open at the gate. */}
      <g fill="none" aria-hidden="true" pointerEvents="none">
        <path d={fenceD} stroke="#e6d6ad" strokeWidth={10} strokeLinecap="round" />
        <path d={fenceD} stroke="#b9814a" strokeWidth={3} />
        <path d={fenceD} stroke="#8a5a2b" strokeWidth={7} strokeDasharray="4 30" strokeLinecap="round" />
      </g>

      {/* Walkways: a darker edge under gravel, between the lawns' entrances and in from the gate. */}
      {[PATH_EDGE, PATH, "url(#gravel)"].map((color, layer) => (
        <g key={layer} fill="none" stroke={color} strokeWidth={layer === 0 ? 50 : 40} strokeLinecap="round">
          {world.paths.map((c, i) => (
            <path key={i} d={curveD(c)} />
          ))}
        </g>
      ))}

      {/* The stream first, then the lake and the duck pond over its ends, each with a sandy shore. */}
      <path d={streamPath(world.stream)} fill="none" stroke={SHORE} strokeWidth={44} strokeLinecap="round" />
      <path d={streamPath(world.stream)} fill="none" stroke={WATER} strokeWidth={30} strokeLinecap="round" />
      <path d={streamPath(world.stream)} fill="none" stroke="#c7e4f3" strokeWidth={4} strokeLinecap="round" strokeDasharray="14 26" opacity={0.8} />
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
      {world.bridges.map((b, i) => (
        <g key={i} transform={`translate(${b.x} ${b.y})`} aria-hidden="true" pointerEvents="none">
          <Bridge a={b.a} />
        </g>
      ))}

      {/* Every closed lawn (faded where the open lawn will cover it), then everything standing on the meadow, back to front. */}
      {zones
        .filter((z) => z.kind !== openLawn)
        .map((z) => {
          const under = openFrame
            ? Math.abs(world.lawns[z.kind].x - openFrame.x) < (world.lawns[z.kind].w + openFrame.w) / 2 && Math.abs(world.lawns[z.kind].y - openFrame.y) < (world.lawns[z.kind].h + openFrame.h) / 2
            : false;
          return under ? (
            <g key={z.kind} opacity={0.2}>
              {lawn(z, false)}
            </g>
          ) : (
            lawn(z, false)
          );
        })}
      {[
        ...world.decor.filter((d) => !far || (d.kind !== "flowers" && d.kind !== "rock")).map((d) => ({ y: d.y, x: d.x, el: <DecorFigure kind={d.kind} s={d.s} m={d.m} c={d.c} /> })),
        ...(far ? [] : world.lamps.map((l) => ({ y: l.y, x: l.x, el: <g transform="scale(0.78)"><Lamp /></g> }))),
        ...world.furniture.filter((f) => !far || f.kind !== "bench").map((f) => ({ y: f.y, x: f.x, el: <FurnitureFigure f={f} /> })),
        { y: world.gate.y, x: world.gate.x, el: <Gate name={parkName} w={world.gate.w} brief={far} /> },
      ]
        .sort((a, b) => a.y - b.y)
        .map((d, i) => (
          <g key={i} transform={`translate(${d.x} ${d.y})`} aria-hidden="true" pointerEvents="none">
            {d.el}
          </g>
        ))}

      {/* The open lawn last, over everything, with the rest of the park quieted under it. */}
      {openLawn && (
        <>
          <rect x={-2000} y={-2000} width={world.width + 4000} height={world.height + 4000} fill="#fffaf0" opacity={0.45} pointerEvents="none" />
          {lawn(zones.find((z) => z.kind === openLawn)!, true)}
        </>
      )}
    </>
  );
});
