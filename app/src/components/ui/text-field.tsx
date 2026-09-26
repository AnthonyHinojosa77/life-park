import type { InputHTMLAttributes } from "react";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
};

export function TextField({
  label,
  hint,
  error,
  id,
  className = "",
  ...rest
}: TextFieldProps) {
  const inputId = id ?? `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const edge = error ? "border-ink" : "border-tan focus:border-ink";
  return (
    <label htmlFor={inputId} className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-[13px] font-extrabold">{label}</span>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${inputId}-note` : undefined}
        className={`h-12 rounded-pill border-2 bg-card px-4 text-base font-semibold text-ink outline-none placeholder:text-placeholder ${edge}`}
        {...rest}
      />
      {(error || hint) && (
        <span
          id={`${inputId}-note`}
          className={`px-1 text-xs font-semibold ${error ? "text-ink" : "text-muted"}`}
        >
          {error ?? hint}
        </span>
      )}
    </label>
  );
}
