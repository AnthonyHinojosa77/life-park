import { ChalkFill, ChalkOutline, chalk } from "@/components/ui/chalk";

type WordmarkProps = {
  size?: "sm" | "md" | "lg";
  /**
   * Draws itself in: the badge colors in, its outline and the tree are drawn
   * stroke by stroke, then the name is written out. Used by the sign-in intro.
   */
  drawn?: boolean;
};

const sizes = {
  sm: { badge: 32, icon: 18, text: "text-[22px]", gap: "gap-2" },
  md: { badge: 40, icon: 22, text: "text-[27px]", gap: "gap-2.5" },
  lg: { badge: 56, icon: 30, text: "text-[40px]", gap: "gap-3.5" },
} as const;

/** The LifePark wordmark: a stamped tree badge next to the serif name. */
export function Wordmark({ size = "md", drawn = false }: WordmarkProps) {
  const s = sizes[size];
  return (
    <div className={`flex items-center ${s.gap}`}>
      <span
        aria-hidden="true"
        className="relative isolate flex items-center justify-center rounded-[14px]"
        style={{ width: s.badge, height: s.badge }}
      >
        {drawn ? (
          <>
            <span className="intro-badge-fill absolute inset-0 -z-10">
              <ChalkFill color={chalk.grassLight} radius={12} />
            </span>
            <span className="intro-sweep absolute inset-0 -z-10">
              <ChalkOutline radius={12} width={2} />
            </span>
          </>
        ) : (
          <>
            <ChalkFill color={chalk.grassLight} radius={12} />
            <ChalkOutline radius={12} width={2} />
          </>
        )}
        <TreeIcon size={s.icon} drawn={drawn} />
      </span>
      <span className={`font-serif tracking-tight ${s.text} ${drawn ? "intro-write" : ""}`}>LifePark</span>
    </div>
  );
}

function TreeIcon({ size, drawn }: { size: number; drawn: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#ffffff"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 21v-7" pathLength={drawn ? 1 : undefined} className={drawn ? "intro-trunk" : undefined} />
      <path
        d="M6 14c-2.2 0-4-1.8-4-4 0-1.8 1.2-3.3 2.8-3.8C5.2 3.6 7.4 2 10 2c2 0 3.8 1 4.8 2.6C17.7 4.9 20 7.2 20 10c0 2.2-1.8 4-4 4H6z"
        pathLength={drawn ? 1 : undefined}
        className={drawn ? "intro-canopy" : undefined}
      />
    </svg>
  );
}
