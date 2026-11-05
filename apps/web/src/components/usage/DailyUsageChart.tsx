import { formatNumber } from "../../lib/format";
import type { DailyUsageSummary } from "./types";

/** CSS column bar chart over `daily` (no chart dependency): one column per WIB day. */
export function DailyUsageChart({ daily }: { daily: DailyUsageSummary[] }) {
  const maxTokens = Math.max(1, ...daily.map((d) => d.tokens));

  return (
    <div
      data-testid="daily-usage-chart"
      className="flex h-40 items-end gap-1 border-b border-hairline pb-1"
    >
      {daily.map((day) => {
        const heightPct = day.tokens === 0 ? 0 : Math.max(4, (day.tokens / maxTokens) * 100);
        return (
          <div
            key={day.date}
            data-testid="daily-bar"
            data-date={day.date}
            data-tokens={day.tokens}
            className="group relative flex h-full flex-1 flex-col justify-end items-center"
            title={`${day.date} · ${formatNumber(day.tokens)} token · ${formatNumber(day.requests)} request`}
          >
            <div
              className="w-full rounded-t-sm bg-accent transition-all"
              style={{ height: `${heightPct}%` }}
            />
            <span className="mt-1 shrink-0 font-mono text-[9px] tabular-nums text-secondary">
              {day.date.slice(8, 10)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
