import type { ReactNode } from "react";

/** Compact panel: hairline border, surface fill, no drop shadow (Design.md §4.1). */
export function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-md border border-hairline bg-surface p-3 ${className}`}>
      {title ? (
        <header className="mb-3 flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.05em] text-secondary">
            {title}
          </h2>
          {action}
        </header>
      ) : null}
      {children}
    </section>
  );
}