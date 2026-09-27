import type { ReactNode } from "react";
import { hash } from "@/lib/park/layout";
import type { ParkThing } from "@/lib/things";

/**
 * The drawings for things in the park. Each is about 90 map units across,
 * centered on 0,0 with its base near y = 30, in the park's crayon palette:
 * warm fills, one ink outline weight, a soft ground shadow.
 */

export const INK = "#2b3a31";
const LINE = 2.2;
const roofs = ["#d9544a", "#3f78c9", "#e9a93a", "#3b9152", "#9a5fc2", "#e2763a"];
const walls = ["#fffaf0", "#f6e3c3", "#e6eff6", "#f9ded6", "#e9f2e1"];
const brights = ["#e05a4f", "#efb33e", "#4a82de", "#4fae62", "#a868d1", "#ef8a45"];

function Shadow({ w, y = 30 }: { w: number; y?: number }) {
  return <ellipse cx={0} cy={y} rx={w} ry={w * 0.18} fill={INK} opacity={0.14} />;
}

function Cottage({ t, now }: { t: ParkThing; now: number }) {
  const h = hash(t.id);
  const roof = roofs[h % roofs.length];
  const wall = walls[(h >>> 3) % walls.length];
  const door = roofs[(h >>> 6) % roofs.length];
  const b = t.detail.birthday as { month: number; day: number } | null | undefined;
  let party = false;
  if (b) {
    const year = new Date(now).getFullYear();
    const next = new Date(year, b.month - 1, b.day);
    if (next.getTime() < now - 86400000) next.setFullYear(year + 1);
    party = next.getTime() - now < 14 * 86400000;
  }
  return (
    <>
      <Shadow w={40} />
      {/* A little front garden. */}
      <ellipse cx={-30} cy={26} rx={10} ry={7} fill="#5fb56f" stroke={INK} strokeWidth={1.6} />
      <ellipse cx={31} cy={26} rx={9} ry={6.5} fill="#5fb56f" stroke={INK} strokeWidth={1.6} />
      <circle cx={-33} cy={23} r={2.2} fill="#f3c94b" />
      <circle cx={28} cy={23} r={2.2} fill="#e05a4f" />
      {/* Chimney, walls, roof. */}
      <rect x={12} y={-30} width={8} height={16} fill="#b8674a" stroke={INK} strokeWidth={LINE} />
      <rect x={-24} y={-8} width={48} height={36} rx={2} fill={wall} stroke={INK} strokeWidth={LINE} />
      <path d="M-31 -6 L0 -34 L31 -6 Z" fill={roof} stroke={INK} strokeWidth={LINE} strokeLinejoin="round" />
      <path d="M-20 -12 L20 -12 M-12 -20 L12 -20" stroke={INK} strokeWidth={1} opacity={0.35} />
      <rect x={-6} y={8} width={12} height={20} rx={5} fill={door} stroke={INK} strokeWidth={1.8} />
      <circle cx={3} cy={18} r={1.2} fill={INK} />
      {[-17, 11].map((x) => (
        <g key={x}>
          <rect x={x} y={0} width={8} height={8} fill="#cfe6f5" stroke={INK} strokeWidth={1.5} />
          <path d={`M${x + 4} 0 V8 M${x} 4 H${x + 8}`} stroke={INK} strokeWidth={1} />
        </g>
      ))}
      {party && (
        <g className="park-sway">
          <path d="M26 -2 C 30 -14, 26 -24, 32 -36" fill="none" stroke={INK} strokeWidth={1} />
          <ellipse cx={32} cy={-42} rx={6} ry={7} fill="#e05a4f" stroke={INK} strokeWidth={1.4} />
          <ellipse cx={30} cy={-44} rx={1.6} ry={2.4} fill="#fff" opacity={0.7} />
        </g>
      )}
    </>
  );
}

function Stall({ t, now }: { t: ParkThing; now: number }) {
  const h = hash(t.id);
  const color = brights[h % brights.length];
  const when = t.date ? new Date(t.date) : null;
  const upcoming = when ? when.getTime() >= now : false;
  const label = when ? when.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";
  return (
    <g opacity={upcoming || !when ? 1 : 0.55}>
      <Shadow w={36} />
      {/* Posts and a striped awning. */}
      <rect x={-28} y={-18} width={4} height={48} fill="#8a5a2b" />
      <rect x={24} y={-18} width={4} height={48} fill="#8a5a2b" />
      <path d="M-34 -18 L34 -18 L30 -34 L-30 -34 Z" fill="#fffaf0" stroke={INK} strokeWidth={LINE} strokeLinejoin="round" />
      {[-26, -10, 6, 22].map((x) => (
        <path key={x} d={`M${x - 4} -34 L${x + 4} -34 L${x + 5} -18 L${x - 5} -18 Z`} fill={color} />
      ))}
      <path d="M-34 -18 q5.7 8 11.3 0 q5.7 8 11.3 0 q5.7 8 11.3 0 q5.7 8 11.3 0 q5.7 8 11.3 0 q5.7 8 11.3 0" fill={color} stroke={INK} strokeWidth={1.6} />
      {/* The counter, with the date on a card. */}
      <rect x={-30} y={4} width={60} height={24} rx={2} fill="#f3e2b8" stroke={INK} strokeWidth={LINE} />
      <rect x={-18} y={9} width={36} height={14} rx={3} fill="#fffaf0" stroke={INK} strokeWidth={1.2} />
      <text y={19.5} textAnchor="middle" fontSize={9.5} fontWeight={800} fill={INK}>
        {label}
      </text>
      {upcoming && (
        <g className="park-sway">
          <line x1={0} y1={-34} x2={0} y2={-50} stroke={INK} strokeWidth={1.4} />
          <path d="M0 -50 L14 -45 L0 -40 Z" fill={color} stroke={INK} strokeWidth={1.2} />
        </g>
      )}
    </g>
  );
}

function Bed({ t }: { t: ParkThing }) {
  const h = hash(t.id);
  const flower = brights[h % brights.length];
  return (
    <>
      <Shadow w={42} y={28} />
      <rect x={-40} y={-8} width={80} height={36} rx={8} fill="#9b6a43" stroke={INK} strokeWidth={LINE} />
      <path d="M-34 4 H34 M-34 16 H34" stroke="#7d5234" strokeWidth={2} strokeLinecap="round" />
      {[-26, -13, 0, 13, 26].map((x, k) => (
        <g key={x}>
          <path d={`M${x} 10 V-12`} stroke="#3b9152" strokeWidth={2.4} strokeLinecap="round" />
          <path d={`M${x} -2 q-8 -2 -9 -9 q7 1 9 7 M${x} -6 q8 -2 9 -9 q-7 1 -9 7`} fill="#5fb56f" stroke={INK} strokeWidth={1} />
          {(h >>> k) % 3 !== 0 && (
            <g transform={`translate(${x} -16)`}>
              {[0, 72, 144, 216, 288].map((a) => (
                <circle key={a} cx={Math.cos((a * Math.PI) / 180) * 3.6} cy={Math.sin((a * Math.PI) / 180) * 3.6} r={2.8} fill={flower} />
              ))}
              <circle r={2.2} fill="#f3c94b" stroke={INK} strokeWidth={0.8} />
            </g>
          )}
        </g>
      ))}
      {/* A little watering can. */}
      <g transform="translate(34 22) rotate(-10)">
        <rect x={-6} y={-6} width={12} height={10} rx={2} fill="#7aa6d8" stroke={INK} strokeWidth={1.2} />
        <path d="M6 -3 L13 -9" stroke={INK} strokeWidth={1.6} strokeLinecap="round" />
      </g>
    </>
  );
}

function FruitTree({ t }: { t: ParkThing }) {
  const h = hash(t.id);
  const fruit = ["#e05a4f", "#efb33e", "#ef8a45", "#a868d1"][h % 4];
  return (
    <>
      <Shadow w={34} />
      <path d="M-5 30 L-4 2 Q0 -4 4 2 L5 30 Z" fill="#8a5a2b" stroke={INK} strokeWidth={1.8} />
      <path d="M0 8 L-9 -2 M1 4 L10 -4" stroke="#8a5a2b" strokeWidth={3} strokeLinecap="round" />
      {/* The three-lobed canopy from the park design. */}
      <circle cx={-16} cy={-8} r={17} fill="#4fae62" stroke={INK} strokeWidth={LINE} />
      <circle cx={16} cy={-8} r={17} fill="#4fae62" stroke={INK} strokeWidth={LINE} />
      <circle cx={0} cy={-24} r={19} fill="#4fae62" stroke={INK} strokeWidth={LINE} />
      <path d="M-26 -6 a17 17 0 0 1 20 -14 M-4 -38 a19 19 0 0 1 12 -2" fill="none" stroke="#8fd69c" strokeWidth={3} strokeLinecap="round" />
      <path d="M-14 -4 C -8 2, 8 2, 14 -4" fill="none" stroke="#3b9152" strokeWidth={1.4} opacity={0.6} />
      {[0, 1, 2, 3, 4].map((k) => {
        const a = ((h >>> (k * 4)) % 360) * (Math.PI / 180);
        const r = 8 + ((h >>> (k * 3)) % 12);
        return <circle key={k} cx={Math.cos(a) * r} cy={-14 + Math.sin(a) * r * 0.8} r={3.6} fill={fruit} stroke={INK} strokeWidth={1} />;
      })}
    </>
  );
}

function Picnic({ t }: { t: ParkThing }) {
  const h = hash(t.id);
  const color = brights[h % brights.length];
  const items = Array.isArray(t.detail.items) ? (t.detail.items as unknown[]).length : 0;
  const tilt = (h % 12) - 6;
  const cells: ReactNode[] = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if ((r + c) % 2 === 0) cells.push(<rect key={`${r}${c}`} x={-36 + c * 18} y={-22 + r * 11} width={18} height={11} fill={color} opacity={0.85} />);
    }
  }
  return (
    <>
      <g transform={`rotate(${tilt})`}>
        <path d="M-38 -22 L36 -24 L38 22 L-36 24 Z" fill="#fffaf0" stroke={INK} strokeWidth={LINE} strokeLinejoin="round" />
        <g clipPath="url(#picnic-clip)">{cells}</g>
        <path d="M-38 -22 L36 -24 L38 22 L-36 24 Z" fill="none" stroke={INK} strokeWidth={LINE} strokeLinejoin="round" />
      </g>
      {/* One plate per list item, up to six, and a basket. */}
      {Array.from({ length: Math.min(items, 6) }, (_, k) => (
        <g key={k} transform={`translate(${-24 + (k % 3) * 16} ${-8 + Math.floor(k / 3) * 16})`}>
          <circle r={5.5} fill="#fffaf0" stroke={INK} strokeWidth={1.2} />
          <circle r={2.4} fill={brights[(h + k) % brights.length]} />
        </g>
      ))}
      <g transform="translate(22 6)">
        <path d="M-10 -2 Q0 -18 10 -2" fill="none" stroke={INK} strokeWidth={2} />
        <path d="M-12 -2 H12 L9 12 H-9 Z" fill="#c88a4a" stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
        <path d="M-10 3 H10 M-9 8 H9" stroke="#8a5a2b" strokeWidth={1.2} />
      </g>
    </>
  );
}

function Bench({ t }: { t: ParkThing }) {
  const h = hash(t.id);
  return (
    <>
      <Shadow w={38} y={28} />
      <path d="M-30 12 L-30 28 M30 12 L30 28 M-26 -10 L-28 12 M26 -10 L28 12" stroke={INK} strokeWidth={3} strokeLinecap="round" />
      <rect x={-36} y={-18} width={72} height={8} rx={3} fill="#b9814a" stroke={INK} strokeWidth={1.8} />
      <rect x={-36} y={-6} width={72} height={8} rx={3} fill="#b9814a" stroke={INK} strokeWidth={1.8} />
      <rect x={-38} y={8} width={76} height={8} rx={3} fill="#c78f55" stroke={INK} strokeWidth={1.8} />
      {/* The plaque with the note. */}
      <rect x={-12} y={-16} width={24} height={12} rx={2} fill="#f3d27a" stroke={INK} strokeWidth={1.2} />
      <path d="M-7 -12 H7 M-7 -8 H4" stroke={INK} strokeWidth={1} />
      {h % 2 === 0 && (
        <g transform="translate(-44 20)">
          <path d="M0 8 V-6" stroke="#3b9152" strokeWidth={2} />
          <circle cy={-9} r={4} fill={brights[h % brights.length]} stroke={INK} strokeWidth={1} />
        </g>
      )}
    </>
  );
}

function Pavilion({ t }: { t: ParkThing }) {
  const kind = t.detail.type;
  const roof = kind === "doc" ? "#3f78c9" : kind === "sheet" ? "#3b9152" : "#d9544a";
  const tag = kind === "doc" ? "DOC" : kind === "sheet" ? "SHEET" : "FILE";
  return (
    <>
      <Shadow w={40} />
      <rect x={-34} y={22} width={68} height={8} rx={2} fill="#e6dcc6" stroke={INK} strokeWidth={1.8} />
      {[-26, -9, 9, 26].map((x) => (
        <rect key={x} x={x - 3.5} y={-8} width={7} height={30} fill="#fffaf0" stroke={INK} strokeWidth={1.6} />
      ))}
      <rect x={-34} y={-14} width={68} height={7} fill="#fffaf0" stroke={INK} strokeWidth={1.8} />
      <path d="M-38 -14 L0 -40 L38 -14 Z" fill={roof} stroke={INK} strokeWidth={LINE} strokeLinejoin="round" />
      <rect x={-14} y={-30} width={28} height={11} rx={2} fill="#fffaf0" stroke={INK} strokeWidth={1.2} />
      <text y={-21.5} textAnchor="middle" fontSize={8} fontWeight={900} fill={roof}>
        {tag}
      </text>
    </>
  );
}

function Mailbox({ t, i }: { t: ParkThing; i: number }) {
  const h = hash(t.id);
  const body = ["#3f78c9", "#d9544a", "#3b9152"][h % 3];
  return (
    <>
      <Shadow w={24} />
      <rect x={-3} y={0} width={6} height={30} fill="#8a5a2b" stroke={INK} strokeWidth={1.4} />
      <path d="M-20 -2 V-18 A12 12 0 0 1 -8 -30 H8 A12 12 0 0 1 20 -18 V-2 Z" fill={body} stroke={INK} strokeWidth={LINE} strokeLinejoin="round" />
      <path d="M-20 -18 A12 12 0 0 1 -8 -30" fill="none" stroke="#fff" strokeWidth={2} opacity={0.4} />
      <path d="M20 -26 V-40 H32 V-33 H20" fill="#e05a4f" stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />
      {/* A letter peeking out. */}
      <g transform={`translate(-2 -10) rotate(${(i % 3) * 6 - 6})`}>
        <rect x={-13} y={-8} width={26} height={16} fill="#fffaf0" stroke={INK} strokeWidth={1.4} />
        <path d="M-13 -8 L0 2 L13 -8" fill="none" stroke={INK} strokeWidth={1.2} />
        <rect x={6} y={-6} width={5} height={5} fill="#e05a4f" />
      </g>
    </>
  );
}

/** The drawing for one thing, by its kind. */
export function Figure({ t, now, i }: { t: ParkThing; now: number; i: number }) {
  switch (t.kind) {
    case "person":
      return <Cottage t={t} now={now} />;
    case "event":
      return <Stall t={t} now={now} />;
    case "habit":
      return <Bed t={t} />;
    case "recipe":
      return <FruitTree t={t} />;
    case "list":
      return <Picnic t={t} />;
    case "note":
      return <Bench t={t} />;
    case "file":
      return <Pavilion t={t} />;
    case "mail":
      return <Mailbox t={t} i={i} />;
  }
}

/** Scenery on the open meadow between lawns. */
export function DecorFigure({ kind, s }: { kind: "tree" | "bush" | "flowers"; s: number }) {
  if (kind === "tree") {
    return (
      <g transform={`scale(${s})`}>
        <ellipse cx={0} cy={24} rx={22} ry={5} fill={INK} opacity={0.12} />
        <rect x={-4} y={2} width={8} height={22} fill="#8a5a2b" stroke={INK} strokeWidth={1.6} />
        <circle cx={0} cy={-10} r={22} fill="#3b9152" stroke={INK} strokeWidth={2} />
        <circle cx={-9} cy={-18} r={7} fill="#5fb56f" />
      </g>
    );
  }
  if (kind === "bush") {
    return (
      <g transform={`scale(${s})`}>
        <ellipse cx={0} cy={10} rx={20} ry={4} fill={INK} opacity={0.1} />
        <path d="M-18 10 a10 10 0 0 1 4 -16 a11 11 0 0 1 18 -4 a10 10 0 0 1 14 20 Z" fill="#4fae62" stroke={INK} strokeWidth={1.8} />
      </g>
    );
  }
  return (
    <g transform={`scale(${s})`}>
      {[
        [-10, 0, "#e05a4f"],
        [4, -6, "#efb33e"],
        [10, 6, "#a868d1"],
        [-2, 8, "#fffaf0"],
      ].map(([x, y, c], k) => (
        <g key={k} transform={`translate(${x} ${y})`}>
          <path d="M0 6 V0" stroke="#3b9152" strokeWidth={1.5} />
          <circle r={3.2} fill={c as string} stroke={INK} strokeWidth={0.8} />
        </g>
      ))}
    </g>
  );
}
