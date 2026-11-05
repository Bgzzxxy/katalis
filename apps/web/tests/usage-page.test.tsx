import "./setup";
import { setupDom } from "./setup";
setupDom();
import { afterEach, describe, expect, test } from "bun:test";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { UsagePage } from "../src/pages/UsagePage";
import { ToastProvider } from "../src/hooks/useToast";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

type MockRoute = {
  status: number;
  body: unknown;
};

function mockFetch(handler: (url: string) => MockRoute | Promise<MockRoute>) {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const route = await handler(url);
    return new Response(JSON.stringify(route.body), {
      status: route.status,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
}

const sampleSummary = {
  range_days: 7,
  total_tokens: 15420,
  total_cost_idr: 45.5,
  total_requests: 12,
  daily: [
    { date: "2026-10-31", tokens: 1000, cost_idr: 3.0, requests: 2 },
    { date: "2026-11-01", tokens: 2000, cost_idr: 6.0, requests: 1 },
    { date: "2026-11-02", tokens: 0, cost_idr: 0, requests: 0 },
    { date: "2026-11-03", tokens: 4000, cost_idr: 12.0, requests: 3 },
    { date: "2026-11-04", tokens: 1500, cost_idr: 4.5, requests: 1 },
    { date: "2026-11-05", tokens: 3000, cost_idr: 9.0, requests: 2 },
    { date: "2026-11-06", tokens: 3920, cost_idr: 11.0, requests: 3 },
  ],
  by_model: [
    { model_id: "deepseek-v3", requests: 8, tokens: 11000, cost_idr: 32.5 },
    { model_id: "qwen-72b", requests: 4, tokens: 4420, cost_idr: 13.0 },
  ],
};

const sampleHistoryPage1 = {
  total: 3,
  limit: 2,
  offset: 0,
  items: [
    {
      id: 101,
      created_at: "2026-11-06T10:00:00.000Z",
      model_id: "deepseek-v3",
      pool_tier: "STABLE",
      upstream_provider: "siliconflow",
      prompt_tokens: 500,
      completionTokens: 200,
      cost_idr: 2.5,
      latency_ms: 150,
      http_status: 200,
      api_key_id: "00000000-0000-0000-0000-000000000001",
      api_key_name: "prod-server",
    },
    {
      id: 102,
      created_at: "2026-11-06T09:30:00.000Z",
      model_id: "qwen-72b",
      pool_tier: "STABLE",
      upstream_provider: "siliconflow",
      prompt_tokens: 300,
      completionTokens: 100,
      cost_idr: 1.2,
      latency_ms: 180,
      http_status: 200,
      api_key_id: "00000000-0000-0000-0000-000000000002",
      api_key_name: "dev-key",
    },
  ],
};

const sampleHistoryPage2 = {
  total: 3,
  limit: 2,
  offset: 2,
  items: [
    {
      id: 103,
      created_at: "2026-11-06T08:00:00.000Z",
      model_id: "deepseek-v3",
      pool_tier: "STABLE",
      upstream_provider: "siliconflow",
      prompt_tokens: 150,
      completionTokens: 50,
      cost_idr: 0.6,
      latency_ms: 140,
      http_status: 200,
      api_key_id: "00000000-0000-0000-0000-000000000001",
      api_key_name: "prod-server",
    },
  ],
};

function renderPage() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <UsagePage />
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe("UsagePage", () => {
  test("renders loading skeleton state initially", async () => {
    mockFetch(() => new Promise(() => {}));
    renderPage();
    const skeletons = screen.getAllByTestId("data-skeleton");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  test("renders empty state when member has no usage logs", async () => {
    mockFetch((url) => {
      if (url.includes("/summary")) {
        return {
          status: 200,
          body: {
            range_days: 7,
            total_tokens: 0,
            total_cost_idr: 0,
            total_requests: 0,
            daily: [
              { date: "2026-10-31", tokens: 0, cost_idr: 0, requests: 0 },
              { date: "2026-11-01", tokens: 0, cost_idr: 0, requests: 0 },
              { date: "2026-11-02", tokens: 0, cost_idr: 0, requests: 0 },
              { date: "2026-11-03", tokens: 0, cost_idr: 0, requests: 0 },
              { date: "2026-11-04", tokens: 0, cost_idr: 0, requests: 0 },
              { date: "2026-11-05", tokens: 0, cost_idr: 0, requests: 0 },
              { date: "2026-11-06", tokens: 0, cost_idr: 0, requests: 0 },
            ],
            by_model: [],
          },
        };
      }
      return {
        status: 200,
        body: { total: 0, limit: 20, offset: 0, items: [] },
      };
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText("Belum ada pemakaian").length).toBeGreaterThan(0);
    });
  });

  test("renders error state with retry and errorCodeLabel when API fails", async () => {
    mockFetch(() => ({
      status: 500,
      body: {
        error: {
          code: "INTERNAL_ERROR",
          message: "Database connection failed",
          type: "api_error",
        },
      },
    }));

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByTestId("data-error").length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText(/HTTP 500 · INTERNAL_ERROR/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Coba Lagi").length).toBeGreaterThan(0);
  });

  test("renders populated state with KPI cards, daily chart, model breakdown, and history", async () => {
    mockFetch((url) => {
      if (url.includes("/summary")) {
        return { status: 200, body: sampleSummary };
      }
      return { status: 200, body: sampleHistoryPage1 };
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Total Token")).toBeTruthy();
    });

    expect(screen.getByText("Total Biaya")).toBeTruthy();
    expect(screen.getByText("Total Permintaan")).toBeTruthy();

    expect(screen.getByText("15.420")).toBeTruthy();
    expect(screen.getAllByText("deepseek-v3").length).toBeGreaterThan(0);
    expect(screen.getAllByText("qwen-72b").length).toBeGreaterThan(0);

    expect(screen.getByText("prod-server")).toBeTruthy();
    expect(screen.getByText("dev-key")).toBeTruthy();
  });

  test("pagination appends items without duplicating existing records", async () => {
    mockFetch((url) => {
      if (url.includes("/summary")) {
        return { status: 200, body: sampleSummary };
      }
      if (url.includes("offset=2")) {
        return { status: 200, body: sampleHistoryPage2 };
      }
      return { status: 200, body: sampleHistoryPage1 };
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("prod-server")).toBeTruthy();
    });

    const loadMoreButton = screen.getByRole("button", { name: /Muat lebih banyak/i });
    expect(loadMoreButton).toBeTruthy();

    fireEvent.click(loadMoreButton);

    await waitFor(() => {
      const rows = screen.getAllByTestId("history-item-row");
      expect(rows.length).toBe(3);
    });

    const uniqueIds = screen.getAllByTestId("history-item-row").map((el) => el.getAttribute("data-id"));
    expect(uniqueIds).toEqual(["101", "102", "103"]);
  });
});
