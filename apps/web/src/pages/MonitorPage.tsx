import { Activity, RefreshCw } from "lucide-react";
import { Panel } from "../components/ui/Panel";
import { MetricCard } from "../components/ui/MetricCard";
import { DataState } from "../components/ui/DataState";
import { ThroughputChart } from "../components/monitor/ThroughputChart";
import { PoolStatusCard } from "../components/monitor/PoolStatusCard";
import { useTelemetry } from "../hooks/useTelemetry";
import { formatLatency, formatNumber } from "../lib/format";
import type { Telemetry } from "../lib/types";

export function MonitorPage() {
  const { status, data, error, refresh } = useTelemetry();
  const connectionOk = Boolean(data?.connection.ok);

  return (
    <div className="space-y-6">
      {/* Context Header (Overview v4.0 U1) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-accent">
              Region: ap-southeast-3 (Jakarta)
            </span>
            <span className="text-secondary text-xs">•</span>
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-secondary">
              <span
                className={`h-1.5 w-1.5 rounded-full ${connectionOk ? "animate-pulse" : ""}`}
                style={{
                  background: connectionOk ? "var(--state-success)" : "var(--state-error)",
                }}
              />
              {connectionOk ? "Gateway Aktif" : "Gateway Terputus"}
            </span>
          </div>
          <h1 className="font-serif text-[22px] leading-7 font-medium tracking-tight text-primary">
            Real-time Gateway Telemetry
          </h1>
          <p className="font-sans text-xs text-secondary">
            Low-latency unified inference endpoint for frontier foundation models.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded border border-hairline bg-surface px-2.5 py-1.5 font-mono text-[11px] text-secondary hover:border-accent hover:text-primary transition-colors"
          title="Segarkan data telemetri"
        >
          <RefreshCw className="h-3 w-3" />
          <span>Refresh</span>
        </button>
      </div>

      <DataState
        state={status}
        skeletonRows={5}
        errorCode={error?.errorCodeLabel}
        errorMessage={error?.message}
        onRetry={() => void refresh()}
      >
        {data ? <MonitorContent telemetry={data} /> : null}
      </DataState>
    </div>
  );
}

function MonitorContent({ telemetry }: { telemetry: Telemetry }) {
  const connectionOk = telemetry.connection.ok;
  // "Zero-charge" is a guarantee of the routing path, not a health signal: it
  // holds only while every pool the gateway serves has a route. Derived from the
  // pool payload so a missing tier is visible instead of implied.
  const allPoolsReported = new Set(telemetry.pools.map((p) => p.tier)).size === 3;
  const failoverActive = connectionOk && allPoolsReported;

  return (
    <div className="space-y-6">
      {/* 4-Column KPI Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Token"
          value={formatNumber(telemetry.total_tokens)}
          unit="tok"
          tone="primary"
          badge={
            <span className="font-mono text-[11px] text-secondary">
              Throughput
            </span>
          }
          caption="Kumulatif token terproses"
        />
        <MetricCard
          label="Request / Detik"
          value={formatNumber(telemetry.requests_per_second)}
          unit="req/s"
          tone="accent"
          badge={
            <span className="font-mono text-[11px] font-semibold text-accent">
              RPS
            </span>
          }
          caption="Frekuensi beban saat ini"
        />
        <MetricCard
          label="Latensi Rata-rata"
          value={formatLatency(telemetry.avg_latency_ms)}
          tone={connectionOk ? "success" : "error"}
          badge={
            <span className="font-mono text-[11px] text-secondary">
              RTT
            </span>
          }
          caption="Round-trip gateway Jakarta"
        />
        <MetricCard
          label="Status Gateway"
          value={connectionOk ? "Terhubung" : "Terputus"}
          tone={connectionOk ? "success" : "error"}
          badge={
            <span
              className={`h-2 w-2 rounded-full ${connectionOk ? "animate-pulse" : ""}`}
              style={{
                background: connectionOk ? "var(--state-success)" : "var(--state-error)",
              }}
            />
          }
          caption={connectionOk ? "SSE stream tersinkronisasi" : "Koneksi gateway terganggu"}
        />
      </div>

      {/* Main Bento Grid: 8-col Throughput Chart & 4-col Pool Status */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <Panel
            overline="Analisis Telemetri"
            title="Throughput 60 Detik Terakhir"
            subtitle="Konsumsi token dan request real-time dalam jendela 60 detik"
            action={
              <div className="flex items-center gap-3 font-mono text-[11px] text-secondary">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: "var(--state-success)" }}
                  />
                  Token/detik
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: "var(--accent-main)" }}
                  />
                  Request/detik
                </span>
              </div>
            }
          >
            <ThroughputChart points={telemetry.window} />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded border border-hairline bg-canvas px-3 py-2 font-mono text-[11px] text-secondary">
              <span className="inline-flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-success" />
                Sampel jendela:{" "}
                <strong className="font-semibold tabular-nums text-primary">
                  {telemetry.window.length} detik
                </strong>
              </span>
              <span>
                Latensi rata-rata:{" "}
                <strong className="font-semibold tabular-nums text-primary">
                  {formatLatency(telemetry.avg_latency_ms)}
                </strong>
              </span>
            </div>
          </Panel>
        </div>

        <div className="lg:col-span-4">
          <Panel
            overline="Upstream Routing"
            title="Kapasitas Pool"
            subtitle="Beban operasional dan alokasi tier model"
          >
            <div className="space-y-3">
              {telemetry.pools.map((pool) => (
                <PoolStatusCard key={pool.tier} pool={pool} />
              ))}
            </div>

            <div className="mt-3.5 flex items-center justify-between rounded border border-hairline bg-canvas p-2.5 font-mono text-[11px] text-secondary">
              <span>Failover Routing:</span>
              <span
                data-testid="failover-state"
                className={`inline-flex items-center gap-1.5 font-semibold ${
                  failoverActive ? "text-success" : "text-error"
                }`}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{
                    background: failoverActive
                      ? "var(--state-success)"
                      : "var(--state-error)",
                  }}
                />
                {failoverActive ? "Zero-charge active" : "Degraded"}
              </span>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}