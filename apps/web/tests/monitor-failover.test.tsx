// The monitor's "Failover Routing" badge must reflect the data it receives:
// zero-charge is claimed only while the gateway is reachable AND every routing
// pool is reporting. A stubbed hardcoded "active" would hide a dead pool.
import { afterEach, describe, expect, test } from "bun:test";
import { setupDom } from "./setup";
setupDom();
import { render, screen, waitFor } from "@testing-library/react";
import { MonitorPage } from "../src/pages/MonitorPage";
import type { Telemetry } from "../src/lib/types";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const window60 = Array.from({ length: 60 }, (_, i) => ({
  t: 1_700_000_000_000 + i * 1000,
  tokens: 100,
  requests: 1,
}));

function mockTelemetry(body: Telemetry) {
  globalThis.fetch = (async (_input: RequestInfo | URL) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;
}

const full: Telemetry = {
  connection: { ok: true, latency_ms: 30 },
  total_tokens: 1000,
  requests_per_second: 2,
  avg_latency_ms: 40,
  pools: [
    { tier: "LORA", recent_requests: 1, load_pct: 10 },
    { tier: "STABLE", recent_requests: 8, load_pct: 80 },
    { tier: "FLEX", recent_requests: 1, load_pct: 10 },
  ],
  window: window60,
};

describe("MonitorPage failover badge", () => {
  test("says Zero-charge active when connected and all pools report", async () => {
    mockTelemetry(full);
    render(<MonitorPage />);
    await waitFor(() => {
      expect(screen.getByTestId("failover-state").textContent).toBe("Zero-charge active");
    });
  });

  test("says Degraded when a pool is missing from the payload", async () => {
    mockTelemetry({ ...full, pools: full.pools.slice(0, 2) });
    render(<MonitorPage />);
    await waitFor(() => {
      expect(screen.getByTestId("failover-state").textContent).toBe("Degraded");
    });
  });

  test("says Degraded when the gateway reports itself down", async () => {
    mockTelemetry({ ...full, connection: { ok: false, latency_ms: 1200 } });
    render(<MonitorPage />);
    await waitFor(() => {
      expect(screen.getByTestId("failover-state").textContent).toBe("Degraded");
    });
  });
});
