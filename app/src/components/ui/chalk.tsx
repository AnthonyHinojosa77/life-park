import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Hand-drawn crayon and chalk look. The texture comes from SVG filters that
 * roughen edges and streak the fill, so nothing is an image and it stays
 * crisp at any size. Render <ChalkDefs /> once on any screen that uses these.
 */
export function ChalkDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
      <defs>
        {/* Crayon fill: wobbly, jagged edges, waxy streaks, and small bare spots. */}
        <filter id="chalk-fill" x="-8%" y="-35%" width="116%" height="170%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="4" result="wobble" />
          <feDisplacementMap in="SourceGraphic" in2="wobble" scale="10" xChannelSelector="R" yChannelSelector="G" result="bent" />
          <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="9" result="grain" />
          <feDisplacementMap in="bent" in2="grain" scale="6" xChannelSelector="R" yChannelSelector="G" result="rough" />
          <feTurbulence type="fractalNoise" baseFrequency="0.02 0.4" numOctaves="4" seed="11" result="streaks" />
          <feColorMatrix in="streaks" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.7 1.8" result="streakMask" />
          <feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="1" seed="3" result="fine" />
          <feColorMatrix in="fine" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.3 1.5" result="fineMask" />
          <feComposite in="rough" in2="streakMask" operator="in" result="streaked" />
          <feComposite in="streaked" in2="fineMask" operator="in" />
        </filter>
        {/* Crayon edge only: same wobbly, jagged outline as the fill, but fully opaque. */}
        <filter id="chalk-edge" x="-8%" y="-35%" width="116%" height="170%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="4" result="wobble" />
          <feDisplacementMap in="SourceGraphic" in2="wobble" scale="10" xChannelSelector="R" yChannelSelector="G" result="bent" />
          <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="9" result="grain" />
          <feDisplacementMap in="bent" in2="grain" scale="6" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        {/* Chalk line: a wobbly, grainy outline. */}
        <filter id="chalk-line" x="-5%" y="-20%" width="110%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="7" result="grain" />
          <feDisplacementMap in="SourceGraphic" in2="grain" scale="4" xChannelSelector="R" yChannelSelector="G" result="rough" />
          <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="1" seed="2" result="dust" />
          <feColorMatrix in="dust" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2 1.7" result="dustMask" />
          <feComposite in="rough" in2="dustMask" operator="in" />
        </filter>
        {/* Loose chalk dust: sparse specks scattered over a surface. */}
        <filter id="chalk-dust" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="1" seed="21" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.13  0 0 0 0 0.2  0 0 0 0 0.16  0 0 0 -30 7.8" />
        </filter>
      </defs>
    </svg>
  );
}

/** Scattered specks over a surface. Place inside a relatively positioned parent. */
export function ChalkDust({ className = "" }: { className?: string }) {
  return (
    <svg className={`pointer-events-none absolute inset-0 h-full w-full opacity-70 ${className}`} aria-hidden="true">
      <rect width="100%" height="100%" filter="url(#chalk-dust)" />
    </svg>
  );
}

type Tone = "google" | "apple" | "grass" | "outline";

const labels: Record<Tone, string> = {
  google: "text-[#2b2b2b]",
  apple: "text-white",
  grass: "text-white",
  outline: "text-ink",
};

/** The scribbled shape behind a button's label, drawn in a 300 x 56 box. */
function Scribble({ tone }: { tone: Tone }) {
  if (tone === "google") {
    return (
      <>
        <rect x="8" y="8" width="284" height="40" rx="18" fill="#efe9dc" filter="url(#chalk-fill)" />
        <g fill="none" strokeWidth="7" strokeLinecap="round" filter="url(#chalk-fill)" opacity="0.85">
          <path d="M14 14 C 80 6, 150 10, 206 9" stroke="#e8594a" />
          <path d="M200 10 C 240 8, 276 9, 290 18" stroke="#f2c230" />
          {/* Down the right edge, so the loop closes. */}
          <path d="M290 16 C 292 24, 291 32, 289 41" stroke="#f2c230" />
          <path d="M288 40 C 240 49, 170 48, 110 47" stroke="#4f9a5b" />
          <path d="M112 47 C 70 49, 30 47, 12 38" stroke="#4a82de" />
          <path d="M12 15 C 9 24, 10 32, 13 39" stroke="#e8594a" />
        </g>
      </>
    );
  }
  if (tone === "outline") {
    return (
      <>
        <rect x="8" y="8" width="284" height="40" rx="20" fill="#e7e2d8" filter="url(#chalk-fill)" opacity="0.9" />
        <rect x="8" y="8" width="284" height="40" rx="20" fill="none" stroke="#22332a" strokeWidth="3" filter="url(#chalk-line)" />
      </>
    );
  }
  // Deep enough that the light label stays readable (about 4.5:1 contrast).
  const fill = tone === "apple" ? "#2e2e2e" : "#3a7f43";
  return <rect x="4" y="5" width="292" height="46" rx="10" fill={fill} filter="url(#chalk-fill)" />;
}

type ChalkButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone: Tone;
  icon?: ReactNode;
};

/** A full-width button that looks colored in with crayon, with a hand-lettered label. */
export function ChalkButton({ tone, icon, className = "", children, ...rest }: ChalkButtonProps) {
  return (
    <button
      className={`relative isolate inline-flex h-14 w-full items-center justify-center gap-3 px-6 font-hand text-[22px] leading-none transition-[transform,opacity] duration-100 active:scale-[0.98] disabled:opacity-50 ${labels[tone]} ${className}`}
      {...rest}
    >
      <svg
        className="absolute inset-0 -z-10 h-full w-full overflow-visible"
        viewBox="0 0 300 56"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <Scribble tone={tone} />
      </svg>
      {icon}
      <span className="pt-0.5">{children}</span>
    </button>
  );
}

/** Colors the chalk pieces draw with, matching the Paper stamp palette. */
export const chalk = {
  grass: "#3a7f43",
  grassLight: "#58c26a",
  sun: "#ffd95a",
  paper: "#e9e1cf",
  ink: "#22332a",
  charcoal: "#2e2e2e",
} as const;

type SurfaceProps = {
  color: string;
  radius?: number | string;
  opacity?: number;
  /** Opaque underneath so light text on a dark fill always stays readable. */
  solid?: boolean;
  /** Crayon streak color drawn over a solid fill. */
  texture?: string;
};

/**
 * A crayon-colored background that fills its parent. The parent needs
 * `relative isolate`. Sizes in percent so the texture never stretches.
 */
export function ChalkFill({ color, radius = 12, opacity = 1, solid = false, texture }: SurfaceProps) {
  return (
    <svg className="pointer-events-none absolute inset-0 -z-10 h-full w-full overflow-visible" aria-hidden="true">
      {solid ? (
        <>
          <rect width="100%" height="100%" rx={radius} fill={color} opacity={opacity} filter="url(#chalk-edge)" />
          {texture && <rect width="100%" height="100%" rx={radius} fill={texture} opacity={0.55} filter="url(#chalk-fill)" />}
        </>
      ) : (
        <rect width="100%" height="100%" rx={radius} fill={color} opacity={opacity} filter="url(#chalk-fill)" />
      )}
    </svg>
  );
}

/** A chalk-drawn outline around its parent. The parent needs `relative isolate`. */
export function ChalkOutline({
  color = chalk.ink,
  radius = 12,
  width = 2.5,
  className = "",
}: {
  color?: string;
  radius?: number | string;
  width?: number;
  className?: string;
}) {
  return (
    <svg className={`pointer-events-none absolute inset-0 -z-10 h-full w-full overflow-visible ${className}`} aria-hidden="true">
      <rect width="100%" height="100%" rx={radius} fill="none" stroke={color} strokeWidth={width} filter="url(#chalk-line)" />
    </svg>
  );
}
