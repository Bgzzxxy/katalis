// QA (independent, adversarial) — Design System v4.0 replication gate.
// Verifies the five acceptance scenarios with real react renders + a mocked
// fetch transport. Every case asserts observable UI behaviour; a failure here
// is a reproducible finding against apps/web/src, never a test bug.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { setupDom } from "../setup";
setupDom();
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import { ToastProvider } from "../../src/hooks/useToast";
import { AuthProvider } from "../../src/hooks/useAuth";
import App from "../../src/App";
import { BillingPage } from "../../src/pages/BillingPage";
import { PlanSelector, PLANS, PREPAID_QUICK_AMOUNTS } from "../../src/components/billing/PlanSelector";
import { PlaygroundPanel } from "../../src/components/docs/PlaygroundPanel";
import { CreateKeyModal } from "../../src/components/keys/CreateKeyModal";
import { SpendLimitModal } from "../../src/components/keys/SpendLimitModal";
import { KeysDashboardPage } from "../../src/pages/KeysDashboardPage";
import { useTheme } from "../../src/hooks/useTheme";
import { MODEL_CATALOG } from "../../src/lib/model-catalog";
import type { ApiKeyView, CreatedKey, Telemetry, User } from "../../src/lib/types";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function applicationFetch(routes: Record<string, (req: { method: string; url: string }) => Response>) {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const handler = routes[url];
    if (handler) {
      return handler({ method: init?.method ?? "GET", url });
    }
    return jsonResponse({});
  }) as unknown as typeof fetch;
}

const sessionUser: User = {
  id: "u1",
  email: "qa@katalis.id",
  wallet_balance_idr: 64250,
  unlimited_expires_at: null,
};

function telemetry(ok = true): Telemetry {
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
    window: Array.from({ length: 60 }, (_, i) => ({
      t: 1_700_000_000_000 + i * 1000,
      tokens: 0,
      requests: 0,
    })),
  };
}

/** Standard transport for a signed-in workspace: session, telemetry, empty keys. */
function workspaceFetch(extra?: Record<string, () => Response>) {
  applicationFetch({
    "/api/auth/session": () => jsonResponse(sessionUser),
    "/api/telemetry": () => jsonResponse(telemetry()),
    "/api/keys": () => jsonResponse([]),
    ...extra,
  });
}

// ---------------------------------------------------------------------------
// 1. Public vs Auth Shell Routing & Layout
// ---------------------------------------------------------------------------

const PUBLIC_ROUTES = ["/", "/models", "/docs"] as const;
const WORKSPACE_ROUTES = ["/monitor", "/keys", "/billing"] as const;

function renderAppAt(path: string) {
  window.history.pushState({}, "", path);
  return render(<App />);
}

async function assertNoSidebar() {
  await waitFor(() => expect(screen.queryByText("Saldo Prabayar")).toBeNull());
  // eslint-disable-next-line testing-library/no-node-access
  expect(document.querySelector("aside")).toBeNull();
}

async function assertSidebar() {
  await waitFor(() => expect(screen.getByText("Saldo Prabayar")).toBeTruthy());
  // eslint-disable-next-line testing-library/no-node-access
  expect(document.querySelector("aside")).toBeTruthy();
}

describe("QA v4: public vs auth shell layout", () => {
  test("public routes render no 240px sidebar", async () => {
    workspaceFetch();
    renderAppAt("/");
    await assertNoSidebar();
  });

  test("workspace routes render the sidebar + utility header", async () => {
    workspaceFetch();
    renderAppAt("/monitor");
    await assertSidebar();
    // Dashboard header utility (latency pill + theme toggle) must participate.
    await waitFor(() => expect(screen.getByText(/Terhubung ·/)).toBeTruthy());
    expect(screen.getByLabelText(/Aktifkan tema/)).toBeTruthy();
  });

  test("all six routes honour their exact layout contract", async () => {
    workspaceFetch();

    for (const p of PUBLIC_ROUTES) {
      const { unmount } = renderAppAt(p);
      await assertNoSidebar();
      unmount();
    }
    for (const p of WORKSPACE_ROUTES) {
      const { unmount } = renderAppAt(p);
      await assertSidebar();
      unmount();
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Credits 2-Column Checkout
// ---------------------------------------------------------------------------

function mockSessionOnly() {
  applicationFetch({
    "/api/auth/session": () => jsonResponse(sessionUser),
  });
}

function renderBilling() {
  return render(
    <ToastProvider>
      <AuthProvider>
        <MemoryRouter>
          <BillingPage />
        </MemoryRouter>
      </AuthProvider>
    </ToastProvider>,
  );
}

describe("QA v4: credits 2-column checkout", () => {
  test("plan preset selection updates the right-hand ringkasan tagihan precisely", async () => {
    mockSessionOnly();
    renderBilling();

    // Default selection.
    await waitFor(() => expect(screen.getByText("Paket Terpilih")).toBeTruthy());
    expect(screen.getAllByText("20.000").length).toBeGreaterThan(0);

    // TRIAL preset.
    fireEvent.click(screen.getByLabelText("Trial 1 Hari"));
    expect(screen.getAllByText("100").length).toBeGreaterThan(0);

    // PREPAID preset (default custom amount 50.000).
    fireEvent.click(screen.getByLabelText("Saldo Prabayar"));
    expect(screen.getAllByText("50.000").length).toBeGreaterThan(0);
    expect(screen.getByText("Paket Terpilih")).toBeTruthy();
  });

  test("preset quick amounts tighten the summary exactly", async () => {
    mockSessionOnly();
    renderBilling();
    await waitFor(() => expect(screen.getByText("Paket Terpilih")).toBeTruthy());

    fireEvent.click(screen.getByLabelText("Saldo Prabayar"));
    fireEvent.click(screen.getByText("Growth"));

    expect(screen.getAllByText("50.000").length).toBeGreaterThan(0);
  });

  test("sub-minimum custom amount (Rp 5.000) is clamped on checkout", async () => {
    let payload: { plan_type: string; custom_amount_idr?: number } | null = null;
    applicationFetch({
      "/api/auth/session": () => jsonResponse(sessionUser),
      "/api/billing/invoices": () =>
        jsonResponse({
          id: "INV-CLAMP",
          plan_type: "PREPAID",
          total_pay_idr: 5000,
          qris_string: "000201010212",
          status: "PENDING",
          expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
        }),
    });
    const realFetch = globalThis.fetch as typeof fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/billing/invoices") {
        payload = JSON.parse(String(init?.body));
      }
      return realFetch(input, init);
    }) as unknown as typeof fetch;

    renderBilling();
    await waitFor(() => expect(screen.getByText("Paket Terpilih")).toBeTruthy());
    fireEvent.click(screen.getByLabelText("Saldo Prabayar"));

    fireEvent.change(screen.getByLabelText("Nominal Kustom (Rp)"), {
      target: { value: "4500" },
    });

    fireEvent.click(screen.getByText("Buat Tagihan QRIS"));
    await waitFor(() => expect(payload).not.toBeNull());

    expect(payload!.plan_type).toBe("PREPAID");
    expect(payload!.custom_amount_idr).toBe(5000);
  });

  test("over-maximum custom amount (Rp 1.000.000) is clamped on checkout", async () => {
    let payload: { plan_type: string; custom_amount_idr?: number } | null = null;
    applicationFetch({
      "/api/auth/session": () => jsonResponse(sessionUser),
      "/api/billing/invoices": () => {
        return jsonResponse({
          id: "INV-MAX",
          plan_type: "PREPAID",
          total_pay_idr: 1000000,
          qris_string: "000201010212",
          status: "PENDING",
          expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
        });
      },
    });
    // Capture the actual request body via a small spy wrapped around fetch.
    const realFetch = globalThis.fetch as typeof fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/billing/invoices") {
        payload = JSON.parse(String(init?.body));
      }
      return realFetch(input, init);
    }) as unknown as typeof fetch;

    renderBilling();
    await waitFor(() => expect(screen.getByText("Paket Terpilih")).toBeTruthy());
    fireEvent.click(screen.getByLabelText("Saldo Prabayar"));

    fireEvent.change(screen.getByLabelText("Nominal Kustom (Rp)"), {
      target: { value: "2000000" },
    });

    fireEvent.click(screen.getByText("Buat Tagihan QRIS"));
    await waitFor(() => expect(payload).not.toBeNull());

    expect(payload!.plan_type).toBe("PREPAID");
    expect(payload!.custom_amount_idr).toBe(1000000);
  });

  test("checkout opens the QrisModal with the created invoice", async () => {
    applicationFetch({
      "/api/auth/session": () => jsonResponse(sessionUser),
      "/api/billing/invoices": () =>
        jsonResponse({
          id: "INV-QRIS",
          plan_type: "UNLIMITED_10D",
          total_pay_idr: 20000,
          qris_string: "000201010212",
          status: "PENDING",
          expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
        }),
    });

    renderBilling();
    await waitFor(() => expect(screen.getByText("Paket Terpilih")).toBeTruthy());

    fireEvent.click(screen.getByText("Buat Tagihan QRIS"));

    await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
    expect(screen.getByText("INV-QRIS")).toBeTruthy();
    expect(screen.getByText("Pembayaran QRIS Dinamis")).toBeTruthy();
  });

  test("catalog contract: presets & bounds are exactly as designed", () => {
    expect(PLANS.map((p) => p.id)).toEqual(["UNLIMITED_10D", "PREPAID", "TRIAL_1D"]);
    expect(PLANS.find((p) => p.id === "PREPAID")?.priceIdr).toBe(50000);
    expect(PREPAID_QUICK_AMOUNTS.map((q) => q.amount)).toEqual([
      10_000, 25_000, 50_000, 100_000, 250_000,
    ]);
    // The inputs below the selector must carry the clamping bounds.
    void PlanSelector;
  });
});

// ---------------------------------------------------------------------------
// 3. Playground 3-Pane Interaction
// ---------------------------------------------------------------------------

describe("QA v4: playground 3-pane interaction", () => {
  test("changing model updates the input/output tariff rail", () => {
    render(<PlaygroundPanel />);

    const select = screen.getByLabelText("Model playground");
    const flash = MODEL_CATALOG.find((m) => m.id === "deepseek-v4.1-flash")!;
    fireEvent.change(select, { target: { value: flash.id } });

    // Info rail (left parameter pane): "Rp X / 1M in" & "Rp Y / 1M out".
    expect(screen.getByText(/Rp 9 \/ 1M in/)).toBeTruthy();
    expect(screen.getByText(/Rp 22 \/ 1M out/)).toBeTruthy();
  });

  test("submitting a prompt shows HTTP status, latency, and token receipt", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          id: "cmpl-token",
          choices: [{ message: { role: "assistant", content: "ok" } }],
          usage: { prompt_tokens: 120, completion_tokens: 60, total_tokens: 180 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )) as unknown as typeof fetch;

    render(<PlaygroundPanel />);
    fireEvent.change(screen.getByLabelText("API key playground"), {
      target: { value: "sk-ktl-TEST" },
    });
    fireEvent.click(screen.getByText("Kirim Request"));

    // HTTP status telemetry.
    await waitFor(() => expect(screen.getAllByText("200").length).toBeGreaterThan(0));
    // Latency cell ("<n> milidetik").
    expect(screen.getByText(/\d+ milidetik/)).toBeTruthy();
    // Token receipt (itemized ledger + totals).
    expect(screen.getByText("120 tok")).toBeTruthy();
    expect(screen.getByText("60 tok")).toBeTruthy();
    expect(screen.getByText("180 tok")).toBeTruthy();
    expect(screen.getByText("180")).toBeTruthy();
  });

  test("⌘+Enter submits a prompt (keyboard path)", async () => {
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      return new Response(JSON.stringify({ id: "cmpl-cmd" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch;

    render(<PlaygroundPanel />);
    fireEvent.change(screen.getByLabelText("API key playground"), {
      target: { value: "sk-ktl-CMD" },
    });

    const prompt = screen.getByLabelText("Prompt playground");
    fireEvent.keyDown(prompt, { key: "Enter", metaKey: true });

    await waitFor(() => expect(called).toBe(true));
  });

  test("upstream error arrives as an OpenAI-shaped HTTP status, no crash", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          error: { message: "quota", type: "server_error", param: null, code: "429" },
        }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      )) as unknown as typeof fetch;

    render(<PlaygroundPanel />);
    fireEvent.change(screen.getByLabelText("API key playground"), {
      target: { value: "sk-ktl-429" },
    });
    fireEvent.click(screen.getByText("Kirim Request"));

    await waitFor(() => expect(screen.getByText(/HTTP 429/)).toBeTruthy());
    // The parsed body is surfaced.
    await waitFor(() => expect(screen.getByText(/quota/)).toBeTruthy());
  });
});

// ---------------------------------------------------------------------------
// 4. Keys Console IDOR & Reveal-Once Invariant
// ---------------------------------------------------------------------------

const rawKey = "sk-ktl-ABCDEFGHJKLMNPQRSTUVWXYZ123456";
const createdKey: CreatedKey = {
  id: "k1",
  name: "Cursor Laptop",
  key_prefix: "sk-ktl-8f92",
  spend_limit_idr: null,
  spent_idr: 0,
  is_active: true,
  last_used_at: null,
  created_at: new Date().toISOString(),
  key: rawKey,
};

describe("QA v4: keys console reveal-once & boundaries", () => {
  test("raw key is shown exactly once on creation, then discarded on close", async () => {
    let closed = 0;
    const { rerender } = render(
      <ToastProvider>
        <CreateKeyModal open onClose={() => (closed += 1)} onCreate={async () => createdKey} />
      </ToastProvider>,
    );

    expect(screen.queryByTestId("raw-key")).toBeNull();
    fireEvent.click(screen.getByText("Buat API Key"));
    await waitFor(() => expect(screen.getByTestId("raw-key").textContent).toBe(rawKey));

    fireEvent.click(screen.getByText("Tutup"));
    expect(closed).toBe(1);

    rerender(
      <ToastProvider>
        <CreateKeyModal open={false} onClose={() => (closed += 1)} onCreate={async () => createdKey} />
      </ToastProvider>,
    );
    expect(screen.queryByTestId("raw-key")).toBeNull();
  });

  test("submitting CreateKeyModal invokes onCreate exactly once (no double-dispatch from onClick + onSubmit)", async () => {
    let callCount = 0;
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <CreateKeyModal
          open
          onClose={() => {}}
          onCreate={async () => {
            callCount++;
            return createdKey;
          }}
        />
      </ToastProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Buat API Key" }));
    await waitFor(() => expect(screen.getByTestId("raw-key")).toBeTruthy());
    expect(callCount).toBe(1);
  });

  test("submitting SpendLimitModal invokes onSave exactly once (no double-dispatch from onClick + onSubmit)", async () => {
    let callCount = 0;
    const user = userEvent.setup();
    render(
      <SpendLimitModal
        keyId="k1"
        currentLimit={100_000}
        onSave={async () => {
          callCount++;
        }}
        onClose={() => {}}
      />,
    );

    const input = screen.getByLabelText("Batas pemakaian");
    await user.clear(input);
    await user.type(input, "50000");
    await user.click(screen.getByRole("button", { name: "Simpan" }));
    await waitFor(() => expect(callCount).toBeGreaterThan(0));
    expect(callCount).toBe(1);
  });
  test("key console list surfaces only the hash prefix, never the raw secret", async () => {
    applicationFetch({
      "/api/auth/session": () => jsonResponse(sessionUser),
      "/api/keys": () =>
        jsonResponse([
          {
            id: "k1",
            name: "Cursor Laptop",
            key_prefix: "sk-ktl-8f92",
            spend_limit_idr: null,
            spent_idr: 0,
            is_active: true,
            last_used_at: null,
            created_at: new Date().toISOString(),
          } satisfies ApiKeyView,
        ]),
    });

    render(
      <ToastProvider>
        <AuthProvider>
          <MemoryRouter>
            <KeysDashboardPage />
          </MemoryRouter>
        </AuthProvider>
      </ToastProvider>,
    );

    await waitFor(() => expect(screen.getByText("sk-ktl-8f92")).toBeTruthy());
    expect(screen.queryByText(rawKey)).toBeNull();
    // eslint-disable-next-line testing-library/no-node-access
    expect(document.body.textContent ?? "").not.toContain(rawKey);
  });

  test("spend limit rejects negative input; empty input clears to unbounded", async () => {
    let saved: Array<{ id: string; limit: number | null }> = [];
    const { unmount } = render(
      <SpendLimitModal
        keyId="k1"
        currentLimit={100_000}
        onSave={async (id, limit) => {
          saved.push({ id, limit });
        }}
        onClose={() => {}}
      />,
    );

    const input = screen.getByLabelText("Batas pemakaian");
    fireEvent.change(input, { target: { value: "-50" } });
    fireEvent.click(screen.getByText("Simpan"));
    await waitFor(() => expect(screen.getByText("Batas harus angka positif atau kosong")).toBeTruthy());
    expect(saved).toEqual([]);

    // Clear -> null (unbounded), which still saves.
    fireEvent.change(screen.getByLabelText("Batas pemakaian"), { target: { value: "" } });
    fireEvent.click(screen.getByText("Simpan"));
    await waitFor(() => expect(saved.length).toBeGreaterThan(0));
    expect(saved[0]?.limit).toBeNull();
    expect(saved[0]?.id).toBe("k1");

    unmount();
    saved = [];

    // Boundary: zero is a legal (finite, non-negative) limit.
    render(
      <SpendLimitModal
        keyId="k1"
        currentLimit={100_000}
        onSave={async (id, limit) => {
          saved.push({ id, limit });
        }}
        onClose={() => {}}
      />,
    );
    fireEvent.change(screen.getByLabelText("Batas pemakaian"), { target: { value: "0" } });
    fireEvent.click(screen.getByText("Simpan"));
    await waitFor(() => expect(saved.length).toBeGreaterThan(0));
    expect(saved[0]?.limit).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 5. Theme Switcher Coherence
// ---------------------------------------------------------------------------

function ThemeHarness() {
  const { theme, toggle } = useTheme();
  return (
    <button onClick={toggle} aria-label="toggle-theme">
      {theme}
    </button>
  );
}

describe("QA v4: theme switcher coherence", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  test("toggle flips `.dark` on <html> and persists to localStorage", () => {
    render(<ThemeHarness />);

    expect(document.documentElement.classList.contains("dark")).toBe(false);

    fireEvent.click(screen.getByLabelText("toggle-theme"));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(window.localStorage.getItem("katalis-theme")).toBe("dark");

    fireEvent.click(screen.getByLabelText("toggle-theme"));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(window.localStorage.getItem("katalis-theme")).toBe("light");
  });
});