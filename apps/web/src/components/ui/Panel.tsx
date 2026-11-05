import type { ReactNode } from "react";

/** Compact panel: hairline border, surface fill, no drop shadow (Design.md §4.1). */
export function Panel({
  title,
  overline,
  subtitle,
  action,
  children,
  className = "",
}: {
  title?: ReactNode;
  overline?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const hasHeader = Boolean(title || overline || subtitle || action);

  return (
    <section className={`rounded-md border border-hairline bg-surface p-4 transition-colors ${className}`}>
      {hasHeader ? (
        <header className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-0.5">
            {overline ? (
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-secondary">
                {overline}
              </span>
            ) : null}
            {title ? (
              typeof title === "string" ? (
                <h2
                  className={
                    overline
                      ? "font-serif text-base font-medium tracking-tight text-primary"
                      : "font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-balance text-secondary"
                  }
                >
                  {title}
                </h2>
              ) : (
                title
              )
            ) : null}
            {subtitle ? (
              <p className="font-sans text-xs text-secondary">
                {subtitle}
              </p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}