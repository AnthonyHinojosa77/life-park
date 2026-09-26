import type { HTMLAttributes } from "react";
import { ChalkOutline } from "./chalk";

export type CardVariant = "stamp" | "soft" | "inset";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
};

const variants: Record<CardVariant, string> = {
  // The one card per screen that stands out: a chalk-drawn outline, no floating shadow.
  stamp: "relative isolate bg-card",
  // Everything else. Cream with a tan edge.
  soft: "bg-card border-2 border-tan",
  // A pocket inside another card.
  inset: "bg-paper",
};

export function Card({ variant = "soft", className = "", children, ...rest }: CardProps) {
  return (
    <div className={`rounded-card ${variants[variant]} ${className}`} {...rest}>
      {variant === "stamp" && <ChalkOutline radius={22} />}
      {children}
    </div>
  );
}
