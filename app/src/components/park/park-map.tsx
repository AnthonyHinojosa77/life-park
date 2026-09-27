"use client";

import {
  forwardRef,
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
import { blobPath, buildWorld, countLabel, hash, itemSpot, stageOf, zones, type World, type Zone } from "@/lib/park/layout";
import type { ParkThing } from "@/lib/things";
import { countByKind } from "@/lib/kinds";
import { DecorFigure, Figure, INK } from "./park-figures";

type Props = {
  things: ParkThing[];
  /** The current time, from the parent, so drawing stays predictable. */
  now: number;
  /** The lawn to show first. */
  startAt: ThingKind;
  selectedLawn: ThingKind | null;
  selectedThing: string | null;
  onSelectLawn: (kind: ThingKind) => void;
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
const PATH = "#efe3c4";
const PATH_EDGE = "#dccb9f";
const MAX_ZOOM = 2.6;

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Screen space taken by the panels floating over the map's top and bottom edges. */
const INSET_TOP = 124;
const INSET_BOTTOM = 92;

function lawnView(world: World, kind: ThingKind, w: number, h: number): Camera {
  const l = world.lawns[kind];
  // One lawn fills the open space between the floating panels, with a little meadow around it.
  const open = Math.max(200, h - INSET_TOP - INSET_BOTTOM);
  const k = Math.min(MAX_ZOOM, Math.min(w, open) / (l.r * 2.2));
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
function Sign({ z, n, x, y }: { z: Zone; n: number; x: number; y: number }) {
  const title = z.name;
  const sub = n > 0 ? countLabel(z, n) : z.sign;
  const w = Math.max(title.length * 15, sub.length * 8.6) + 44;
  return (
    <g transform={`translate(${x} ${y})`}>
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
  { things, now, startAt, selectedLawn, selectedThing, onSelectLawn, onSelectThing, emptyAction, onCenterLawn },
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
  const world = useMemo(() => buildWorld(counts), [counts]);
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
  const close = k >= 0.42;
  const summary = zones.map((z) => countLabel(z, counts[z.kind])).join(", ");

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
            <clipPath id="picnic-clip">
              <path d="M-38 -22 L36 -24 L38 22 L-36 24 Z" />
            </clipPath>
          </defs>
          <g transform={`translate(${size.w / 2 - cam.x * k} ${size.h / 2 - cam.y * k}) scale(${k})`}>
            <rect x={-2000} y={-2000} width={world.width + 4000} height={world.height + 4000} fill={MEADOW} />
            <rect x={-2000} y={-2000} width={world.width + 4000} height={world.height + 4000} fill="url(#meadow)" />

            {/* Paths between lawns: a darker edge under a cream walkway. */}
            {[PATH_EDGE, PATH].map((color, layer) => (
              <g key={color} fill="none" stroke={color} strokeWidth={layer === 0 ? 50 : 40} strokeLinecap="round">
                {world.paths.map(([a, b]) => {
                  const p = world.lawns[a];
                  const q = world.lawns[b];
                  const bend = ((hash(a + b) % 60) - 30) / 220;
                  const mx = (p.x + q.x) / 2 + (q.y - p.y) * bend;
                  const my = (p.y + q.y) / 2 - (q.x - p.x) * bend;
                  return <path key={a + b} d={`M${p.x} ${p.y} Q${mx} ${my} ${q.x} ${q.y}`} />;
                })}
              </g>
            ))}

            {world.ponds.map((p, i) => (
              <g key={i} aria-hidden="true">
                <ellipse cx={p.x} cy={p.y} rx={p.rx + 8} ry={p.ry + 7} fill="#b9d3a6" />
                <ellipse cx={p.x} cy={p.y} rx={p.rx} ry={p.ry} fill="#bcdcef" stroke="#8fbcd6" strokeWidth={3} />
                <path d={`M${p.x - 44} ${p.y - 8} q8 -6 16 0 t16 0 M${p.x + 6} ${p.y + 14} q8 -6 16 0 t16 0`} fill="none" stroke="#8fbcd6" strokeWidth={2} />
                <g className="park-duck">
                  <ellipse cx={p.x - 6} cy={p.y + 2} rx={11} ry={7} fill="#fffaf0" stroke={INK} strokeWidth={1.6} />
                  <circle cx={p.x + 4} cy={p.y - 6} r={5} fill="#fffaf0" stroke={INK} strokeWidth={1.6} />
                  <path d={`M${p.x + 8} ${p.y - 7} l6 1.5 l-6 1.5`} fill="#efb33e" stroke={INK} strokeWidth={0.8} />
                </g>
              </g>
            ))}

            {world.decor.map((d, i) => (
              <g key={i} transform={`translate(${d.x} ${d.y})`} aria-hidden="true" pointerEvents="none">
                <DecorFigure kind={d.kind} s={d.s} />
              </g>
            ))}

            {zones.map((z) => {
              const l = world.lawns[z.kind];
              const items = byKind.get(z.kind) ?? [];
              const n = items.length;
              const outline = blobPath(l.x, l.y, l.r, hash(z.kind));
              const signY = l.y - l.r + 44;
              const selected = selectedLawn === z.kind;
              const action = n === 0 ? emptyAction(z) : null;
              const open = () => onSelectLawn(z.kind);
              return (
                <g key={z.kind} data-zone={z.kind} data-stage={stageOf(n)}>
                  <g onClick={n > 0 ? open : action ?? undefined} className={n > 0 || action ? "cursor-pointer" : undefined}>
                    <path d={outline} fill={n > 0 ? LAWN : "#cfe6c4"} stroke={LAWN_EDGE} strokeWidth={5} strokeDasharray={n > 0 ? undefined : "18 14"} />
                    {n > 0 && <path d={outline} fill="url(#mowed)" />}
                    {selected && <path d={outline} fill="none" stroke={INK} strokeWidth={5} filter="url(#chalk-line)" />}
                  </g>

                  {!close ? null : n > 0 ? (
                    <g
                      role="button"
                      tabIndex={0}
                      aria-label={`${z.name}: ${countLabel(z, n)}. Open the list.`}
                      aria-pressed={selected}
                      onClick={open}
                      onKeyDown={activate(open)}
                      className="cursor-pointer outline-none"
                    >
                      <Sign z={z} n={n} x={l.x} y={signY} />
                    </g>
                  ) : action ? (
                    <g role="button" tabIndex={0} aria-label={`${z.name}: ${z.sign}`} onClick={action} onKeyDown={activate(action)} className="park-sign cursor-pointer outline-none">
                      <Sign z={z} n={0} x={l.x} y={l.y - 10} />
                    </g>
                  ) : (
                    <Sign z={z} n={0} x={l.x} y={l.y - 10} />
                  )}

                  {close &&
                    items.map((t, i) => {
                      const s = itemSpot(i);
                      const x = l.x + s.x;
                      const y = l.y + s.y;
                      const pick = () => onSelectThing(t);
                      return (
                        <g
                          key={t.id}
                          transform={`translate(${x} ${y})`}
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
                          <g className="park-item" style={{ animationDelay: `${Math.min(i * 45, 1200)}ms` }}>
                            <circle r={56} fill="transparent" />
                            {selectedThing === t.id && <circle r={62} fill="#fffaf0" opacity={0.6} stroke={INK} strokeWidth={2.4} strokeDasharray="8 6" />}
                            <g transform="scale(1.3)">
                              <Figure t={t} now={now} i={i} />
                            </g>
                          </g>
                          {k >= 0.5 && <NameTag text={t.title} y={46} />}
                        </g>
                      );
                    })}

                  {/* Zoomed far out, each lawn shows a big, readable name instead of its details. */}
                  {!close && (
                    <text x={l.x} y={l.y + Math.min(8 / k, l.r * 0.12)} textAnchor="middle" className="font-serif" fontSize={Math.min(20 / k, l.r * 0.3)} fill={INK} pointerEvents="none">
                      {z.name}
                      {n > 0 && <tspan fontSize={Math.min(13 / k, l.r * 0.2)} fontWeight={800} fontFamily="var(--font-sans)" fill={z.accent}>{`  ${n}`}</tspan>}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      )}
    </div>
  );
});
