// Contract test for the Keys console summary row: three cards, the third being
// TODAY'S real consumption from GET /api/billing/usage (backend: usage_logs).
import { afterEach, describe, expect, test } from "bun:test";
import { setupDom } from "./setup";
setupDom();
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { KeysDashboardPage } from "../src/pages/KeysDashboardPage";
import { AuthProvider } from "../src/hooks/useAuth";
import { ToastProvider } from "../src/hooks/useToast";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

type Route = { status: number; body: unknown };

function mockApi(routes: Record<string, Route>) {
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push(url);
    const match = Object.keys(routes).find((key) => url.includes(key));
    const route = match ? routes[match] : { status: 404, body: { error: {} } };
    return new Response(JSON.stringify(route.body), {
      status: route.status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return calls;
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <AuthProvider>
          <KeysDashboardPage />
        </AuthProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe("KeysDashboardPage summary row", () => {
  test("renders wallet, package status and today's real usage", async () => {
    mockApi({
      "/api/auth/session": {
        status: 200,
        body: {
          id: "u1",
          email: "member@example.com",
          wallet_balance_idr: 150_000,
          unlimited_expires_at: null,
        },
      },
      "/api/keys": { status: 200, body: [] },
      "/api/billing/usage": {
        status: 200,
        body: { date: "2026-11-06", tokens_used: 12_345, amount_spent_idr: 4_250 },
      },
    });

    renderPage();

    expect(screen.getByText("Sisa Saldo")).toBeTruthy();
    expect(screen.getByText("Status Paket")).toBeTruthy();
    expect(screen.getByText("Pemakaian Hari Ini")).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByTestId("daily-usage-amount").textContent).toContain("4.250");
    });
    expect(screen.getByText(/12\.345 token/)).toBeTruthy();
    expect(screen.getByText(/2026-11-06 WIB/)).toBeTruthy();
  });

  test("shows the error state with a retry when usage cannot be loaded", async () => {
    mockApi({
      "/api/auth/session": {
        status: 200,
        body: {
          id: "u1",
          email: "member@example.com",
          wallet_balance_idr: 0,
          unlimited_expires_at: null,
        },
      },
      "/api/keys": { status: 200, body: [] },
      "/api/billing/usage": {
        status: 500,
        body: { error: { message: "boom", type: "api_error", param: null, code: "INTERNAL" } },
      },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Muat ulang")).toBeTruthy();
    });
    expect(screen.queryByTestId("daily-usage-amount")).toBeNull();
  });
});
