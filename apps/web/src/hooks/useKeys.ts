import { useCallback, useEffect, useState } from "react";
import { ApiError, type ApiKeyView, type CreatedKey, type DataStatus } from "../lib/types";
import { createKey, fetchKeys, revokeKey, setKeyActive, setSpendLimit } from "../lib/api";

export type KeysState = {
  status: DataStatus;
  keys: ApiKeyView[];
  error: ApiError | null;
  refresh: () => Promise<void>;
  create: (name?: string) => Promise<CreatedKey>;
  setLimit: (keyId: string, limitIdr: number | null) => Promise<void>;
  toggleActive: (keyId: string, active: boolean) => Promise<void>;
  revoke: (keyId: string) => Promise<void>;
};

export function useKeys(): KeysState {
  const [status, setStatus] = useState<DataStatus>("loading");
  const [keys, setKeys] = useState<ApiKeyView[]>([]);
  const [error, setError] = useState<ApiError | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await fetchKeys();
      setKeys(list);
      setError(null);
      setStatus(list.length === 0 ? "empty" : "populated");
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, "NETWORK_ERROR", "Gagal memuat API key"));
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (name?: string) => {
      const created = await createKey(name);
      await refresh();
      return created;
    },
    [refresh],
  );

  const setLimit = useCallback(
    async (keyId: string, limitIdr: number | null) => {
      await setSpendLimit(keyId, limitIdr);
      await refresh();
    },
    [refresh],
  );

  const toggleActive = useCallback(
    async (keyId: string, active: boolean) => {
      await setKeyActive(keyId, active);
      await refresh();
    },
    [refresh],
  );

  const revoke = useCallback(
    async (keyId: string) => {
      await revokeKey(keyId);
      await refresh();
    },
    [refresh],
  );

  return { status, keys, error, refresh, create, setLimit, toggleActive, revoke };
}