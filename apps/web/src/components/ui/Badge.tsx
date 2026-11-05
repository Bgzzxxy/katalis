import type { ReactNode } from "react";

type BadgeTone = "accent" | "success" | "secondary" | "error";

const TONE: Record<BadgeTone, string> = {
  accent: "text-accent border-accent",
  success: "text-success border-success",
  secondary: "text-secondary border-hairline",
  error: "text-error border-error",
};

export function Badge({
  tone = "secondary",
  children,
}: {
  tone?: BadgeTone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-block rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium ${TONE[tone]}`}
    >
      {children}
    </span>
  );
}