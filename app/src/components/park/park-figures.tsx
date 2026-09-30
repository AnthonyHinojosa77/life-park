import type { ReactNode } from "react";
import { hash } from "@/lib/park/layout";
import type { ParkThing } from "@/lib/things";
import type { ThingKind } from "@/lib/kinds";

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
  const size = 0.9 + ((h >>> 9) % 16) / 100;
  return (
    <g transform={`scale(${size})`}>
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
    </g>
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

/** A file is a book standing on a library shelf, its cover colored by what kind of file it is. */
function Book({ t, i }: { t: ParkThing; i: number }) {
  const kind = t.detail.type;
  const cover = kind === "doc" ? "#3f78c9" : kind === "sheet" ? "#3b9152" : kind === "slides" ? "#e9a93a" : ["#d9544a", "#e2763a", "#9a5fc2", "#c9553f", "#b36bd4"][hash(t.id) % 5];
  const lean = ((hash(t.id) % 5) - 2) * 2.5;
  const tall = 40 + (i % 3) * 4;
  return (
    <g transform={`translate(0 ${30 - tall / 2}) rotate(${lean})`}>
      <rect x={-13} y={-tall / 2} width={26} height={tall} rx={2} fill={cover} stroke={INK} strokeWidth={1.8} />
      <rect x={-9} y={-tall / 2 + 5} width={18} height={tall - 10} rx={1.5} fill="none" stroke="#fffaf0" strokeWidth={1.2} opacity={0.7} />
      <rect x={-13} y={-tall / 2} width={5} height={tall} fill={INK} opacity={0.18} />
      <path d={`M-4 ${-tall / 2 + 12} H6 M-4 ${-tall / 2 + 17} H4`} stroke="#fffaf0" strokeWidth={1.4} strokeLinecap="round" />
    </g>
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
      return <Book t={t} i={i} />;
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

/**
 * The landmark at the head of each lawn: the building or structure that says
 * what the place is, about 220 map units across with its base at y = 60.
 */
export function Landmark({ kind }: { kind: ThingKind }) {
  switch (kind) {
    case "person":
      return <Cafe />;
    case "event":
      return <Bandstand />;
    case "habit":
      return <Greenhouse />;
    case "recipe":
      return <Barn />;
    case "list":
      return <Gazebo />;
    case "note":
      return <Fountain />;
    case "file":
      return <Library />;
    case "mail":
      return <PostOffice />;
  }
}

function Cafe() {
  return (
    <>
      <Shadow w={90} y={60} />
      {/* Two stories with a striped awning and tables out front. */}
      <rect x={-70} y={-50} width={140} height={100} rx={3} fill="#fbeedd" stroke={INK} strokeWidth={LINE} />
      <path d="M-78 -50 L0 -84 L78 -50 Z" fill="#c9553f" stroke={INK} strokeWidth={LINE} strokeLinejoin="round" />
      <rect x={-64} y={-8} width={128} height={4} fill={INK} opacity={0.25} />
      {[-48, -16, 16, 48].map((x) => (
        <rect key={x} x={x - 9} y={-40} width={18} height={20} rx={2} fill="#cfe6f5" stroke={INK} strokeWidth={1.5} />
      ))}
      <path d="M-74 -2 H74 L66 18 H-66 Z" fill="#fffaf0" stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
      {[-60, -36, -12, 12, 36].map((x, k) => (
        <path key={x} d={`M${x} -2 H${x + 12} L${x + 11} 18 H${x - 1} Z`} fill={k % 2 ? "#e8594a" : "#e8594a"} opacity={0.85} />
      ))}
      <rect x={-12} y={14} width={24} height={36} rx={4} fill="#5b8a63" stroke={INK} strokeWidth={1.8} />
      {[-46, 40].map((x) => (
        <rect key={x} x={x - 12} y={22} width={24} height={22} rx={2} fill="#cfe6f5" stroke={INK} strokeWidth={1.5} />
      ))}
      {/* A café table with an umbrella on each side. */}
      {[-104, 104].map((x) => (
        <g key={x} transform={`translate(${x} 40)`}>
          <ellipse rx={16} ry={7} cy={12} fill="#fffaf0" stroke={INK} strokeWidth={1.5} />
          <path d="M0 12 V-24" stroke={INK} strokeWidth={2} />
          <path d="M-26 -22 Q0 -46 26 -22 Z" fill="#e8594a" stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
          <path d="M-13 -24 Q0 -30 13 -24" fill="none" stroke="#fffaf0" strokeWidth={1.4} />
        </g>
      ))}
      <rect x={-34} y={-72} width={68} height={14} rx={4} fill="#fffaf0" stroke={INK} strokeWidth={1.4} />
      <text y={-61.5} textAnchor="middle" fontSize={10} fontWeight={900} fill={INK} letterSpacing={1.5}>
        CORNER CAFÉ
      </text>
    </>
  );
}

function Bandstand() {
  const posts = [-70, -35, 35, 70];
  return (
    <>
      <Shadow w={95} y={60} />
      <ellipse cx={0} cy={44} rx={92} ry={26} fill="#f3e2b8" stroke={INK} strokeWidth={LINE} />
      <ellipse cx={0} cy={38} rx={92} ry={26} fill="#f9ecc9" stroke={INK} strokeWidth={LINE} />
      {posts.map((x) => (
        <rect key={x} x={x - 3} y={-34} width={6} height={72} fill="#fffaf0" stroke={INK} strokeWidth={1.4} />
      ))}
      <path d="M-100 -34 L0 -90 L100 -34 Z" fill="#f2a93b" stroke={INK} strokeWidth={LINE} strokeLinejoin="round" />
      <path d="M-80 -34 L0 -78 L80 -34" fill="none" stroke="#fffaf0" strokeWidth={2} opacity={0.6} />
      <path d="M-100 -34 H100" stroke={INK} strokeWidth={LINE} />
      {/* Bunting swinging from the roof. */}
      <g className="park-sway">
        <path d="M-96 -30 Q-48 -8 0 -30 Q48 -8 96 -30" fill="none" stroke={INK} strokeWidth={1.4} />
        {[-84, -66, -48, -30, -12, 6, 24, 42, 60, 78].map((x, k) => {
          const y = -30 + 22 * Math.sin((Math.PI * ((x + 96) % 96)) / 96);
          return <path key={x} d={`M${x} ${y} l5 10 l5 -10 Z`} fill={brights[k % brights.length]} stroke={INK} strokeWidth={0.8} />;
        })}
      </g>
      <circle cx={0} cy={-96} r={6} fill="#fffaf0" stroke={INK} strokeWidth={1.4} />
      {/* The board itself, with a few pinned notices. */}
      <g transform="translate(0 4)">
        <rect x={-44} y={-22} width={88} height={40} rx={3} fill="#a8794f" stroke={INK} strokeWidth={1.8} />
        <rect x={-38} y={-16} width={22} height={16} fill="#fffaf0" stroke={INK} strokeWidth={1} />
        <rect x={-10} y={-18} width={20} height={20} fill="#f3d27a" stroke={INK} strokeWidth={1} />
        <rect x={16} y={-14} width={22} height={14} fill="#cfe6f5" stroke={INK} strokeWidth={1} />
      </g>
    </>
  );
}

function Greenhouse() {
  return (
    <>
      <Shadow w={88} y={60} />
      <rect x={-80} y={-20} width={160} height={70} fill="#d8eef3" stroke="#3b9152" strokeWidth={3} />
      <path d="M-86 -20 L0 -70 L86 -20 Z" fill="#e6f4f6" stroke="#3b9152" strokeWidth={3} strokeLinejoin="round" />
      <path d="M-80 -20 H80 M-40 -20 V50 M0 -20 V50 M40 -20 V50 M-80 15 H80 M-43 -45 L43 -45" fill="none" stroke="#3b9152" strokeWidth={2} />
      <path d="M-86 -20 L0 -70 L86 -20 Z M-80 -20 H80 V50 H-80 Z" fill="none" stroke={INK} strokeWidth={1.4} opacity={0.5} />
      <rect x={-12} y={14} width={24} height={36} fill="#fffaf0" stroke="#3b9152" strokeWidth={2} />
      {/* Plants showing through the glass. */}
      {[-62, -24, 20, 58].map((x, k) => (
        <g key={x} transform={`translate(${x} 40)`}>
          <path d="M0 0 V-22" stroke="#3b9152" strokeWidth={2.2} strokeLinecap="round" />
          <path d="M0 -10 q-9 -2 -10 -10 q8 1 10 8 M0 -14 q9 -2 10 -10 q-8 1 -10 8" fill="#5fb56f" stroke={INK} strokeWidth={0.8} />
          {k % 2 === 0 && <circle cy={-24} r={4} fill={brights[k % brights.length]} stroke={INK} strokeWidth={0.8} />}
        </g>
      ))}
      <g transform="translate(96 40)">
        <rect x={-14} y={0} width={28} height={16} rx={3} fill="#b9814a" stroke={INK} strokeWidth={1.6} />
        <path d="M-14 4 H14" stroke={INK} strokeWidth={1} opacity={0.4} />
        <circle cx={-6} cy={-6} r={5} fill="#e05a4f" stroke={INK} strokeWidth={1} />
        <circle cx={6} cy={-7} r={5} fill="#efb33e" stroke={INK} strokeWidth={1} />
      </g>
    </>
  );
}

function Barn() {
  return (
    <>
      <Shadow w={90} y={60} />
      <rect x={-70} y={-30} width={140} height={80} fill="#c9553f" stroke={INK} strokeWidth={LINE} />
      <path d="M-76 -30 L-60 -66 L60 -66 L76 -30 Z" fill="#a8412f" stroke={INK} strokeWidth={LINE} strokeLinejoin="round" />
      <path d="M-60 -66 L0 -88 L60 -66" fill="#a8412f" stroke={INK} strokeWidth={LINE} strokeLinejoin="round" />
      <rect x={-26} y={0} width={52} height={50} fill="#8a5a2b" stroke={INK} strokeWidth={LINE} />
      <path d="M-26 0 L26 50 M26 0 L-26 50 M0 0 V50" stroke="#fffaf0" strokeWidth={2.2} opacity={0.7} />
      <rect x={-12} y={-52} width={24} height={16} rx={2} fill="#fffaf0" stroke={INK} strokeWidth={1.4} />
      <path d="M-70 -30 H70" stroke="#fffaf0" strokeWidth={2} opacity={0.4} />
      {/* Crates of apples and a ladder. */}
      {[-96, 92].map((x, k) => (
        <g key={x} transform={`translate(${x} 34)`}>
          <rect x={-16} y={2} width={32} height={20} rx={2} fill="#c88a4a" stroke={INK} strokeWidth={1.6} />
          <path d="M-16 8 H16 M-16 14 H16" stroke="#8a5a2b" strokeWidth={1.2} />
          {[-9, 0, 9].map((cx) => (
            <circle key={cx} cx={cx} cy={-1} r={5} fill={k ? "#efb33e" : "#e05a4f"} stroke={INK} strokeWidth={1} />
          ))}
        </g>
      ))}
      <g transform="translate(46 -20) rotate(12)">
        <path d="M-6 -50 V40 M6 -50 V40 M-6 -36 H6 M-6 -20 H6 M-6 -4 H6 M-6 12 H6 M-6 28 H6" stroke="#8a5a2b" strokeWidth={3} strokeLinecap="round" />
      </g>
    </>
  );
}

function Gazebo() {
  return (
    <>
      <Shadow w={80} y={60} />
      <path d="M-70 40 L-56 52 L56 52 L70 40 Z" fill="#e6dcc6" stroke={INK} strokeWidth={LINE} strokeLinejoin="round" />
      {[-56, -28, 28, 56].map((x) => (
        <rect key={x} x={x - 3} y={-30} width={6} height={72} fill="#fffaf0" stroke={INK} strokeWidth={1.4} />
      ))}
      <path d="M-62 -6 H62 M-62 6 H62" stroke="#fffaf0" strokeWidth={4} />
      <path d="M-62 -6 H62 M-62 6 H62" stroke={INK} strokeWidth={1.2} />
      <path d="M-82 -30 L0 -84 L82 -30 Z" fill="#b36bd4" stroke={INK} strokeWidth={LINE} strokeLinejoin="round" />
      <path d="M-82 -30 H82" stroke={INK} strokeWidth={LINE} />
      <path d="M-56 -36 L0 -74 L56 -36" fill="none" stroke="#fffaf0" strokeWidth={2} opacity={0.5} />
      <circle cx={0} cy={-90} r={5} fill="#fffaf0" stroke={INK} strokeWidth={1.4} />
      {/* A picnic table inside. */}
      <rect x={-30} y={14} width={60} height={8} rx={2} fill="#b9814a" stroke={INK} strokeWidth={1.4} />
      <rect x={-36} y={30} width={72} height={6} rx={2} fill="#c78f55" stroke={INK} strokeWidth={1.4} />
      <path d="M-22 22 L-28 42 M22 22 L28 42" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
      <ellipse cx={-10} cy={13} rx={7} ry={3} fill="#fffaf0" stroke={INK} strokeWidth={1} />
      <ellipse cx={12} cy={13} rx={7} ry={3} fill="#fffaf0" stroke={INK} strokeWidth={1} />
    </>
  );
}

function Fountain() {
  return (
    <>
      <Shadow w={90} y={62} />
      <ellipse cx={0} cy={40} rx={92} ry={30} fill="#e6dcc6" stroke={INK} strokeWidth={LINE} />
      <ellipse cx={0} cy={34} rx={80} ry={24} fill="#bcdcef" stroke="#8fbcd6" strokeWidth={2} />
      <path d="M-54 34 q10 -6 20 0 t20 0 t20 0 t20 0" fill="none" stroke="#8fbcd6" strokeWidth={2} />
      <rect x={-8} y={-10} width={16} height={44} fill="#e6dcc6" stroke={INK} strokeWidth={1.6} />
      <ellipse cx={0} cy={-10} rx={36} ry={11} fill="#bcdcef" stroke={INK} strokeWidth={1.6} />
      <rect x={-5} y={-42} width={10} height={32} fill="#e6dcc6" stroke={INK} strokeWidth={1.4} />
      <ellipse cx={0} cy={-42} rx={16} ry={6} fill="#bcdcef" stroke={INK} strokeWidth={1.4} />
      {/* The spray. */}
      <g className="park-sway">
        <path d="M0 -48 Q-14 -70 -26 -46 M0 -48 Q14 -70 26 -46 M0 -50 V-74" fill="none" stroke="#8fbcd6" strokeWidth={2.4} strokeLinecap="round" />
        <circle cx={-27} cy={-42} r={2.4} fill="#bcdcef" />
        <circle cx={27} cy={-42} r={2.4} fill="#bcdcef" />
        <circle cx={0} cy={-78} r={2.6} fill="#bcdcef" />
      </g>
      <path d="M-40 4 L-40 -2 M40 4 L40 -2" stroke={INK} strokeWidth={1} />
    </>
  );
}

function Library() {
  return (
    <>
      <Shadow w={100} y={60} />
      <rect x={-90} y={44} width={180} height={8} rx={2} fill="#e6dcc6" stroke={INK} strokeWidth={1.8} />
      <rect x={-82} y={-30} width={164} height={76} fill="#fbf3e2" stroke={INK} strokeWidth={LINE} />
      {[-64, -38, 38, 64].map((x) => (
        <rect key={x} x={x - 5} y={-26} width={10} height={70} rx={1} fill="#fffaf0" stroke={INK} strokeWidth={1.6} />
      ))}
      <rect x={-18} y={4} width={36} height={40} rx={3} fill="#4a82de" stroke={INK} strokeWidth={1.8} />
      <path d="M0 4 V44" stroke={INK} strokeWidth={1} opacity={0.5} />
      <rect x={-92} y={-38} width={184} height={10} fill="#fffaf0" stroke={INK} strokeWidth={1.8} />
      <path d="M-100 -38 L0 -80 L100 -38 Z" fill="#4a82de" stroke={INK} strokeWidth={LINE} strokeLinejoin="round" />
      <path d="M-84 -42 L0 -74 L84 -42" fill="none" stroke="#fffaf0" strokeWidth={2} opacity={0.5} />
      <ellipse cx={0} cy={-82} rx={26} ry={12} fill="#7fb0ea" stroke={INK} strokeWidth={1.6} />
      <rect x={-46} y={-58} width={92} height={13} rx={3} fill="#fffaf0" stroke={INK} strokeWidth={1.4} />
      <text y={-48} textAnchor="middle" fontSize={10} fontWeight={900} fill={INK} letterSpacing={2}>
        LIBRARY
      </text>
      {/* A stack of books by the steps. */}
      <g transform="translate(-102 30)">
        <rect x={-14} y={8} width={28} height={7} rx={1} fill="#d9544a" stroke={INK} strokeWidth={1.2} />
        <rect x={-12} y={1} width={26} height={7} rx={1} fill="#3b9152" stroke={INK} strokeWidth={1.2} />
        <rect x={-13} y={-6} width={24} height={7} rx={1} fill="#3f78c9" stroke={INK} strokeWidth={1.2} />
      </g>
    </>
  );
}

function PostOffice() {
  return (
    <>
      <Shadow w={90} y={60} />
      <rect x={-72} y={-34} width={144} height={84} rx={3} fill="#f6e3c3" stroke={INK} strokeWidth={LINE} />
      <path d="M-80 -34 L-80 -46 H80 V-34" fill="#2f6fb8" stroke={INK} strokeWidth={LINE} strokeLinejoin="round" />
      <rect x={-80} y={-46} width={160} height={12} fill="#2f6fb8" stroke={INK} strokeWidth={LINE} />
      <rect x={-56} y={-70} width={112} height={26} rx={4} fill="#fffaf0" stroke={INK} strokeWidth={1.8} />
      <text y={-51} textAnchor="middle" fontSize={11} fontWeight={900} fill="#2f6fb8" letterSpacing={2}>
        POST OFFICE
      </text>
      <rect x={-14} y={8} width={28} height={42} rx={3} fill="#2f6fb8" stroke={INK} strokeWidth={1.8} />
      {[-50, 44].map((x) => (
        <rect key={x} x={x - 11} y={-14} width={22} height={22} rx={2} fill="#cfe6f5" stroke={INK} strokeWidth={1.5} />
      ))}
      <path d="M-30 -12 H30 V4 H-30 Z" fill="#cfe6f5" stroke={INK} strokeWidth={1.5} />
      <path d="M-30 -12 L0 0 L30 -12" fill="none" stroke={INK} strokeWidth={1.2} />
      {/* A big blue postbox and a flagpole out front. */}
      <g transform="translate(-100 24)">
        <rect x={-14} y={-6} width={28} height={36} rx={4} fill="#2f6fb8" stroke={INK} strokeWidth={1.8} />
        <path d="M-14 -6 A14 14 0 0 1 14 -6" fill="#2f6fb8" stroke={INK} strokeWidth={1.8} />
        <rect x={-9} y={-4} width={18} height={4} rx={2} fill={INK} />
        <path d="M-6 30 V36 M6 30 V36" stroke={INK} strokeWidth={2.4} />
      </g>
      <g transform="translate(100 -60)">
        <path d="M0 0 V110" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
        <circle r={3.5} fill="#f3c94b" stroke={INK} strokeWidth={1} />
        <path className="park-sway" d="M2 6 L34 12 L2 22 Z" fill="#e8594a" stroke={INK} strokeWidth={1.2} strokeLinejoin="round" />
      </g>
    </>
  );
}

/** What a lawn's rows of things stand on: a street, a shelf, a lane, a bunting line, a soil bed. */
export function RowDressing({ kind, rows }: { kind: ThingKind; rows: { y: number; x0: number; x1: number }[] }) {
  if (kind === "person")
    return (
      <>
        {rows.map((r, i) => (
          <g key={i}>
            <rect x={r.x0 - 30} y={r.y + 34} width={r.x1 - r.x0 + 60} height={26} rx={13} fill="#efe3c4" stroke="#dccb9f" strokeWidth={3} />
            <path d={`M${r.x0 - 10} ${r.y + 47} H${r.x1 + 10}`} stroke="#fffaf0" strokeWidth={2} strokeDasharray="14 12" />
          </g>
        ))}
      </>
    );
  if (kind === "file")
    return (
      <>
        {rows.map((r, i) => (
          <g key={i}>
            <rect x={r.x0 - 16} y={r.y + 30} width={r.x1 - r.x0 + 32} height={10} rx={2} fill="#b9814a" stroke={INK} strokeWidth={1.6} />
            <rect x={r.x0 - 16} y={r.y + 40} width={r.x1 - r.x0 + 32} height={4} fill="#8a5a2b" />
          </g>
        ))}
      </>
    );
  if (kind === "mail")
    return (
      <>
        {rows.map((r, i) => (
          <rect key={i} x={r.x0 - 24} y={r.y + 28} width={r.x1 - r.x0 + 48} height={16} rx={8} fill="#efe3c4" stroke="#dccb9f" strokeWidth={2.5} />
        ))}
      </>
    );
  if (kind === "event")
    return (
      <>
        {rows.map((r, i) => (
          <path key={i} d={`M${r.x0 - 20} ${r.y - 56} H${r.x1 + 20}`} stroke={INK} strokeWidth={1.2} strokeDasharray="6 10" opacity={0.5} />
        ))}
      </>
    );
  if (kind === "habit")
    return (
      <>
        {rows.map((r, i) => (
          <rect key={i} x={r.x0 - 20} y={r.y - 14} width={r.x1 - r.x0 + 40} height={50} rx={10} fill="#a98b5c" opacity={0.35} />
        ))}
      </>
    );
  return null;
}

/** A lamp post beside a path. */
export function Lamp() {
  return (
    <g>
      <ellipse cy={14} rx={10} ry={3} fill={INK} opacity={0.12} />
      <path d="M0 14 V-30" stroke={INK} strokeWidth={2.6} strokeLinecap="round" />
      <rect x={-6} y={8} width={12} height={6} rx={2} fill={INK} />
      <path d="M-8 -30 L0 -44 L8 -30 Z" fill="#f3d27a" stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
      <circle cy={-32} r={4} fill="#fff4c2" />
    </g>
  );
}

/** The park's entrance: an iron arch over the path in, with the park's name. */
export function Gate({ name }: { name: string }) {
  const w = Math.max(220, name.length * 15 + 80);
  return (
    <g>
      <ellipse cy={40} rx={w / 2 + 10} ry={10} fill={INK} opacity={0.1} />
      {[-w / 2, w / 2].map((x) => (
        <g key={x}>
          <rect x={x - 10} y={-60} width={20} height={100} rx={3} fill="#e6dcc6" stroke={INK} strokeWidth={LINE} />
          <rect x={x - 13} y={-66} width={26} height={8} rx={2} fill="#e6dcc6" stroke={INK} strokeWidth={1.6} />
          <circle cx={x} cy={-74} r={7} fill="#3b9152" stroke={INK} strokeWidth={1.6} />
        </g>
      ))}
      <path d={`M${-w / 2 + 10} -60 Q0 -110 ${w / 2 - 10} -60`} fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round" />
      <path d={`M${-w / 2 + 10} -52 Q0 -100 ${w / 2 - 10} -52`} fill="none" stroke={INK} strokeWidth={2} />
      {Array.from({ length: 9 }, (_, i) => {
        const x = (-w / 2 + 30) + ((w - 60) * i) / 8;
        return <path key={i} d={`M${x} -54 V-40`} stroke={INK} strokeWidth={1.6} />;
      })}
      <rect x={-w / 2 + 24} y={-96} width={w - 48} height={26} rx={6} fill="#f4e0b0" stroke={INK} strokeWidth={2} />
      <text y={-77} textAnchor="middle" className="font-serif" fontSize={19} fill={INK}>
        {name}
      </text>
    </g>
  );
}
