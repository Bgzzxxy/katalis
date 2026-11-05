import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger";

const VARIANT_CLASS: Record<Variant, string> = {
  primary: "bg-primary text-surface border border-primary",
  secondary: "bg-surface text-primary border border-hairline hover:border-accent",
  danger: "bg-surface text-error border border-error",
};

export function Button({
  variant = "secondary",
  children,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; children: ReactNode }) {
  return (
    <button
      {...rest}
      className={`rounded px-3 py-1.5 font-mono text-[11px] disabled:opacity-50 ${VARIANT_CLASS[variant]} ${className}`}
    >
      {children}
    </button>
  );
}