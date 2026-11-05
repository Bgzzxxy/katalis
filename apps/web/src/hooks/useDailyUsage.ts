import { useCallback, useEffect, useState } from "react";
import { ApiError, type DailyUsage, type DataStatus } from "../lib/types";
import { fetchDailyUsage } from "../lib/api";

export type DailyUsageState = {
  status: DataStatus;
  data: DailyUsage | null;
  error: ApiError | null;
  refresh: () => Promise<void>;
};

/** Today's aggregate consumption for the signed-in member (4-status). */
export function useDailyUsage(): DailyUsageState {
  const [status, setStatus] = useState<DataStatus>("loading");
  const [data, setData] = useState<DailyUsage | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchDailyUsage();
      setData(next);
      setError(null);
      setStatus("populated");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err
          : new ApiError(0, "NETWORK_ERROR", "Gagal memuat ringkasan pemakaian"),
      );
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { status, data, error, refresh };
}