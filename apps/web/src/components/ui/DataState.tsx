import type { ReactNode } from "react";

export type EmptyAction = { label: string; onClick: () => void };

export type DataStateProps = {
  state: "loading" | "empty" | "error" | "populated";
  children?: ReactNode;
  /** Skeleton row count while loading (Design.md §6 state 1). */
  skeletonRows?: number;
  emptyLabel?: string;
  emptyAction?: EmptyAction;
  /** Technical error label, e.g. "HTTP 401 · INVALID_API_KEY". */
  errorCode?: string;
  errorMessage?: string;
  onRetry?: () => void;
};

/**
 * Enforces the 4 mandatory data states (Design.md §6) in one place so every
 * data component renders Loading, Empty, Error and Populated consistently.
 */
export function DataState({
  state,
  children,
  skeletonRows = 3,
  emptyLabel = "Belum ada data",
  emptyAction,
  errorCode,
  errorMessage,
  onRetry,
}: DataStateProps) {
  if (state === "loading") {
    return (
      <div data-testid="data-skeleton" className="space-y-2" aria-busy="true">
        {Array.from({ length: skeletonRows }).map((_, i) => (
          <div
            key={i}
            className="h-9 w-full animate-pulse rounded border border-hairline bg-canvas"
          />
        ))}
      </div>
    );
  }

  if (state === "empty") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-hairline px-4 py-8 text-center">
        <p className="font-serif text-lg font-medium text-balance text-primary">
          {emptyLabel}
        </p>
        {emptyAction ? (
          <button
            type="button"
            onClick={emptyAction.onClick}
            className="rounded bg-primary px-3 py-1.5 font-sans text-xs font-medium text-surface"
          >
            {emptyAction.label}
          </button>
        ) : null}
      </div>
    );
  }

  if (state === "error") {
    return (
      <div
        data-testid="data-error"
        className="rounded-md border p-4"
        style={{ background: "var(--error-subtle)", borderColor: "var(--state-error)" }}
        role="alert"
      >
        {errorCode ? (
          <p className="font-mono text-[11px] uppercase tracking-[0.05em] text-error">
            {errorCode}
          </p>
        ) : null}
        <p className="mt-1 text-[13px] text-pretty text-primary">{errorMessage ?? "Terjadi kesalahan"}</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 rounded border border-primary bg-surface px-3 py-1.5 font-sans text-xs font-medium text-primary"
          >
            Coba Lagi
          </button>
        ) : null}
      </div>
    );
  }

  return <>{children}</>;
}