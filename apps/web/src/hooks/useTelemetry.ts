import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, type DataStatus, type Telemetry } from "../lib/types";

const POLL_MS = 4000;

export type TelemetryState = {
  status: DataStatus;
  data: Telemetry | null;
  error: ApiError | null;
  refresh: () => Promise<void>;
};

/** Polls GET /api/telemetry every 4s (backend cache TTL 2s). */
export function useTelemetry(): TelemetryState {
  const [status, setStatus] = useState<DataStatus>("loading");
  const [data, setData] = useState<Telemetry | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/telemetry", { credentials: "include" });
      if (!res.ok) throw new ApiError(res.status, "HTTP_" + res.status, "Gagal memuat telemetri");
      const next = (await res.json()) as Telemetry;
      setData(next);
      setError(null);
      setStatus("populated");
    } catch (err) {
      const apiErr =
        err instanceof ApiError
          ? err
          : new ApiError(0, "NETWORK_ERROR", "Tidak dapat terhubung ke server");
      setError(apiErr);
      setStatus(prev => (prev === "populated" ? prev : "error"));
    }
  }, []);

  useEffect(() => {
    void refresh();
    timerRef.current = setInterval(() => void refresh(), POLL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [refresh]);

  return { status, data, error, refresh };
}