export function MetricCard({
  label,
  value,
  unit,
  tone = "primary",
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: "primary" | "success" | "accent" | "error";
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
    <div className="rounded-md border border-hairline bg-surface p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-secondary">
        {label}
      </p>
      <p className={`mt-1 font-mono text-xl font-semibold tabular-nums ${toneClass}`}>
        {value}
        {unit ? <span className="ml-1 text-[11px] text-secondary">{unit}</span> : null}
      </p>
    </div>
  );
}
