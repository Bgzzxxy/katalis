import { Button } from "../ui/Button";
import { formatDateTime, formatIdr, formatLatency, formatNumber } from "../../lib/format";
import type { ApiError } from "../../lib/types";
import type { UsageHistoryItem } from "./types";

export function HistoryTable({
  items,
  total,
  hasMore,
  isLoadingMore,
  error,
  onLoadMore,
}: {
  items: UsageHistoryItem[];
  total: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  error: ApiError | null;
  onLoadMore: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="font-mono text-[11px] text-secondary">
        Menampilkan {formatNumber(items.length)} dari {formatNumber(total)} baris
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-[12px]">
          <thead>
            <tr className="border-b border-hairline text-secondary">
              <th className="pb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.06em]">
                Waktu
              </th>
              <th className="pb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.06em]">
                Model
              </th>
              <th className="pb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.06em]">
                API Key
              </th>
              <th className="pb-2 text-right font-mono text-[11px] font-semibold uppercase tracking-[0.06em]">
                Token In
              </th>
              <th className="pb-2 text-right font-mono text-[11px] font-semibold uppercase tracking-[0.06em]">
                Token Out
              </th>
              <th className="pb-2 text-right font-mono text-[11px] font-semibold uppercase tracking-[0.06em]">
                Biaya
              </th>
              <th className="pb-2 text-right font-mono text-[11px] font-semibold uppercase tracking-[0.06em]">
                Latensi
              </th>
              <th className="pb-2 text-right font-mono text-[11px] font-semibold uppercase tracking-[0.06em]">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                data-testid="history-item-row"
                data-id={String(item.id)}
                className="border-b border-hairline last:border-0"
              >
                <td className="py-2 font-mono text-[11px] tabular-nums text-secondary">
                  {formatDateTime(item.created_at)}
                </td>
                <td className="py-2 font-mono font-medium text-primary">{item.model_id}</td>
                <td className="py-2 text-secondary">{item.api_key_name}</td>
                <td className="py-2 text-right font-mono tabular-nums text-primary">
                  {formatNumber(item.prompt_tokens)}
                </td>
                <td className="py-2 text-right font-mono tabular-nums text-primary">
                  {formatNumber(item.completion_tokens)}
                </td>
                <td className="py-2 text-right font-mono tabular-nums text-primary">
                  {formatIdr(item.cost_idr)}
                </td>
                <td className="py-2 text-right font-mono tabular-nums text-secondary">
                  {formatLatency(item.latency_ms)}
                </td>
                <td className="py-2 text-right">
                  <span
                    className={`font-mono text-[11px] font-medium tabular-nums ${
                      item.http_status >= 200 && item.http_status < 300
                        ? "text-success"
                        : "text-error"
                    }`}
                  >
                    {item.http_status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error ? (
        <p className="font-mono text-[11px] text-error">{error.errorCodeLabel}</p>
      ) : null}

      {hasMore ? (
        <div className="flex justify-center pt-1">
          <Button
            type="button"
            variant="secondary"
            disabled={isLoadingMore}
            onClick={onLoadMore}
          >
            {isLoadingMore ? "Memuat..." : "Muat lebih banyak"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
