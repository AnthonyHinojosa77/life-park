"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import type { ThingKind } from "@/lib/kinds";
import {
  blobPath,
  countLabel,
  fit,
  hash,
  landmarks,
  lawnRadius,
  paths,
  stageOf,
  worlds,
  zones,
  type WorldShape,
  type Zone,
} from "@/lib/park/layout";
import type { ParkThing } from "@/lib/things";

type Props = {
  things: ParkThing[];
  /** The current time, from the parent, so drawing stays predictable. */
  now: number;
  shape: WorldShape;
  selectedLawn: ThingKind | null;
  selectedThing: string | null;
  onSelectLawn: (kind: ThingKind) => void;
  onSelectThing: (thing: ParkThing) => void;
  /** What an empty lawn's sign does: start a chat, or connect Google. Null means it is just a sign. */
  emptyAction: (zone: Zone) => (() => void) | null;
};

const INK = "#22332a";
const GRASS = "#cfe7d6";
const EDGE = "#8fc9a4";
const PATH = "#ece1c6";
const roofs = ["#e8594a", "#4a82de", "#f2c230", "#3e9e50", "#b36bd4", "#f08a3c"];
const walls = ["#fffdf8", "#f7e7c6", "#e9f1f7", "#fbe3dc"];
const brights = ["#e8594a", "#f2c230", "#4a82de", "#58c26a", "#b36bd4", "#f08a3c"];

const capacity: Record<ThingKind, number> = {
  person: 16,
  event: 16,
  habit: 6,
  recipe: 12,
  list: 8,
  note: 10,
  file: 20,
  mail: 16,
};

/** Each item's size at scale 1, used to fit a lawn's items inside it. */
const units: Record<ThingKind, { w: number; h: number }> = {
  person: { w: 34, h: 38 },
  event: { w: 24, h: 40 },
  habit: { w: 50, h: 38 },
  recipe: { w: 34, h: 42 },
  list: { w: 44, h: 44 },
  note: { w: 40, h: 30 },
  file: { w: 30, h: 34 },
  mail: { w: 30, h: 24 },
};

/** Newest first, except events: soonest upcoming first, then the most recent past ones. */
function ordered(kind: ThingKind, list: ParkThing[], now: number) {
  if (kind !== "event") return [...list].reverse();
  const time = (t: ParkThing) => (t.date ? Date.parse(t.date) : 0);
  const upcoming = list.filter((t) => time(t) >= now).sort((a, b) => time(a) - time(b));
  const past = list.filter((t) => time(t) < now).sort((a, b) => time(b) - time(a));
  return [...upcoming, ...past];
}

function soonBirthday(t: ParkThing, now: number) {
  const b = t.detail.birthday as { month: number; day: number } | null | undefined;
  if (!b) return false;
  const year = new Date(now).getFullYear();
  const next = new Date(year, b.month - 1, b.day);
  if (next.getTime() < now - 86400000) next.setFullYear(year + 1);
  return next.getTime() - now < 14 * 86400000;
}

const short = (s: string, n = 16) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** One item's drawing, centered on 0,0 at scale 1. */
function Figure({ t, now, i }: { t: ParkThing; now: number; i: number }): ReactNode {
  const h = hash(t.id);
  switch (t.kind) {
    case "person": {
      const roof = roofs[h % roofs.length];
      const wall = walls[(h >>> 3) % walls.length];
      return (
        <>
          <ellipse cx={0} cy={14} rx={15} ry={3} fill={INK} opacity={0.1} />
          <rect x={-11} y={-4} width={22} height={17} fill={wall} stroke={INK} strokeWidth={1.3} />
          <path d="M-14 -3 L0 -16 L14 -3 Z" fill={roof} stroke={INK} strokeWidth={1.3} strokeLinejoin="round" />
          <rect x={-3} y={4} width={6} height={9} fill={roof} opacity={0.8} />
          <rect x={-8.5} y={0} width={4} height={4} fill="#d7e9f2" stroke={INK} strokeWidth={0.6} />
          <rect x={4.5} y={0} width={4} height={4} fill="#d7e9f2" stroke={INK} strokeWidth={0.6} />
          {soonBirthday(t, now) && (
            <g className="park-sway">
              <line x1={10} y1={-4} x2={13} y2={-17} stroke={INK} strokeWidth={0.7} />
              <circle cx={13} cy={-20} r={3.5} fill="#e8594a" stroke={INK} strokeWidth={0.8} />
            </g>
          )}
        </>
      );
    }
    case "event": {
      const upcoming = t.date ? Date.parse(t.date) >= now : false;
      return (
        <>
          <ellipse cx={0} cy={17} rx={6} ry={2} fill={INK} opacity={0.12} />
          <line x1={-5} y1={17} x2={-5} y2={-17} stroke="#8a5a2b" strokeWidth={2} strokeLinecap="round" />
          <path
            d="M-4 -17 L12 -11 L-4 -5 Z"
            fill={brights[h % brights.length]}
            opacity={upcoming ? 1 : 0.45}
            stroke={INK}
            strokeWidth={1}
            strokeLinejoin="round"
            className={upcoming ? "park-sway" : undefined}
          />
        </>
      );
    }
    case "habit":
      return (
        <>
          <rect x={-22} y={-14} width={44} height={30} rx={6} fill="#a4744a" stroke={INK} strokeWidth={1.3} />
          {[-12, 0, 12].map((dx, k) => (
            <g key={dx}>
              <line x1={dx} y1={10} x2={dx} y2={-6} stroke="#3e9e50" strokeWidth={2} strokeLinecap="round" />
              <ellipse cx={dx - 4} cy={-3} rx={4} ry={2.4} fill="#58c26a" />
              <ellipse cx={dx + 4} cy={-7} rx={4} ry={2.4} fill="#58c26a" />
              {(h >>> k) % 2 === 0 && <circle cx={dx} cy={-9} r={2.4} fill="#f2c230" />}
            </g>
          ))}
        </>
      );
    case "recipe":
      // The mockup's three-lobed tree, with fruit.
      return (
        <>
          <ellipse cx={0} cy={18} rx={12} ry={3} fill={INK} opacity={0.12} />
          <rect x={-2.5} y={2} width={5} height={16} fill="#8a5a2b" />
          <circle cx={-7} cy={-2} r={9} fill="#58c26a" stroke={INK} strokeWidth={1.1} />
          <circle cx={7} cy={-2} r={9} fill="#58c26a" stroke={INK} strokeWidth={1.1} />
          <circle cx={0} cy={-11} r={10} fill="#58c26a" stroke={INK} strokeWidth={1.1} />
          <circle cx={-3} cy={-14} r={3.5} fill="#7fd48d" />
          {[0, 1, 2].map((k) => {
            const a = (hash(t.id + k) % 360) * (Math.PI / 180);
            return <circle key={k} cx={Math.cos(a) * 8} cy={-5 + Math.sin(a) * 6} r={2.4} fill="#e8594a" />;
          })}
        </>
      );
    case "list": {
      const color = brights[h % brights.length];
      const count = Array.isArray(t.detail.items) ? Math.min((t.detail.items as unknown[]).length, 5) : 0;
      return (
        <>
          <g transform={`rotate(${(h % 14) - 7})`}>
            <rect x={-16} y={-16} width={32} height={32} fill="#fffdf8" stroke={INK} strokeWidth={1.3} />
            <g fill={color} opacity={0.8}>
              <rect x={-16} y={-16} width={16} height={16} />
              <rect x={0} y={0} width={16} height={16} />
            </g>
          </g>
          <rect x={6} y={6} width={14} height={9} rx={2} fill="#c88a4a" stroke={INK} strokeWidth={1} />
          <path d="M8 6 Q13 -1 18 6" fill="none" stroke={INK} strokeWidth={1} />
          {Array.from({ length: count }, (_, k) => (
            <circle key={k} cx={-14 + k * 5} cy={20} r={2} fill="#e8594a" />
          ))}
        </>
      );
    }
    case "note":
      return (
        <>
          <rect x={-15} y={-2} width={30} height={5} rx={1.5} fill="#b07a45" stroke={INK} strokeWidth={1.1} />
          <rect x={-15} y={-9} width={30} height={4} rx={1.5} fill="#b07a45" stroke={INK} strokeWidth={1.1} />
          <line x1={-12} y1={3} x2={-12} y2={10} stroke={INK} strokeWidth={1.6} />
          <line x1={12} y1={3} x2={12} y2={10} stroke={INK} strokeWidth={1.6} />
          <rect x={-5} y={-15} width={10} height={6} fill="#fffdf8" stroke={INK} strokeWidth={0.9} />
        </>
      );
    case "file": {
      // The mockup's pavilion: every file is a small building of its own.
      const roof = t.detail.type === "doc" ? "#4a82de" : t.detail.type === "sheet" ? "#3e9e50" : "#f2c230";
      return (
        <>
          <ellipse cx={0} cy={13} rx={13} ry={2.5} fill={INK} opacity={0.1} />
          <rect x={-10} y={-3} width={20} height={16} fill="#fffdf8" stroke={INK} strokeWidth={1.3} />
          <path d="M-13 -2 L0 -14 L13 -2 Z" fill={roof} stroke={INK} strokeWidth={1.3} strokeLinejoin="round" />
          <rect x={-3} y={4} width={6} height={9} fill={INK} opacity={0.8} />
        </>
      );
    }
    case "mail":
      return (
        <g transform={`rotate(${(i % 3) * 5 - 5})`}>
          <rect x={-12} y={-8} width={24} height={16} fill="#fffdf8" stroke={INK} strokeWidth={1} />
          <path d="M-12 -8 L0 1 L12 -8" fill="none" stroke={INK} strokeWidth={1} />
          <rect x={6} y={-6} width={4} height={4} fill="#e8594a" />
        </g>
      );
  }
}

const activate = (fn: () => void) => (e: KeyboardEvent) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fn();
  }
};

/** A lawn and everything planted on it. */
function Lawn({
  z,
  items,
  shape,
  now,
  selected,
  selectedThing,
  onSelect,
  onSelectThing,
  emptyAction,
}: {
  z: Zone;
  items: ParkThing[];
  shape: WorldShape;
  now: number;
  selected: boolean;
  selectedThing: string | null;
  onSelect: () => void;
  onSelectThing: (t: ParkThing) => void;
  emptyAction: (() => void) | null;
}) {
  const { x: cx, y: cy } = z[shape];
  const n = items.length;
  const r = lawnRadius(n);
  const outline = blobPath(cx, cy, r, hash(z.kind));
  const labelY = cy - r * 0.94 - 14;
  const labelX = cx - r * 0.7;

  if (n === 0) {
    const words = z.sign.split(" ");
    const half = Math.ceil(words.length / 2);
    const lines = z.sign.length > 14 ? [words.slice(0, half).join(" "), words.slice(half).join(" ")] : [z.sign];
    const bh = lines.length === 2 ? 34 : 22;
    const sign = (
      <g className="park-sign">
        <path d={outline} fill={GRASS} opacity={0.45} stroke={EDGE} strokeWidth={2} strokeDasharray="7 6" />
        <line x1={cx} y1={cy} x2={cx} y2={cy + 30} stroke="#8a5a2b" strokeWidth={3} strokeLinecap="round" />
        <rect x={cx - 52} y={cy - bh / 2 - 8} width={104} height={bh} rx={4} fill="#f3e2b8" stroke={INK} strokeWidth={1.3} />
        {lines.map((line, k) => (
          <text key={k} x={cx} y={cy - bh / 2 + 5 + k * 13} textAnchor="middle" className="font-hand" fontSize={12} fill={INK}>
            {line}
          </text>
        ))}
      </g>
    );
    return (
      <g data-zone={z.kind} data-stage="empty">
        <text x={labelX} y={labelY} className="font-serif" fontSize={17} fill="#7a7362">
          {z.name}
        </text>
        {emptyAction ? (
          <g
            role="button"
            tabIndex={0}
            aria-label={`${z.name}: ${z.sign}`}
            onClick={emptyAction}
            onKeyDown={activate(emptyAction)}
            className="cursor-pointer outline-none"
          >
            {sign}
          </g>
        ) : (
          sign
        )}
      </g>
    );
  }

  const list = ordered(z.kind, items, now);
  // Items sit in the box inside the lawn's outline.
  const box = { x: cx - r * 0.72, y: cy - r * 0.58, w: r * 1.44, h: r * 1.16 };
  const { cells, scale } = fit(box, n, capacity[z.kind], units[z.kind], 1.5);
  const labelled = n <= 4 && scale >= 0.8;
  // Names get the room between neighboring items, so they never run into each other.
  const sideBySide = cells.slice(1).flatMap((c, i) => (Math.abs(c.y - cells[i].y) < 1 ? [Math.abs(c.x - cells[i].x)] : []));
  const gap = sideBySide.length ? Math.min(...sideBySide) : box.w;
  const nameChars = Math.max(6, Math.floor(gap / 5.6));
  const chip = countLabel(z, n);
  const chipW = chip.length * 6.2 + 16;
  const nameW = z.name.length * 8.4;

  return (
    <g data-zone={z.kind} data-stage={stageOf(n)}>
      {/* Tapping open grass also opens the lawn; the name tag below is the labelled control. */}
      <g onClick={onSelect} className="cursor-pointer">
        <path d={outline} fill={GRASS} filter="url(#chalk-edge)" />
        <path d={outline} fill="url(#grass)" />
        <path d={outline} fill="none" stroke={EDGE} strokeWidth={2.5} />
        {selected && <path d={outline} fill="none" stroke={INK} strokeWidth={3.5} filter="url(#chalk-line)" />}
      </g>
      <g
        role="button"
        tabIndex={0}
        aria-label={`${z.name}: ${chip}. Open the list.`}
        aria-pressed={selected}
        onClick={onSelect}
        onKeyDown={activate(onSelect)}
        className="cursor-pointer outline-none"
      >
        <rect x={labelX - 4} y={labelY - 18} width={nameW + chipW + 16} height={24} fill="transparent" />
        <text x={labelX} y={labelY} className="font-serif" fontSize={18} fill={INK}>
          {z.name}
        </text>
        <g transform={`translate(${labelX + nameW + 8} ${labelY - 13})`}>
          <rect width={chipW} height={17} rx={8.5} fill="#ffe27a" stroke={INK} strokeWidth={1.1} />
          <text x={chipW / 2} y={12} textAnchor="middle" fontSize={10} fontWeight={800} fill="#6b4e00">
            {chip}
          </text>
        </g>
      </g>
      {cells.map((c, i) => {
        const t = list[i];
        const open = () => onSelectThing(t);
        return (
          <g
            key={t.id}
            transform={`translate(${c.x} ${c.y})`}
            role="button"
            tabIndex={0}
            aria-label={`${t.title}, ${z.one}`}
            onClick={(e) => {
              e.stopPropagation();
              open();
            }}
            onKeyDown={activate(open)}
            className="cursor-pointer outline-none"
          >
            <g transform={`scale(${scale})`}>
              <g className="park-item" style={{ animationDelay: `${Math.min(i * 40, 1100)}ms` }}>
                <circle r={22} fill="transparent" />
                {selectedThing === t.id && <circle r={24} fill="none" stroke={INK} strokeWidth={1.4} strokeDasharray="4 3" />}
                <Figure t={t} now={now} i={i} />
              </g>
            </g>
            {labelled && (
              <text y={units[z.kind].h * scale * 0.5 + 12} textAnchor="middle" fontSize={10} fontWeight={700} fill={INK}>
                {short(t.title, nameChars)}
              </text>
            )}
          </g>
        );
      })}
      {n > capacity[z.kind] && (
        <text x={cx} y={cy + r * 0.9} textAnchor="middle" className="font-hand" fontSize={13} fill="#4b5550">
          {`+${n - capacity[z.kind]} more`}
        </text>
      )}
    </g>
  );
}

const MAX_ZOOM = 3;

/**
 * Someone's life drawn as a park map, after the Work Park design: organic lawns
 * joined by paths, a pond, a compass, and zoom. Each kind of thing has its lawn,
 * and a lawn grows as things are planted on it.
 */
export function ParkMap({ things, now, shape, selectedLawn, selectedThing, onSelectLawn, onSelectThing, emptyAction }: Props) {
  const world = worlds[shape];
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const drag = useRef<{ px: number; py: number; x: number; y: number; moved: boolean } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const byKind = new Map<ThingKind, ParkThing[]>();
  for (const t of things) byKind.set(t.kind, [...(byKind.get(t.kind) ?? []), t]);
  const summary = zones.map((z) => countLabel(z, byKind.get(z.kind)?.length ?? 0)).join(", ");
  const center = (kind: ThingKind) => zones.find((z) => z.kind === kind)![shape];
  const { pond, compass } = landmarks[shape];

  function clamp(k: number, x: number, y: number) {
    return {
      k,
      x: Math.min(0, Math.max(world.width * (1 - k), x)),
      y: Math.min(0, Math.max(world.height * (1 - k), y)),
    };
  }
  function zoom(factor: number) {
    setView((v) => {
      const k = Math.min(MAX_ZOOM, Math.max(1, v.k * factor));
      // Keep the middle of the view in the middle.
      const mx = (world.width / 2 - v.x) / v.k;
      const my = (world.height / 2 - v.y) / v.k;
      return clamp(k, world.width / 2 - mx * k, world.height / 2 - my * k);
    });
  }
  function toWorld(d: number) {
    const w = svgRef.current?.getBoundingClientRect().width || world.width;
    return (d * world.width) / w;
  }
  function down(e: PointerEvent) {
    if (view.k === 1) return;
    drag.current = { px: e.clientX, py: e.clientY, x: view.x, y: view.y, moved: false };
  }
  function move(e: PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.px;
    const dy = e.clientY - d.py;
    if (!d.moved && Math.hypot(dx, dy) < 5) return;
    d.moved = true;
    setView((v) => clamp(v.k, d.x + toWorld(dx), d.y + toWorld(dy)));
  }
  function up() {
    const moved = drag.current?.moved;
    drag.current = null;
    if (moved) {
      // Swallow the click that ends a drag, so dragging never opens anything.
      const stop = (ev: Event) => ev.stopPropagation();
      window.addEventListener("click", stop, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", stop, { capture: true }), 0);
    }
  }

  return (
    <div className="relative overflow-hidden rounded-card bg-[#f3eedf]">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${world.width} ${world.height}`}
        className="block h-auto w-full select-none"
        style={{ touchAction: view.k > 1 ? "none" : "pan-y" }}
        role="group"
        aria-label={`Your park: ${summary}.`}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerLeave={up}
      >
        <defs>
          <pattern id="grass" width="9" height="9" patternUnits="userSpaceOnUse">
            <path d="M2 7 l1 -3 M6 4 l1 -3" stroke={EDGE} strokeWidth={1} strokeLinecap="round" opacity={0.7} />
          </pattern>
          <pattern id="paper-dots" width="16" height="16" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill="#d9cbaa" opacity={0.55} />
          </pattern>
        </defs>
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          <rect width={world.width} height={world.height} fill="url(#paper-dots)" />

          {/* Paths between neighboring lawns, drawn first so lawns cover their ends. */}
          <g fill="none" stroke={PATH} strokeWidth={13} strokeLinecap="round" filter="url(#chalk-edge)">
            {paths[shape].map(([a, b]) => {
              const p = center(a);
              const q = center(b);
              const bend = ((hash(a + b) % 60) - 30) / 300;
              const mx = (p.x + q.x) / 2 + (q.y - p.y) * bend;
              const my = (p.y + q.y) / 2 - (q.x - p.x) * bend;
              return <path key={a + b} d={`M${p.x} ${p.y} Q${mx} ${my} ${q.x} ${q.y}`} />;
            })}
          </g>

          {/* The pond, with its duck. */}
          <g aria-hidden="true">
            <ellipse cx={pond.x} cy={pond.y} rx={54} ry={28} fill="#d7e9f2" stroke="#9dc3d8" strokeWidth={2.5} filter="url(#chalk-edge)" />
            <path
              d={`M${pond.x - 30} ${pond.y - 5} q6 -4 12 0 t12 0 M${pond.x + 6} ${pond.y + 10} q6 -4 12 0 t12 0`}
              fill="none"
              stroke="#9dc3d8"
              strokeWidth={1.5}
            />
            <g className="park-duck">
              <ellipse cx={pond.x - 4} cy={pond.y} rx={6} ry={3.8} fill="#fffdf8" stroke={INK} strokeWidth={0.9} />
              <circle cx={pond.x + 1} cy={pond.y - 4} r={2.8} fill="#fffdf8" stroke={INK} strokeWidth={0.9} />
              <path d={`M${pond.x + 3.5} ${pond.y - 4.8} l3.5 0.8 l-3.5 0.8`} fill="#f2c230" />
            </g>
          </g>

          {zones.map((z) => (
            <Lawn
              key={z.kind}
              z={z}
              items={byKind.get(z.kind) ?? []}
              shape={shape}
              now={now}
              selected={selectedLawn === z.kind}
              selectedThing={selectedThing}
              onSelect={() => onSelectLawn(z.kind)}
              onSelectThing={onSelectThing}
              emptyAction={emptyAction(z)}
            />
          ))}

          {/* Clouds drift over the park. Decorative only. */}
          <g aria-hidden="true" opacity={0.85} pointerEvents="none">
            <g className="park-cloud">
              <ellipse cx={0} cy={world.height * 0.3} rx={30} ry={10} fill="#fffdf8" />
              <ellipse cx={16} cy={world.height * 0.3 - 6} rx={18} ry={10} fill="#fffdf8" />
            </g>
            <g className="park-cloud park-cloud-slow">
              <ellipse cx={0} cy={world.height * 0.72} rx={26} ry={9} fill="#fffdf8" />
              <ellipse cx={-14} cy={world.height * 0.72 - 5} rx={15} ry={9} fill="#fffdf8" />
            </g>
          </g>
        </g>

        {/* The compass stays put while the map moves. */}
        <g aria-hidden="true" transform={`translate(${compass.x} ${compass.y})`}>
          <circle r={20} fill="#fffdf8" stroke={INK} strokeWidth={1.5} />
          <path d="M0 -15 L5 0 L0 15 L-5 0 Z" fill="#3e9e50" stroke={INK} strokeWidth={1} />
          <path d="M0 -15 L5 0 L-5 0 Z" fill={INK} />
        </g>
      </svg>

      <div className="absolute right-3 bottom-3 flex flex-col overflow-hidden rounded-chip border-2 border-ink bg-card">
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => zoom(1.5)}
          disabled={view.k >= MAX_ZOOM}
          className="px-3 py-1 text-lg font-bold disabled:opacity-40"
        >
          +
        </button>
        <span className="h-0.5 bg-ink" />
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => zoom(1 / 1.5)}
          disabled={view.k <= 1}
          className="px-3 py-1 text-lg font-bold disabled:opacity-40"
        >
          −
        </button>
      </div>
    </div>
  );
}
