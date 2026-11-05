import { MetricCard } from "../components/ui/MetricCard";
import { DataState } from "../components/ui/DataState";
import { Currency } from "../components/ui/Currency";
import { DailyUsageChart } from "../components/usage/DailyUsageChart";
import { ModelBreakdownTable } from "../components/usage/ModelBreakdownTable";
import { HistoryTable } from "../components/usage/HistoryTable";
import { useUsageSummary } from "../hooks/useUsageSummary";
import { useUsageHistory } from "../hooks/useUsageHistory";
import { formatNumber } from "../lib/format";

export function UsagePage() {
  const summary = useUsageSummary(7);
  const history = useUsageHistory(20);

  return (
    <div className="space-y-6">
      {/* Header Context Strip */}
      <div className="flex flex-col gap-3 pb-2 border-b border-hairline sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-secondary">
            <span className="uppercase tracking-[0.06em]">Observabilitas</span>
            <span>/</span>
            <span className="font-medium text-primary uppercase">Riwayat Pemakaian</span>
          </div>
          <h1 className="font-serif text-[24px] font-medium tracking-[-0.015em] text-primary md:text-[28px]">
            Riwayat Pemakaian
          </h1>
          <p className="max-w-2xl text-[13px] text-secondary">
            Ringkasan konsumsi token, rincian biaya komputasi, dan riwayat transaksi inferensi model.
          </p>
        </div>

        {/* Days range selector */}
        <div className="flex items-center gap-1 rounded border border-hairline bg-surface p-0.5">
          <button
            type="button"
            onClick={() => summary.setDays(7)}
            className={`rounded px-2.5 py-1 font-mono text-xs font-medium transition-colors ${
              summary.days === 7
                ? "bg-primary text-surface"
                : "text-secondary hover:text-primary"
            }`}
          >
            7 Hari
          </button>
          <button
            type="button"
            onClick={() => summary.setDays(30)}
            className={`rounded px-2.5 py-1 font-mono text-xs font-medium transition-colors ${
              summary.days === 30
                ? "bg-primary text-surface"
                : "text-secondary hover:text-primary"
            }`}
          >
            30 Hari
          </button>
        </div>
      </div>

      {/* Section (a) 3 KPI Cards */}
      <DataState
        state={summary.status}
        skeletonRows={3}
        emptyLabel="Belum ada pemakaian"
        errorCode={summary.error?.errorCodeLabel}
        errorMessage={summary.error?.message}
        onRetry={summary.refresh}
      >
        {summary.data ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <MetricCard
                label="Total Token"
                value={formatNumber(summary.data.total_tokens)}
                unit="token"
                tone="primary"
                caption={`Konsumsi token dalam ${summary.days} hari kalender WIB`}
              />
              <MetricCard
                label="Total Biaya"
                value={<Currency amount={summary.data.total_cost_idr} tone="accent" large />}
                tone="accent"
                caption={`Akumulasi pengeluaran inferensi (${summary.days} hari)`}
              />
              <MetricCard
                label="Total Permintaan"
                value={formatNumber(summary.data.total_requests)}
                unit="req"
                tone="success"
                caption={`Panggilan API terselesaikan (${summary.days} hari)`}
              />
            </div>

            {/* Section (b) Daily Activity & Section (c) Model Breakdown */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="rounded-md border border-hairline bg-surface p-4 space-y-3 lg:col-span-7">
                <div className="border-b border-hairline pb-2">
                  <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-secondary">
                    Aktivitas Harian (WIB)
                  </h2>
                  <p className="mt-0.5 text-xs text-secondary">
                    Volume token inferensi per hari kalender WIB
                  </p>
                </div>
                <DailyUsageChart daily={summary.data.daily} />
              </div>

              <div className="rounded-md border border-hairline bg-surface p-4 space-y-3 lg:col-span-5">
                <div className="border-b border-hairline pb-2">
                  <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-secondary">
                    Distribusi Model
                  </h2>
                  <p className="mt-0.5 text-xs text-secondary">
                    Rincian pemakaian per model inferensi
                  </p>
                </div>
                {summary.data.by_model.length > 0 ? (
                  <ModelBreakdownTable rows={summary.data.by_model} />
                ) : (
                  <p className="py-6 text-center text-xs text-secondary">
                    Belum ada data model
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </DataState>

      {/* Section (d) History Table */}
      <div className="rounded-md border border-hairline bg-surface p-4 space-y-3">
        <div className="border-b border-hairline pb-2">
          <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-secondary">
            Log Riwayat Transaksi
          </h2>
          <p className="mt-0.5 text-xs text-secondary">
            Catatan setiap panggilan inferensi dengan rincian token, biaya, dan latensi
          </p>
        </div>

        <DataState
          state={history.status}
          skeletonRows={4}
          emptyLabel="Belum ada pemakaian"
          errorCode={history.error?.errorCodeLabel}
          errorMessage={history.error?.message}
          onRetry={history.refresh}
        >
          {history.items.length > 0 ? (
            <HistoryTable
              items={history.items}
              total={history.total}
              hasMore={history.hasMore}
              isLoadingMore={history.isLoadingMore}
              error={history.error}
              onLoadMore={() => void history.loadMore()}
            />
          ) : null}
        </DataState>
      </div>
    </div>
  );
}
