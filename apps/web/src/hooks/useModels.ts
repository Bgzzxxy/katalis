import { useCallback, useEffect, useState } from "react";
import { fetchModels } from "../lib/api";
import { asPoolTier, asCapability, type ModelSpec } from "../lib/model-catalog";
import { ApiError, type DataStatus } from "../lib/types";

export type ModelsState = {
  status: DataStatus;
  models: ModelSpec[];
  error: ApiError | null;
  refresh: () => Promise<void>;
};

/**
 * Catalog cache for the page lifetime (module scope, no polling): the catalog is
 * static per deploy, so remounting the page must not refetch. `null` = never
 * loaded; a failed load keeps `null` so the next mount retries.
 */
let catalogCache: ModelSpec[] | null = null;

/** Test-only: drop the module cache so each test starts from a cold fetch. */
export function resetModelsCache(): void {
  catalogCache = null;
}

/** Maps the API row to the UI `ModelSpec` (IDR/1M on both sides). Rows whose
 *  pool is not a known tier are dropped rather than guessed. */
export function toModelSpec(row: {
  id: string;
  name: string;
  provider: string;
  pool: string;
  price_in_idr_per_1m: number;
  price_out_idr_per_1m: number;
  capabilities: string[];
}): ModelSpec | null {
  const pool = asPoolTier(row.pool);
  if (!pool) return null;
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    pool,
    priceInIdrPer1M: row.price_in_idr_per_1m,
    priceOutIdrPer1M: row.price_out_idr_per_1m,
    capabilities: row.capabilities.flatMap((cap) => {
      const known = asCapability(cap);
      return known ? [known] : [];
    }),
  };
}

/** Live model catalog from GET /api/models (4-status, no static fallback). */
export function useModels(): ModelsState {
  const [status, setStatus] = useState<DataStatus>(catalogCache ? "populated" : "loading");
  const [models, setModels] = useState<ModelSpec[]>(catalogCache ?? []);
  const [error, setError] = useState<ApiError | null>(null);

  const refresh = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const res = await fetchModels();
      const rows = Array.isArray(res?.data) ? res.data : [];
      const next = rows.map(toModelSpec).filter((m): m is ModelSpec => m !== null);
      catalogCache = next;
      setModels(next);
      setStatus(next.length === 0 ? "empty" : "populated");
    } catch (err) {
      catalogCache = null;
      setModels([]);
      setError(
        err instanceof ApiError
          ? err
          : new ApiError(0, "NETWORK_ERROR", "Gagal memuat katalog model"),
      );
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    // A warm module cache is fresh for the page lifetime: no refetch, no polling.
    if (catalogCache !== null) {
      setModels(catalogCache);
      setStatus(catalogCache.length === 0 ? "empty" : "populated");
      return;
    }
    void refresh();
  }, [refresh]);

  return { status, models, error, refresh };
}
