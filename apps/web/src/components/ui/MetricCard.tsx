import type { ReactNode } from "react";

export function MetricCard({
  label,
  value,
  unit,
  badge,
  caption,
  footer,
  tone = "primary",
  className = "",
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  badge?: ReactNode;
  caption?: ReactNode;
  footer?: ReactNode;
  tone?: "primary" | "success" | "accent" | "error";
  className?: string;
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "accent"
        ? "text-accent"
        : tone === "error"
          ? "text-error"
          : "text-primary";

  return (
    <div
      className={`flex flex-col justify-between rounded-md border border-hairline bg-surface p-3.5 transition-colors ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-secondary">
          {label}
        </span>
        {badge}
      </div>

      <div className="mt-1.5">
        <div className={`font-mono text-[22px] leading-7 font-semibold tracking-tight tabular-nums ${toneClass}`}>
          {value}
          {unit ? (
            <span className="ml-1 font-mono text-[11px] font-normal tracking-normal text-secondary">
              {unit}
            </span>
          ) : null}
        </div>
        {caption ? (
          <p className="mt-1 font-sans text-xs text-secondary">
            {caption}
          </p>
        ) : null}
      </div>

      {footer ? <div className="mt-2.5 border-t border-hairline pt-2">{footer}</div> : null}
    </div>
  );
}