import { Badge } from "../ui/Badge";
import type { Telemetry } from "../../lib/types";

const TIER_TONE: Record<string, "accent" | "success" | "secondary"> = {
  LORA: "accent",
  STABLE: "success",
  FLEX: "secondary",
};

export function PoolStatusCard({ pool }: { pool: Telemetry["pools"][number] }) {
  const tone = TIER_TONE[pool.tier] ?? "secondary";
  const barColor =
    pool.tier === "LORA"
      ? "var(--accent-main)"
      : pool.tier === "STABLE"
        ? "var(--state-success)"
        : pool.load_pct > 70
          ? "var(--accent-main)"
          : "var(--text-secondary)";

  return (
    <div className="rounded-md border border-hairline bg-surface p-3">
      <div className="flex items-center justify-between">
        <Badge tone={tone}>{pool.tier}</Badge>
        <span className="font-mono text-[11px] tabular-nums text-secondary">
          {pool.recent_requests} req
        </span>
      </div>
      <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-secondary">
        Beban
      </p>
      <div className="mt-1 h-1.5 w-full rounded-full" style={{ background: "var(--bg-canvas)" }}>
        <div
          className="h-1.5 rounded-full transition-all"
          style={{ width: `${Math.min(100, pool.load_pct)}%`, background: barColor }}
        />
      </div>
      <p className="mt-1 text-right font-mono text-[11px] tabular-nums text-primary">
        {pool.load_pct}%
      </p>
    </div>
  );
}