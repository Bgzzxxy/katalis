import { Badge } from "../ui/Badge";
import { formatNumber } from "../../lib/format";
import { POOL_LABELS } from "../../lib/model-catalog";
import type { Telemetry } from "../../lib/types";

const TIER_TONE: Record<string, "accent" | "success" | "secondary"> = {
  LORA: "accent",
  STABLE: "success",
  FLEX: "secondary",
};

export function PoolStatusCard({ pool }: { pool: Telemetry["pools"][number] }) {
  const tone = TIER_TONE[pool.tier] ?? "secondary";
  const label = POOL_LABELS[pool.tier] ?? pool.tier;

  const barColor =
    pool.tier === "LORA"
      ? "var(--accent-main)"
      : pool.tier === "STABLE"
        ? "var(--state-success)"
        : pool.load_pct > 70
          ? "var(--state-warning)"
          : "var(--text-secondary)";

  return (
    <div className="rounded-md border border-hairline bg-surface p-3.5 transition-colors">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge tone={tone}>{pool.tier}</Badge>
          <span className="font-mono text-[11px] text-secondary">
            {label}
          </span>
        </div>
        <span className="font-mono text-[11px] tabular-nums text-secondary">
          {formatNumber(pool.recent_requests)} req
        </span>
      </div>

      <div className="mt-2.5 space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.05em] text-secondary">
            Beban
          </span>
          <span className="font-mono text-[11px] font-semibold tabular-nums text-primary">
            {pool.load_pct}%
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-canvas overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${Math.min(100, Math.max(0, pool.load_pct))}%`,
              background: barColor,
            }}
          />
        </div>
      </div>
    </div>
  );
}