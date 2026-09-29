import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ChalkFill, ChalkOutline, chalk } from "./chalk";

export type ButtonVariant = "press" | "stamp" | "soft" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
};

const text: Record<ButtonVariant, string> = {
  press: "text-white",
  stamp: "text-ink",
  soft: "text-ink",
  ghost: "text-ink-soft hover:bg-card",
  danger: "text-white",
};

/** Red crayon, for the few actions that delete something for good. */
const RED = "#c9402f";

/**
 * Each variant is drawn in crayon rather than floated on a shadow:
 * press is the main action (green), stamp is emphasis (chalk outline),
 * soft is everyday (pale crayon), ghost has no chrome, danger is red.
 */
function Surface({ variant, radius }: { variant: ButtonVariant; radius: number | string }) {
  if (variant === "press") return <ChalkFill color={chalk.grass} radius={radius} />;
  if (variant === "danger") return <ChalkFill color={RED} radius={radius} />;
  if (variant === "soft") return <ChalkFill color={chalk.paper} radius={radius} />;
  if (variant === "stamp") {
    return (
      <>
        <ChalkFill color={chalk.paper} radius={radius} opacity={0.7} />
        <ChalkOutline radius={radius} />
      </>
    );
  }
  return null;
}

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-[17px] gap-1.5",
  md: "h-11 px-5 text-[19px] gap-2",
  lg: "h-12 px-6 text-[21px] gap-2.5",
};

export function Button({
  variant = "press",
  size = "md",
  icon,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      data-variant={variant}
      className={`relative isolate inline-flex items-center justify-center rounded-pill font-hand leading-none transition-[transform,filter] duration-100 hover:brightness-105 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 ${text[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      <Surface variant={variant} radius={12} />
      {icon}
      <span className="pt-0.5">{children}</span>
    </button>
  );
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  label: string;
  children: ReactNode;
};

/** A round button holding only an icon. `label` is read by screen readers. */
export function IconButton({
  variant = "soft",
  label,
  className = "",
  children,
  ...rest
}: IconButtonProps) {
  return (
    <button
      aria-label={label}
      title={label}
      data-variant={variant}
      className={`relative isolate inline-flex size-11 items-center justify-center rounded-full transition-transform duration-100 active:scale-95 disabled:opacity-50 ${text[variant]} ${className}`}
      {...rest}
    >
      <Surface variant={variant} radius="50%" />
      {children}
    </button>
  );
}
