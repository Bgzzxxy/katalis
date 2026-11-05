import { useEffect, useMemo, useState } from "react";
import { useInRouterContext, useSearchParams } from "react-router-dom";
import { Panel } from "../components/ui/Panel";
import { DataState } from "../components/ui/DataState";
import { ModelFilters, type ModelFilterValue } from "../components/models/ModelFilters";
import { ModelsTable } from "../components/models/ModelsTable";
import { useModels } from "../hooks/useModels";
import { POOL_LABELS } from "../lib/model-catalog";
import {
  estimateCostIdr,
  UNLIMITED_LORA_DISCOUNT,
  unlimitedDiscountApplies,
} from "../lib/pricing";

import { formatIdr } from "../lib/format";

/** Command-palette deep links arrive as /models?q=<id>; read the param only when
 *  a Router is present (the page is also mounted bare in unit tests). */
export function ModelsPage() {
  return useInRouterContext() ? <RoutedModelsPage /> : <ModelsPageBody query="" />;
}

function RoutedModelsPage() {
  const [searchParams] = useSearchParams();
  return <ModelsPageBody query={searchParams.get("q") ?? ""} />;
}

function ModelsPageBody({ query }: { query: string }) {
  const [filters, setFilters] = useState<ModelFilterValue>({
    pool: "ALL",
    capability: null,
    query,
  });
  const [unlimitedDiscount, setUnlimitedDiscount] = useState(false);
  const [manualModelId, setManualModelId] = useState<string | null>(null);
  const [inputTokens, setInputTokens] = useState(500_000);
  const [outputTokens, setOutputTokens] = useState(250_000);

  const { status, models, error, refresh } = useModels();

  useEffect(() => {
    setFilters((prev) => (prev.query === query ? prev : { ...prev, query }));
  }, [query]);

  const filtered = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    return models.filter((model) => {
      if (filters.pool !== "ALL" && model.pool !== filters.pool) return false;
      if (filters.capability && !model.capabilities.includes(filters.capability)) return false;
      if (q && !model.id.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [filters, models]);

  const selectedModelId =
    models.some((model) => model.id === manualModelId) ? manualModelId : (models[0]?.id ?? null);
  const selectedModel =
    models.find((model) => model.id === selectedModelId) ?? models[0] ?? null;

  const estimate = useMemo(
    () =>
      selectedModel === null
        ? null
        : estimateCostIdr(selectedModel, inputTokens, outputTokens, unlimitedDiscount),
    [selectedModel, inputTokens, outputTokens, unlimitedDiscount],
  );

  function resetFilters() {
    setFilters({ pool: "ALL", capability: null, query: "" });
  }

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-[22px] leading-7 font-medium tracking-[-0.015em] text-primary">
        Katalog Model
      </h1>

      <Panel title="Filter">
        <ModelFilters value={filters} onChange={setFilters} />
      </Panel>

      <Panel title={`Model (${status === "populated" ? filtered.length : 0})`}>
        {status === "loading" ? (
          <DataState state="loading" skeletonRows={4} />
        ) : status === "error" ? (
          <DataState
            state="error"
            errorCode={error?.errorCodeLabel ?? "CATALOG_ERROR"}
            errorMessage={error?.message ?? "Gagal memuat katalog model"}
            onRetry={() => void refresh()}
          />
        ) : status === "empty" ? (
          <DataState
            state="empty"
            emptyLabel="Belum ada model terdaftar"
            emptyAction={{ label: "Muat Ulang", onClick: () => void refresh() }}
          />
        ) : filtered.length === 0 ? (
          <DataState
            state="empty"
            emptyLabel="Tidak ada model cocok dengan filter"
            emptyAction={{ label: "Reset filter", onClick: resetFilters }}
          />
        ) : (
          <ModelsTable models={filtered} unlimitedDiscount={unlimitedDiscount} />
        )}
      </Panel>

      <Panel
        title="Kalkulator Biaya"
        action={
          <label className="flex items-center gap-2 font-sans text-xs text-secondary">
            <input
              type="checkbox"
              checked={unlimitedDiscount}
              onChange={(e) => setUnlimitedDiscount(e.target.checked)}
            />
            Aktivasi Unlimited (diskon −30% khusus pool Dedicated LoRA)
          </label>
        }
      >
        <label className="mb-3 flex max-w-md flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-secondary">
          Model Yang Dihitung
          <select
            aria-label="Model yang dihitung"
            className="rounded border border-hairline bg-surface px-2 py-1.5 font-mono text-[13px] text-primary outline-none focus:border-accent"
            value={selectedModelId ?? ""}
            onChange={(e) => setManualModelId(e.target.value || null)}
            disabled={models.length === 0}
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} · {POOL_LABELS[m.pool]}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-secondary">
            Token Input
            <input
              type="number"
              min={0}
              className="rounded border border-hairline bg-surface px-2 py-1.5 font-mono text-[13px] tabular-nums text-primary outline-none focus:border-accent"
              value={inputTokens}
              onChange={(e) => setInputTokens(Math.max(0, Number(e.target.value) || 0))}
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-secondary">
            Token Output
            <input
              type="number"
              min={0}
              className="rounded border border-hairline bg-surface px-2 py-1.5 font-mono text-[13px] tabular-nums text-primary outline-none focus:border-accent"
              value={outputTokens}
              onChange={(e) => setOutputTokens(Math.max(0, Number(e.target.value) || 0))}
            />
          </label>
          <div className="flex flex-col justify-end">
            <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-secondary">
              Estimasi Biaya
            </p>
            <p className="font-mono text-xl font-semibold tabular-nums text-accent">
              {estimate === null ? "—" : formatIdr(estimate)}
            </p>
          </div>
          <div className="flex flex-col justify-end">
            <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-secondary">
              Diskon
            </p>
            <p className="font-mono text-[13px] tabular-nums text-success">
              {selectedModel && unlimitedDiscountApplies(selectedModel, unlimitedDiscount)
                ? `−${Math.round(UNLIMITED_LORA_DISCOUNT * 100)}%`
                : "—"}
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
}