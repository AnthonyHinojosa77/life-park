type WordmarkProps = {
  size?: "sm" | "md" | "lg";
};

const sizes = {
  sm: { badge: 32, icon: 18, text: "text-[22px]", gap: "gap-2" },
  md: { badge: 40, icon: 22, text: "text-[27px]", gap: "gap-2.5" },
  lg: { badge: 56, icon: 30, text: "text-[40px]", gap: "gap-3.5" },
} as const;

/** The LifePark wordmark: a stamped leaf badge next to the serif name. */
export function Wordmark({ size = "md" }: WordmarkProps) {
  const s = sizes[size];
  return (
    <div className={`flex items-center ${s.gap}`}>
      <span
        aria-hidden="true"
        className="flex items-center justify-center rounded-[14px] border-2 border-ink bg-grass shadow-[var(--shadow-stamp-sm)]"
        style={{ width: s.badge, height: s.badge }}
      >
        <LeafIcon size={s.icon} />
      </span>
      <span className={`font-serif tracking-tight ${s.text}`}>LifePark</span>
    </div>
  );
}

function LeafIcon({ size }: { size: number }) {
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
      <path d="M12 21v-7" />
      <path d="M6 14c-2.2 0-4-1.8-4-4 0-1.8 1.2-3.3 2.8-3.8C5.2 3.6 7.4 2 10 2c2 0 3.8 1 4.8 2.6C17.7 4.9 20 7.2 20 10c0 2.2-1.8 4-4 4H6z" />
    </svg>
  );
}
