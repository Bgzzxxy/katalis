// QA (independent, adversarial): cross-component coherence checks the happy-path
// developer tests do not cover. Each case asserts observable UI behaviour; a
// failure here is a reproducible finding, not a test bug.
import { afterEach, describe, expect, test } from "bun:test";
import { setupDom } from "../setup";
setupDom();
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { DashboardLayout } from "../../src/components/layout/DashboardLayout";
import { MonitorPage } from "../../src/pages/MonitorPage";
import { ModelsPage } from "../../src/pages/ModelsPage";
import { ToastProvider } from "../../src/hooks/useToast";
import { AuthProvider } from "../../src/hooks/useAuth";
import { CommandPalette } from "../../src/components/command/CommandPalette";
import { QrisModal } from "../../src/components/billing/QrisModal";
import { resetModelsCache } from "../../src/hooks/useModels";
import type { InvoiceStatusView, InvoiceView, Telemetry } from "../../src/lib/types";
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function telemetryWith(ok: boolean): Telemetry {
  const window60 = Array.from({ length: 60 }, (_, i) => ({ t: 1_700_000_000_000 + i * 1000, tokens: 0, requests: 0 }));
  return {
    connection: { ok, latency_ms: 42 },
    total_tokens: 0,
    requests_per_second: 0,
    avg_latency_ms: 0,
    pools: [
      { tier: "LORA", recent_requests: 0, load_pct: 0 },
      { tier: "STABLE", recent_requests: 0, load_pct: 0 },
      { tier: "FLEX", recent_requests: 0, load_pct: 0 },
    ],
    window: window60,
  };
}

describe("QA FINDING: navbar connection dot contradicts Monitor status", () => {
  test("gateway reports ok:false -> navbar must NOT claim 'Terhubung'", async () => {
    globalThis.fetch = (async (url: string) => {
      if (String(url).includes("/api/telemetry")) {
        return new Response(JSON.stringify(telemetryWith(false)), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("", { status: 401 });
    }) as unknown as typeof fetch;

    render(
      <ToastProvider>
        <AuthProvider>
          <MemoryRouter>
            <DashboardLayout>
              <MonitorPage />
            </DashboardLayout>
          </MemoryRouter>
        </AuthProvider>
      </ToastProvider>,
    );

    await waitFor(() => expect(screen.getByText("Terputus")).toBeTruthy());
    // The monitor correctly shows "Terputus"; the navbar must agree.
    expect(screen.queryByText(/Terhubung ·/)).toBeNull();
  });
});

describe("QA FINDING: command palette model search drops its query param", () => {
  test("navigating to /models?q=<id> must apply that query filter", async () => {
    resetModelsCache();
    globalThis.fetch = (async (url: string) => {
      if (String(url).includes("/api/models")) {
        return new Response(
          JSON.stringify({
            object: "list",
            data: [
              {
                id: "glm-4.6v",
                name: "GLM 4.6V",
                provider: "Zhipu",
                pool: "STABLE",
                owned_by: "katalis",
                price_in_idr_per_1m: 4,
                price_out_idr_per_1m: 16,
                capabilities: ["Vision"],
              },
              {
                id: "deepseek-v4-pro",
                name: "DeepSeek V4 Pro",
                provider: "DeepSeek",
                pool: "STABLE",
                owned_by: "katalis",
                price_in_idr_per_1m: 27,
                price_out_idr_per_1m: 110,
                capabilities: ["Reasoning"],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("", { status: 404 });
    }) as unknown as typeof fetch;

    function Probe() {
      const loc = useLocation();
      return <div data-testid="loc">{loc.pathname + loc.search}</div>;
    }

    const { container } = render(
      <ToastProvider>
        <MemoryRouter initialEntries={["/models?q=glm-4.6v"]}>
          <Routes>
            <Route
              path="/models"
              element={
                <>
                  <ModelsPage />
                  <Probe />
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      </ToastProvider>,
    );

    expect(screen.getByTestId("loc").textContent).toBe("/models?q=glm-4.6v");
    // The page receives the query but must filter the table down to it.
    await waitFor(() => {
      const ids = Array.from(container.querySelectorAll("tbody button")).map((b) => b.textContent);
      expect(ids).toEqual(["glm-4.6v"]);
    });
  });

  test("palette model action navigates to /models?q=<id> (documents the URL it emits)", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route
            path="/"
            element={
              <>
                <CommandPalette onClose={() => {}} />
                <RouteProbe />
              </>
            }
          />
          <Route path="/models" element={<RouteProbe />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: /glm-4\.6v/ }));
    await waitFor(() =>
      expect(screen.getByTestId("route").textContent).toContain("/models?q=glm-4.6v"),
    );
  });
});

function RouteProbe() {
  const loc = useLocation();
  return <div data-testid="route">{loc.pathname + loc.search}</div>;
}

describe("QA FINDING: expired QRIS invoice keeps polling as 'Menunggu Pembayaran'", () => {
  const invoice: InvoiceView = {
    id: "INV-1",
    plan_type: "UNLIMITED_10D",
    total_pay_idr: 20000,
    qris_string: "00020101021226670016COM.GOOGLE",
    status: "PENDING",
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  };
  const expired: InvoiceStatusView = {
    id: "INV-1",
    plan_type: "UNLIMITED_10D",
    status: "EXPIRED",
    total_pay_idr: 20000,
    paid_at: null,
  };

  test("an EXPIRED invoice should stop waiting and stop polling", async () => {
    let calls = 0;
    render(
      <QrisModal invoice={invoice} fetchStatus={async () => (calls++, expired)} pollMs={10} onClose={() => {}} />,
    );

    // Let the poller flip the status to EXPIRED.
    await waitFor(() => expect(calls).toBeGreaterThan(0), { timeout: 1000 });
    await new Promise((r) => setTimeout(r, 60));
    const callsAtExpiry = calls;
    await new Promise((r) => setTimeout(r, 60));

    // Finding: the modal neither surfaces EXPIRED nor stops polling.
    expect(screen.queryByText("Menunggu Pembayaran...")).toBeNull();
    expect(calls).toBe(callsAtExpiry);
  });
});
