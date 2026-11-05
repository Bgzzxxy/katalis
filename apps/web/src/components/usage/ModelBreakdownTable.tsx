import { formatIdr, formatNumber } from "../../lib/format";
import type { ModelUsageSummary } from "./types";

export function ModelBreakdownTable({ rows }: { rows: ModelUsageSummary[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[12px]">
        <thead>
          <tr className="border-b border-hairline text-secondary">
            <th className="pb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.06em]">
              Model
            </th>
            <th className="pb-2 text-right font-mono text-[11px] font-semibold uppercase tracking-[0.06em]">
              Request
            </th>
            <th className="pb-2 text-right font-mono text-[11px] font-semibold uppercase tracking-[0.06em]">
              Token
            </th>
            <th className="pb-2 text-right font-mono text-[11px] font-semibold uppercase tracking-[0.06em]">
              Biaya
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.model_id} className="border-b border-hairline last:border-0">
              <td className="py-2 font-mono font-medium text-primary">{row.model_id}</td>
              <td className="py-2 text-right font-mono tabular-nums text-primary">
                {formatNumber(row.requests)}
              </td>
              <td className="py-2 text-right font-mono tabular-nums text-primary">
                {formatNumber(row.tokens)}
              </td>
              <td className="py-2 text-right font-mono tabular-nums text-primary">
                {formatIdr(row.cost_idr)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
