"use client";

import type { KeyboardEvent, ReactNode } from "react";
import type { ThingKind } from "@/lib/kinds";
import { PARK_HEIGHT, PARK_WIDTH, countLabel, fit, hash, stageOf, zones, type Zone } from "@/lib/park/layout";
import type { ParkThing } from "@/lib/things";

type Props = {
  things: ParkThing[];
  /** The current time, from the parent, so drawing stays predictable. */
  now: number;
  onSelect: (kind: ThingKind) => void;
  /** Where an empty area's sign leads: a chat link, or a button such as "connect Google". */
  emptyAction: (zone: Zone) => { href: string } | { onClick: () => void } | null;
};

const roofs = ["#e8594a", "#4a82de", "#f2c230", "#3e9e50", "#b36bd4", "#f08a3c"];
const walls = ["#fffdf8", "#f7e7c6", "#e9f1f7", "#fbe3dc"];
const brights = ["#e8594a", "#f2c230", "#4a82de", "#58c26a", "#b36bd4", "#f08a3c"];
const grounds: Record<ThingKind, string> = {
  person: "#d6ecd6",
  event: "#f4e8c8",
  habit: "#dccaa6",
  recipe: "#c9e4c0",
  list: "#d9eedd",
  note: "#ecdfbd",
  file: "#e9e1d1",
  mail: "#e1e7f0",
};
const LABEL = 24;

type DrawProps = { z: Zone; items: ParkThing[]; now: number };
const INK = "#22332a";

/** Newest first, except events: soonest upcoming first, then the most recent past ones. */
function ordered(kind: ThingKind, list: ParkThing[], now: number) {
  if (kind !== "event") return [...list].reverse();
  const time = (t: ParkThing) => (t.date ? Date.parse(t.date) : 0);
  const upcoming = list.filter((t) => time(t) >= now).sort((a, b) => time(a) - time(b));
  const past = list.filter((t) => time(t) < now).sort((a, b) => time(b) - time(a));
  return [...upcoming, ...past];
}

function content(z: Zone) {
  return { x: z.x + 8, y: z.y + LABEL, w: z.w - 16, h: z.h - LABEL - 6 };
}

/** A new item pops up from the ground; the delay makes a batch arrive one by one. */
function Item({ i, children }: { i: number; children: ReactNode }) {
  return (
    <g className="park-item" style={{ animationDelay: `${Math.min(i * 28, 1100)}ms` }}>
      {children}
    </g>
  );
}

function soonBirthday(t: ParkThing, now: number) {
  const b = t.detail.birthday as { month: number; day: number } | null | undefined;
  if (!b) return false;
  const year = new Date(now).getFullYear();
  const next = new Date(year, b.month - 1, b.day);
  if (next.getTime() < now - 86400000) next.setFullYear(year + 1);
  return next.getTime() - now < 14 * 86400000;
}

/** Places each item at its spot, scaled so a handful fill the area and a crowd still fits. */
function Placed({
  z,
  items,
  max,
  unit,
  maxScale = 2.2,
  box,
  draw,
}: {
  z: Zone;
  items: ParkThing[];
  max: number;
  unit: { w: number; h: number };
  maxScale?: number;
  box?: { x: number; y: number; w: number; h: number };
  draw: (t: ParkThing, i: number) => ReactNode;
}) {
  const { cells, scale } = fit(box ?? content(z), items.length, max, unit, maxScale);
  return (
    <>
      {cells.map((c, i) => (
        <g key={items[i].id} transform={`translate(${c.x} ${c.y}) scale(${scale})`}>
          <Item i={i}>{draw(items[i], i)}</Item>
        </g>
      ))}
    </>
  );
}

/** One house, about 30 wide and 34 tall, centered on 0,0. */
function House({ t, now }: { t: ParkThing; now: number }) {
  const h = hash(t.id);
  const roof = roofs[h % roofs.length];
  const wall = walls[(h >>> 3) % walls.length];
  return (
    <>
      <rect x={-11} y={-4} width={22} height={17} fill={wall} stroke={INK} strokeWidth={1.3} />
      <path d="M-14 -3 L0 -16 L14 -3 Z" fill={roof} stroke={INK} strokeWidth={1.3} strokeLinejoin="round" />
      <rect x={-3} y={4} width={6} height={9} fill={roof} opacity={0.8} />
      <rect x={-8.5} y={0} width={4} height={4} fill="#d7e9f2" stroke={INK} strokeWidth={0.6} />
      <rect x={4.5} y={0} width={4} height={4} fill="#d7e9f2" stroke={INK} strokeWidth={0.6} />
      <ellipse cx={-14} cy={12} rx={3.5} ry={2.5} fill="#58c26a" />
      <ellipse cx={14} cy={12} rx={3.5} ry={2.5} fill="#58c26a" />
      {soonBirthday(t, now) && (
        <g className="park-sway">
          <line x1={10} y1={-4} x2={13} y2={-17} stroke={INK} strokeWidth={0.7} />
          <circle cx={13} cy={-20} r={3.5} fill="#e8594a" stroke={INK} strokeWidth={0.8} />
        </g>
      )}
    </>
  );
}

function Houses({ z, items, now }: DrawProps) {
  return <Placed z={z} items={items} max={24} unit={{ w: 34, h: 36 }} draw={(t) => <House t={t} now={now} />} />;
}

function Bunting({ z, items, now }: DrawProps) {
  const b = content(z);
  const left = b.x + 8;
  const right = b.x + b.w - 8;
  const perString = 8;
  const shown = items.slice(0, 3 * perString);
  const used = Math.max(1, Math.ceil(shown.length / perString));
  const tentTop = b.y + b.h - 44;
  const gap = (tentTop - b.y - 14) / used;
  const strings = Array.from({ length: used }, (_, s) => b.y + 12 + s * gap);
  const onString = (s: number) => Math.min(perString, shown.length - s * perString);
  const sag = 14;
  const cx = (left + right) / 2;
  return (
    <>
      <line x1={left} y1={b.y + 6} x2={left} y2={b.y + b.h} stroke="#8a5a2b" strokeWidth={3} strokeLinecap="round" />
      <line x1={right} y1={b.y + 6} x2={right} y2={b.y + b.h} stroke="#8a5a2b" strokeWidth={3} strokeLinecap="round" />
      {strings.map((sy) => (
        <path key={sy} d={`M${left} ${sy} Q${cx} ${sy + sag * 2} ${right} ${sy}`} fill="none" stroke={INK} strokeWidth={1.1} />
      ))}
      {/* A little festival tent. */}
      <rect x={cx - 26} y={tentTop + 14} width={52} height={b.y + b.h - tentTop - 14} fill="#fffdf8" stroke={INK} strokeWidth={1.3} />
      {[-26, -10, 6].map((dx) => (
        <rect key={dx} x={cx + dx + 2} y={tentTop + 15} width={7} height={b.y + b.h - tentTop - 16} fill="#e8594a" opacity={0.8} />
      ))}
      <path d={`M${cx - 31} ${tentTop + 16} L${cx} ${tentTop} L${cx + 31} ${tentTop + 16} Z`} fill="#e8594a" stroke={INK} strokeWidth={1.3} strokeLinejoin="round" />
      <path d={`M${cx - 6} ${b.y + b.h} L${cx} ${tentTop + 22} L${cx + 6} ${b.y + b.h} Z`} fill={INK} opacity={0.75} />
      <line x1={cx} y1={tentTop} x2={cx} y2={tentTop - 11} stroke={INK} strokeWidth={1} />
      <path d={`M${cx} ${tentTop - 11} L${cx + 9} ${tentTop - 8} L${cx} ${tentTop - 5} Z`} fill="#f2c230" />
      {shown.map((t, i) => {
        const s = Math.floor(i / perString);
        const k = i % perString;
        const u = (k + 0.5) / onString(s);
        const x = left + (right - left) * u;
        const y = strings[s] + 2 * u * (1 - u) * sag * 2;
        const upcoming = t.date ? Date.parse(t.date) >= now : false;
        return (
          <g key={t.id} transform={`translate(${x} ${y})`}>
            <Item i={i}>
              <path d="M-7 0 L7 0 L0 17 Z" fill={brights[hash(t.id) % brights.length]} opacity={upcoming ? 1 : 0.45} stroke={INK} strokeWidth={1} strokeLinejoin="round" />
            </Item>
          </g>
        );
      })}
    </>
  );
}

function Plots({ z, items }: DrawProps) {
  return (
    <Placed
      z={z}
      items={items}
      max={6}
      unit={{ w: 50, h: 38 }}
      maxScale={1.6}
      draw={(t) => (
        <>
          <rect x={-22} y={-14} width={44} height={30} rx={6} fill="#a4744a" stroke={INK} strokeWidth={1.3} />
          {[-12, 0, 12].map((dx, k) => (
            <g key={dx}>
              <line x1={dx} y1={10} x2={dx} y2={-6} stroke="#3e9e50" strokeWidth={2} strokeLinecap="round" />
              <ellipse cx={dx - 4} cy={-3} rx={4} ry={2.4} fill="#58c26a" />
              <ellipse cx={dx + 4} cy={-7} rx={4} ry={2.4} fill="#58c26a" />
              {(hash(t.id) >>> k) % 2 === 0 && <circle cx={dx} cy={-9} r={2.4} fill="#f2c230" />}
            </g>
          ))}
        </>
      )}
    />
  );
}

function Trees({ z, items }: DrawProps) {
  return (
    <Placed
      z={z}
      items={items}
      max={12}
      unit={{ w: 34, h: 40 }}
      maxScale={1.8}
      draw={(t) => (
        <>
          <ellipse cx={0} cy={17} rx={12} ry={3} fill={INK} opacity={0.12} />
          <rect x={-2.5} y={2} width={5} height={15} fill="#8a5a2b" />
          <circle cx={0} cy={-5} r={13} fill="#58c26a" stroke={INK} strokeWidth={1.3} />
          <circle cx={-5} cy={-10} r={4} fill="#7fd48d" />
          {[0, 1, 2].map((k) => {
            const a = (hash(t.id + k) % 360) * (Math.PI / 180);
            return <circle key={k} cx={Math.cos(a) * 7} cy={-5 + Math.sin(a) * 7} r={2.6} fill="#e8594a" />;
          })}
        </>
      )}
    />
  );
}

function Blankets({ z, items }: DrawProps) {
  return (
    <Placed
      z={z}
      items={items}
      max={8}
      unit={{ w: 44, h: 44 }}
      maxScale={1.6}
      draw={(t) => {
        const color = brights[hash(t.id) % brights.length];
        const tilt = (hash(t.id) % 14) - 7;
        const count = Array.isArray(t.detail.items) ? Math.min((t.detail.items as unknown[]).length, 5) : 0;
        return (
          <>
            <g transform={`rotate(${tilt})`}>
              <rect x={-16} y={-16} width={32} height={32} fill="#fffdf8" stroke={INK} strokeWidth={1.3} />
              <g fill={color} opacity={0.8}>
                <rect x={-16} y={-16} width={16} height={16} />
                <rect x={0} y={0} width={16} height={16} />
              </g>
            </g>
            {/* A picnic basket, with one apple per list item. */}
            <rect x={6} y={6} width={14} height={9} rx={2} fill="#c88a4a" stroke={INK} strokeWidth={1} />
            <path d="M8 6 Q13 -1 18 6" fill="none" stroke={INK} strokeWidth={1} />
            {Array.from({ length: count }, (_, k) => (
              <circle key={k} cx={-14 + k * 5} cy={20} r={2} fill="#e8594a" />
            ))}
          </>
        );
      }}
    />
  );
}

function Benches({ z, items }: DrawProps) {
  return (
    <Placed
      z={z}
      items={items}
      max={8}
      unit={{ w: 40, h: 30 }}
      maxScale={1.2}
      draw={() => (
        <>
          <rect x={-15} y={-2} width={30} height={5} rx={1.5} fill="#b07a45" stroke={INK} strokeWidth={1.1} />
          <rect x={-15} y={-9} width={30} height={4} rx={1.5} fill="#b07a45" stroke={INK} strokeWidth={1.1} />
          <line x1={-12} y1={3} x2={-12} y2={10} stroke={INK} strokeWidth={1.6} />
          <line x1={12} y1={3} x2={12} y2={10} stroke={INK} strokeWidth={1.6} />
          <rect x={-5} y={-15} width={10} height={6} fill="#fffdf8" stroke={INK} strokeWidth={0.9} />
        </>
      )}
    />
  );
}

function Library({ z, items }: DrawProps) {
  const b = content(z);
  const bw = 70;
  const bx = b.x + 2;
  const by = b.y + 34;
  const bh = b.h - 40;
  const shelf = { x: bx + bw + 8, y: b.y + 6, w: b.w - bw - 12, h: b.h - 10 };
  const bookColor = (t: ParkThing) =>
    t.detail.type === "doc" ? "#4a82de" : t.detail.type === "sheet" ? "#3e9e50" : brights[hash(t.id) % brights.length];
  return (
    <>
      <path d={`M${bx - 5} ${by} L${bx + bw / 2} ${by - 26} L${bx + bw + 5} ${by} Z`} fill="#c7593f" stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />
      <circle cx={bx + bw / 2} cy={by - 10} r={5} fill="#fffdf8" stroke={INK} strokeWidth={1} />
      <rect x={bx} y={by} width={bw} height={bh} fill="#fffdf8" stroke={INK} strokeWidth={1.4} />
      {[0, 1, 2, 3].map((k) => (
        <rect key={k} x={bx + 7 + k * 16} y={by + 6} width={7} height={bh - 30} fill="#e9e1d1" stroke={INK} strokeWidth={0.8} />
      ))}
      <rect x={bx - 4} y={by + bh - 6} width={bw + 8} height={6} fill="#e9e1d1" stroke={INK} strokeWidth={1} />
      <rect x={bx + bw / 2 - 8} y={by + bh - 24} width={16} height={18} rx={7} fill="#8a5a2b" />
      <Placed z={z} items={items} max={40} unit={{ w: 10, h: 26 }} maxScale={1.4} box={shelf} draw={(t) => (
        <>
          <rect x={-4} y={-11} width={8} height={22} fill={bookColor(t)} stroke={INK} strokeWidth={0.8} />
          <line x1={-2} y1={-6} x2={2} y2={-6} stroke="#fffdf8" strokeWidth={1} />
          <rect x={-6} y={11} width={12} height={3} fill="#8a5a2b" />
        </>
      )} />
    </>
  );
}

function PostOffice({ z, items }: DrawProps) {
  const b = content(z);
  const bw = 70;
  const bx = b.x + 2;
  const by = b.y + 24;
  const bh = b.h - 30;
  const tray = { x: bx + bw + 8, y: b.y + 6, w: b.w - bw - 12, h: b.h - 10 };
  return (
    <>
      <rect x={bx} y={by} width={bw} height={bh} fill="#fffdf8" stroke={INK} strokeWidth={1.4} />
      <rect x={bx - 5} y={by - 16} width={bw + 10} height={16} rx={3} fill="#4a82de" stroke={INK} strokeWidth={1.4} />
      <text x={bx + bw / 2} y={by - 4} textAnchor="middle" className="font-hand" fontSize={12} fill="#fffdf8">
        POST
      </text>
      <rect x={bx + 9} y={by + 12} width={16} height={14} fill="#d7e9f2" stroke={INK} strokeWidth={0.8} />
      <rect x={bx + bw - 25} y={by + 12} width={16} height={14} fill="#d7e9f2" stroke={INK} strokeWidth={0.8} />
      <rect x={bx + bw / 2 - 8} y={by + bh - 26} width={16} height={26} rx={7} fill="#8a5a2b" />
      {/* The mailbox out front. */}
      <line x1={bx + bw - 4} y1={by + bh} x2={bx + bw - 4} y2={by + bh - 16} stroke={INK} strokeWidth={2} />
      <rect x={bx + bw - 12} y={by + bh - 26} width={16} height={11} rx={5} fill="#e8594a" stroke={INK} strokeWidth={1} />
      <Placed z={z} items={items} max={18} unit={{ w: 28, h: 22 }} maxScale={1.5} box={tray} draw={(_, i) => (
        <g transform={`rotate(${(i % 3) * 4 - 4})`}>
          <rect x={-12} y={-8} width={24} height={16} fill="#fffdf8" stroke={INK} strokeWidth={1} />
          <path d="M-12 -8 L0 1 L12 -8" fill="none" stroke={INK} strokeWidth={1} />
          <rect x={6} y={-6} width={4} height={4} fill="#e8594a" />
        </g>
      )} />
    </>
  );
}

const drawers: Record<ThingKind, (p: DrawProps) => ReactNode> = {
  person: Houses,
  event: Bunting,
  habit: Plots,
  recipe: Trees,
  list: Blankets,
  note: Benches,
  file: Library,
  mail: PostOffice,
};

const capacity: Record<ThingKind, number> = {
  person: 24,
  event: 24,
  habit: 6,
  recipe: 12,
  list: 8,
  note: 8,
  file: 40,
  mail: 18,
};

/** Flowers and bushes that fill in along an area's bottom edge as it grows. */
function Flourish({ z, stage }: { z: Zone; stage: ReturnType<typeof stageOf> }) {
  const n = { empty: 0, sprout: 2, growing: 5, bloom: 9 }[stage];
  return (
    <g aria-hidden="true" pointerEvents="none">
      {Array.from({ length: n }, (_, k) => {
        const x = z.x + 12 + ((k * 37 + (hash(z.kind) % 23)) % (z.w - 24));
        const y = z.y + z.h - 6;
        const color = brights[(k + hash(z.kind)) % brights.length];
        return k % 3 === 2 ? (
          <ellipse key={k} cx={x} cy={y - 2} rx={6} ry={4} fill="#58c26a" stroke={INK} strokeWidth={0.8} />
        ) : (
          <g key={k}>
            <line x1={x} y1={y} x2={x} y2={y - 6} stroke="#3e9e50" strokeWidth={1.2} />
            <circle cx={x} cy={y - 7} r={2.4} fill={color} />
          </g>
        );
      })}
    </g>
  );
}

/** Trees, a pond, and a duck along the paths, so the park feels like a park from day one. */
function Scenery() {
  const trees: [number, number, number][] = [
    [200, 226, 1],
    [8, 416, 0.9],
    [392, 416, 0.9],
    [200, 560, 1],
    [8, 738, 0.8],
    [392, 738, 0.8],
    [250, 10, 0.8],
  ];
  return (
    <g aria-hidden="true" pointerEvents="none">
      {trees.map(([x, y, s], k) => (
        <g key={k} transform={`translate(${x} ${y}) scale(${s})`}>
          <rect x={-2} y={-2} width={4} height={8} fill="#8a5a2b" />
          <circle cx={0} cy={-8} r={9} fill="#3e9e50" stroke={INK} strokeWidth={1.1} />
          <circle cx={-3} cy={-11} r={3} fill="#58c26a" />
        </g>
      ))}
      {/* A small pond where the middle paths meet, with a duck. */}
      <ellipse cx={200} cy={416} rx={22} ry={9} fill="#d7e9f2" stroke="#9dc3d8" strokeWidth={2} />
      <g className="park-duck">
        <ellipse cx={196} cy={416} rx={5} ry={3.2} fill="#fffdf8" stroke={INK} strokeWidth={0.8} />
        <circle cx={200} cy={412.5} r={2.3} fill="#fffdf8" stroke={INK} strokeWidth={0.8} />
        <path d="M202 412.5 L205 413.3 L202 414" fill="#f2c230" />
      </g>
    </g>
  );
}

/** An unbuilt lot with a hand-painted sign. */
function EmptyLot({ z, action }: { z: Zone; action: ReturnType<Props["emptyAction"]> }) {
  const b = content(z);
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const words = z.sign.split(" ");
  const half = Math.ceil(words.length / 2);
  const lines = z.sign.length > 16 ? [words.slice(0, half).join(" "), words.slice(half).join(" ")] : [z.sign];
  const bw = Math.min(b.w - 12, 118);
  const bh = lines.length === 2 ? 36 : 24;
  const sign = (
    <g className="park-sign">
      <rect x={b.x + 2} y={b.y + 2} width={b.w - 4} height={b.h - 4} rx={10} fill="none" stroke="#8fc9a4" strokeWidth={2} strokeDasharray="6 6" />
      {b.h > 60 && <line x1={cx} y1={cy - 4} x2={cx} y2={cy + bh / 2 + 18} stroke="#8a5a2b" strokeWidth={3} strokeLinecap="round" />}
      <rect x={cx - bw / 2} y={cy - bh / 2 - (b.h > 60 ? 6 : 0)} width={bw} height={bh} rx={4} fill="#f3e2b8" stroke={INK} strokeWidth={1.3} />
      {lines.map((line, k) => (
        <text key={k} x={cx} y={cy - bh / 2 + (b.h > 60 ? 9 : 15) + k * 13} textAnchor="middle" className="font-hand" fontSize={12} fill={INK}>
          {line}
        </text>
      ))}
    </g>
  );
  if (!action) return sign;
  if ("href" in action) {
    return (
      <a href={action.href} aria-label={`${z.name}: ${z.sign}`}>
        {sign}
      </a>
    );
  }
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${z.name}: ${z.sign}`}
      onClick={action.onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && action.onClick()}
      className="cursor-pointer"
    >
      {sign}
    </g>
  );
}

/** Someone's life drawn as a park. Every thing they have has a spot; empty areas invite the next one. */
export function ParkMap({ things, now, onSelect, emptyAction }: Props) {
  const byKind = new Map<ThingKind, ParkThing[]>();
  for (const t of things) byKind.set(t.kind, [...(byKind.get(t.kind) ?? []), t]);
  const summary = zones
    .map((z) => countLabel(z, byKind.get(z.kind)?.length ?? 0))
    .join(", ");

  return (
    <svg
      viewBox={`0 0 ${PARK_WIDTH} ${PARK_HEIGHT}`}
      className="h-auto w-full select-none"
      role="group"
      aria-label={`Your park: ${summary}.`}
    >
      <rect width={PARK_WIDTH} height={PARK_HEIGHT} rx={24} fill="#cfe7d6" />
      {/* Paths between the areas. */}
      <g stroke="#eadcb6" strokeWidth={12} strokeLinecap="round" fill="none" filter="url(#chalk-edge)">
        <path d={`M8 228 H${PARK_WIDTH - 8}`} />
        <path d={`M8 416 H${PARK_WIDTH - 8}`} />
        <path d={`M8 560 H${PARK_WIDTH - 8}`} />
        <path d={`M8 738 H${PARK_WIDTH - 8}`} />
        <path d={`M200 228 V416 M200 560 V738 M250 12 V228`} />
      </g>

      {zones.map((z) => {
        const list = ordered(z.kind, byKind.get(z.kind) ?? [], now);
        const n = list.length;
        const stage = stageOf(n);
        const Draw = drawers[z.kind];
        const extra = n - capacity[z.kind];
        const open = () => onSelect(z.kind);
        return (
          <g key={z.kind} data-zone={z.kind} data-stage={stage}>
            <rect x={z.x} y={z.y} width={z.w} height={z.h} rx={14} fill={grounds[z.kind]} filter="url(#chalk-edge)" />
            <Flourish z={z} stage={stage} />
            <text x={z.x + 10} y={z.y + 17} className="font-hand" fontSize={14} fill={INK}>
              {z.name}
              {n > 0 && <tspan fill="#4b5550">{`  ${n}`}</tspan>}
            </text>
            {n === 0 ? (
              <EmptyLot z={z} action={emptyAction(z)} />
            ) : (
              <g
                role="button"
                tabIndex={0}
                aria-label={`${z.name}: ${countLabel(z, n)}. Open the list.`}
                onClick={open}
                onKeyDown={(e: KeyboardEvent) => (e.key === "Enter" || e.key === " ") && open()}
                className="cursor-pointer outline-none"
              >
                <rect x={z.x} y={z.y + LABEL} width={z.w} height={z.h - LABEL} fill="transparent" />
                <Draw z={z} items={list} now={now} />
                {extra > 0 && (
                  <text x={z.x + z.w - 10} y={z.y + 17} textAnchor="end" className="font-hand" fontSize={12} fill="#4b5550">
                    {`+${extra} more`}
                  </text>
                )}
              </g>
            )}
          </g>
        );
      })}

      <Scenery />

      {/* Clouds drift over the park. Decorative only. */}
      <g aria-hidden="true" opacity={0.85} pointerEvents="none">
        <g className="park-cloud">
          <ellipse cx={0} cy={250} rx={26} ry={9} fill="#fffdf8" />
          <ellipse cx={14} cy={244} rx={16} ry={9} fill="#fffdf8" />
        </g>
        <g className="park-cloud park-cloud-slow">
          <ellipse cx={0} cy={548} rx={22} ry={8} fill="#fffdf8" />
          <ellipse cx={-12} cy={543} rx={13} ry={8} fill="#fffdf8" />
        </g>
      </g>
    </svg>
  );
}
