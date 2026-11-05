import { useCallback, useEffect, useState } from "react";
import { ApiError, type DataStatus, type OPENAI_ERROR_SHAPE } from "../lib/types";
import type { UsageSummary } from "../components/usage/types";

export type UsageSummaryState = {
  status: DataStatus;
  data: UsageSummary | null;
  error: ApiError | null;
  days: 7 | 30;
  setDays: (days: 7 | 30) => void;
  refresh: () => Promise<void>;
};

export function useUsageSummary(initialDays: 7 | 30 = 7): UsageSummaryState {
  const [days, setDays] = useState<7 | 30>(initialDays);
  const [status, setStatus] = useState<DataStatus>("loading");
  const [data, setData] = useState<UsageSummary | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const refresh = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch(`/api/billing/usage/summary?days=${days}`, {
        credentials: "include",
      });

      if (!res.ok) {
        let body: OPENAI_ERROR_SHAPE | null = null;
        try {
          body = (await res.json()) as OPENAI_ERROR_SHAPE;
        } catch {
          // ignore non-json error body
        }
        const message = body?.error?.message ?? "Gagal memuat ringkasan pemakaian";
        const code = body?.error?.code ?? `HTTP_${res.status}`;
        throw new ApiError(res.status, code, message, body?.error?.type ?? "api_error");
      }

      const summary = (await res.json()) as UsageSummary;
      setData(summary);
      setError(null);
      if (summary.total_requests === 0) {
        setStatus("empty");
      } else {
        setStatus("populated");
      }
    } catch (err) {
      const apiErr =
        err instanceof ApiError
          ? err
          : new ApiError(0, "NETWORK_ERROR", "Tidak dapat terhubung ke server");
      setError(apiErr);
      setStatus("error");
    }
  }, [days]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { status, data, error, days, setDays, refresh };
}
