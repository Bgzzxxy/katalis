import { describe, expect, test, afterEach } from "bun:test";
import { setupDom } from "./setup";
setupDom();
import { render, screen, waitFor } from "@testing-library/react";
import { MonitorPage } from "../src/pages/MonitorPage";
import { MetricCard } from "../src/components/ui/MetricCard";
import { PoolStatusCard } from "../src/components/monitor/PoolStatusCard";
import { ThroughputChart } from "../src/components/monitor/ThroughputChart";
import type { Telemetry } from "../src/lib/types";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const mockTelemetry: Telemetry = {
  connection: { ok: true, latency_ms: 45 },
  total_tokens: 1_840_000,
  requests_per_second: 12,
  avg_latency_ms: 48,
  pools: [
    { tier: "LORA", recent_requests: 120, load_pct: 45 },
    { tier: "STABLE", recent_requests: 450, load_pct: 68 },
    { tier: "FLEX", recent_requests: 80, load_pct: 25 },
  ],
  window: Array.from({ length: 60 }, (_, i) => ({
    t: 1_700_000_000_000 + i * 1000,
    tokens: 1000 + i * 10,
    requests: 5 + (i % 3),
  })),
};

describe("MonitorPage & Components", () => {
  test("MetricCard renders label, tabular-nums value, and unit", () => {
    render(
      <MetricCard
        label="Total Token"
        value="1.840.000"
        unit="tok"
        caption="Kumulatif token terproses"
      />,
    );
    expect(screen.getByText("Total Token")).toBeTruthy();
    expect(screen.getByText("1.840.000")).toBeTruthy();
    expect(screen.getByText("tok")).toBeTruthy();
    expect(screen.getByText("Kumulatif token terproses")).toBeTruthy();
  });

  test("PoolStatusCard renders pool tier, label, and load percentage", () => {
    render(<PoolStatusCard pool={{ tier: "LORA", recent_requests: 120, load_pct: 45 }} />);
    expect(screen.getByText("LORA")).toBeTruthy();
    expect(screen.getByText("Dedicated LoRA")).toBeTruthy();
    expect(screen.getByText("120 req")).toBeTruthy();
    expect(screen.getByText("45%")).toBeTruthy();
  });

  test("ThroughputChart renders canvas inside h-64 wrapper", () => {
    const { container } = render(<ThroughputChart points={mockTelemetry.window} />);
    const canvas = container.querySelector("canvas");
    expect(canvas).toBeTruthy();
    const wrapper = canvas?.parentElement;
    expect(wrapper?.className).toContain("h-64");
  });

  test("MonitorPage renders telemetry real-time overview with 4 KPI cards and pools", async () => {
    globalThis.fetch = (async (url: string) => {
      if (String(url).includes("/api/telemetry")) {
        return new Response(JSON.stringify(mockTelemetry), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("", { status: 404 });
    }) as unknown as typeof fetch;

    render(<MonitorPage />);

    await waitFor(() => {
      expect(screen.getByText("Terhubung")).toBeTruthy();
    });

    expect(screen.getByText("Total Token")).toBeTruthy();
    expect(screen.getByText("1.840.000")).toBeTruthy();
    expect(screen.getByText("Request / Detik")).toBeTruthy();
    expect(screen.getByText("Latensi Rata-rata")).toBeTruthy();
    expect(screen.getAllByText("48ms").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Throughput 60 Detik Terakhir")).toBeTruthy();
    expect(screen.getByText("Kapasitas Pool")).toBeTruthy();
    expect(screen.getByText("Dedicated LoRA")).toBeTruthy();
    expect(screen.getByText("Stable")).toBeTruthy();
    expect(screen.getByText("Flex")).toBeTruthy();
  });
});
