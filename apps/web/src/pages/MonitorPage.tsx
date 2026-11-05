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

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-[22px] leading-7 font-medium tracking-[-0.015em] text-primary">
        Real-time Gateway Telemetry
      </h1>

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

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          label="Total Token"
          value={formatNumber(telemetry.total_tokens)}
          unit="tok"
          tone="primary"
        />
        <MetricCard
          label="Request / Detik"
          value={formatNumber(telemetry.requests_per_second)}
          unit="req/s"
          tone="accent"
        />
        <MetricCard
          label="Latensi Rata-rata"
          value={formatLatency(telemetry.avg_latency_ms)}
          tone={connectionOk ? "success" : "error"}
        />
        <MetricCard
          label="Status Gateway"
          value={connectionOk ? "Terhubung" : "Terputus"}
          tone={connectionOk ? "success" : "error"}
        />
      </div>

      <Panel title="Throughput 60 Detik Terakhir">
        <ThroughputChart points={telemetry.window} />
      </Panel>

      <Panel title="Kapasitas Pool">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {telemetry.pools.map((pool) => (
            <PoolStatusCard key={pool.tier} pool={pool} />
          ))}
        </div>
      </Panel>
    </div>
  );
}