import { useEffect, useMemo, useState } from "react";
import { useInRouterContext, useSearchParams } from "react-router-dom";
import { Panel } from "../components/ui/Panel";
import { DataState } from "../components/ui/DataState";
import { ModelFilters, type ModelFilterValue } from "../components/models/ModelFilters";
import { ModelsTable } from "../components/models/ModelsTable";
import { MODEL_CATALOG } from "../lib/model-catalog";
import { estimateCostIdr, UNLIMITED_LORA_DISCOUNT } from "../lib/pricing";
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
  const [inputTokens, setInputTokens] = useState(500_000);
  const [outputTokens, setOutputTokens] = useState(250_000);

  useEffect(() => {
    setFilters((prev) => (prev.query === query ? prev : { ...prev, query }));
  }, [query]);

  const filtered = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    return MODEL_CATALOG.filter((model) => {
      if (filters.pool !== "ALL" && model.pool !== filters.pool) return false;
      if (filters.capability && !model.capabilities.includes(filters.capability)) return false;
      if (q && !model.id.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [filters]);

  const estimate = useMemo(
    () =>
      filtered.length === 0
        ? null
        : estimateCostIdr(filtered[0], inputTokens, outputTokens, unlimitedDiscount),
    [filtered, inputTokens, outputTokens, unlimitedDiscount],
  );

  function resetFilters() {
    setFilters({ pool: "ALL", capability: null, query: "" });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-base font-semibold text-primary" style={{ letterSpacing: "-0.01em" }}>
        Katalog Model
      </h1>

      <Panel title="Filter">
        <ModelFilters value={filters} onChange={setFilters} />
      </Panel>

      <Panel title={`Model (${filtered.length})`}>
        {filtered.length === 0 ? (
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
          <label className="flex items-center gap-2 font-mono text-[11px] text-secondary">
            <input
              type="checkbox"
              checked={unlimitedDiscount}
              onChange={(e) => setUnlimitedDiscount(e.target.checked)}
            />
            Simulasi Unlimited −30%
          </label>
        }
      >
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
              {unlimitedDiscount ? `−${Math.round(UNLIMITED_LORA_DISCOUNT * 100)}%` : "—"}
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
