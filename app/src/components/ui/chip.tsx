import type { HTMLAttributes, ReactNode } from "react";
import { ChalkFill, chalk } from "./chalk";

export type ChipVariant = "sun" | "grass" | "soft" | "ink";

type ChipProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: ChipVariant;
  icon?: ReactNode;
  /** Small caps with letter spacing, the stamped-label look. */
  label?: boolean;
};

const variants: Record<ChipVariant, string> = {
  // Selected or highlighted: colored in with yellow crayon.
  sun: "relative isolate text-ink",
  grass: "bg-grass-light text-grass-deep",
  soft: "bg-card text-ink-soft border-2 border-tan",
  ink: "bg-ink text-paper",
};

export function Chip({
  variant = "soft",
  icon,
  label = false,
  className = "",
  children,
  ...rest
}: ChipProps) {
  const type = label
    ? "text-[11px] font-extrabold uppercase tracking-[0.05em]"
    : "text-xs font-extrabold";
  return (
    <span
      className={`inline-flex h-7 items-center gap-1.5 rounded-pill px-3 ${type} ${variants[variant]} ${className}`}
      {...rest}
    >
      {variant === "sun" && <ChalkFill color={chalk.sun} radius={10} />}
      {icon}
      {children}
    </span>
  );
}
