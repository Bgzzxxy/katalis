import { useCallback, useEffect, useState } from "react";
import { ApiError, type DataStatus, type OPENAI_ERROR_SHAPE } from "../lib/types";
import type { UsageHistory, UsageHistoryItem } from "../components/usage/types";

export type UsageHistoryState = {
  status: DataStatus;
  items: UsageHistoryItem[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  error: ApiError | null;
  keyId: string | undefined;
  setKeyId: (keyId: string | undefined) => void;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
};

export function useUsageHistory(defaultLimit = 20): UsageHistoryState {
  const [limit] = useState(defaultLimit);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<UsageHistoryItem[]>([]);
  const [keyId, setKeyId] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<DataStatus>("loading");
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const refresh = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const keyParam = keyId ? `&key_id=${encodeURIComponent(keyId)}` : "";
      const res = await fetch(`/api/billing/usage/history?limit=${limit}&offset=0${keyParam}`, {
        credentials: "include",
      });

      if (!res.ok) {
        let body: OPENAI_ERROR_SHAPE | null = null;
        try {
          body = (await res.json()) as OPENAI_ERROR_SHAPE;
        } catch {
          // ignore non-json error body
        }
        const message = body?.error?.message ?? "Gagal memuat riwayat transaksi";
        const code = body?.error?.code ?? `HTTP_${res.status}`;
        throw new ApiError(res.status, code, message, body?.error?.type ?? "api_error");
      }

      const history = (await res.json()) as UsageHistory;
      setItems(history.items);
      setTotal(history.total);
      setOffset(0);
      setError(null);
      if (history.total === 0 || history.items.length === 0) {
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
  }, [limit, keyId]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || items.length >= total) return;
    setIsLoadingMore(true);
    try {
      const nextOffset = offset + limit;
      const keyParam = keyId ? `&key_id=${encodeURIComponent(keyId)}` : "";
      const res = await fetch(
        `/api/billing/usage/history?limit=${limit}&offset=${nextOffset}${keyParam}`,
        { credentials: "include" },
      );

      if (!res.ok) {
        let body: OPENAI_ERROR_SHAPE | null = null;
        try {
          body = (await res.json()) as OPENAI_ERROR_SHAPE;
        } catch {
          // ignore
        }
        const message = body?.error?.message ?? "Gagal memuat halaman lanjutan";
        const code = body?.error?.code ?? `HTTP_${res.status}`;
        throw new ApiError(res.status, code, message, body?.error?.type ?? "api_error");
      }

      const history = (await res.json()) as UsageHistory;
      setItems((prev) => {
        const existingIds = new Set(prev.map((i) => i.id));
        const newItems = history.items.filter((i) => !existingIds.has(i.id));
        return [...prev, ...newItems];
      });
      setOffset(nextOffset);
      setTotal(history.total);
    } catch (err) {
      const apiErr =
        err instanceof ApiError
          ? err
          : new ApiError(0, "NETWORK_ERROR", "Gagal memuat log tambahan");
      setError(apiErr);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, items.length, total, offset, limit, keyId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const hasMore = items.length < total;

  return {
    status,
    items,
    total,
    limit,
    offset,
    hasMore,
    isLoadingMore,
    error,
    keyId,
    setKeyId,
    loadMore,
    refresh,
  };
}
