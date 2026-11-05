// The Models dashboard must read the LIVE catalog (GET /api/models), never the
// static marketing mirror. Each test mocks the API with a DIFFERENT catalog than
// MODEL_CATALOG so a static fallback would be observable.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { setupDom } from "./setup";
setupDom();
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ModelsPage } from "../src/pages/ModelsPage";
import { ToastProvider } from "../src/hooks/useToast";
import { resetModelsCache } from "../src/hooks/useModels";

const originalFetch = globalThis.fetch;

beforeEach(() => {
  resetModelsCache();
});

afterEach(() => {
  resetModelsCache();
  globalThis.fetch = originalFetch;
});

type ApiModel = {
  id: string;
  name: string;
  provider: string;
  pool: "LORA" | "STABLE" | "FLEX";
  owned_by: string;
  price_in_idr_per_1m: number;
  price_out_idr_per_1m: number;
  capabilities: string[];
};

function row(
  id: string,
  pool: ApiModel["pool"],
  capabilities: string[] = [],
): ApiModel {
  return {
    id,
    name: `Nama ${id}`,
    provider: "Vendor Uji",
    pool,
    owned_by: "katalis",
    price_in_idr_per_1m: 5,
    price_out_idr_per_1m: 10,
    capabilities,
  };
}

/** Serves GET /api/models with `payload` and records every requested URL. */
function mockModels(payload: unknown, status = 200): string[] {
  const calls: string[] = [];
  globalThis.fetch = (async (url: string) => {
    calls.push(String(url));
    return new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return calls;
}

function renderModels() {
  return render(
    <ToastProvider>
      <ModelsPage />
    </ToastProvider>,
  );
}

function tableModelIds(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("tbody button")).map((b) =>
    (b.textContent ?? "").trim(),
  );
}

const THREE: ApiModel[] = [
  row("live-alpha", "STABLE", ["Reasoning", "Tools"]),
  row("live-beta", "FLEX", ["Tools"]),
  row("live-gamma", "FLEX", ["Vision"]),
];

describe("ModelsPage reads the live catalog", () => {
  test("renders exactly the 3 models served by /api/models (no static fallback)", async () => {
    const calls = mockModels({ object: "list", data: THREE });
    const { container } = renderModels();

    await waitFor(() => expect(tableModelIds(container).length).toBe(3));
    expect(tableModelIds(container)).toEqual(["live-alpha", "live-beta", "live-gamma"]);
    // The static mirror must not leak a single row in.
    expect(container.textContent).not.toContain("deepseek-v4-pro");
    expect(screen.getByText("Model (3)")).toBeTruthy();
    expect(calls.some((u) => u.includes("/api/models"))).toBe(true);
  });

  test("live prices and capabilities are rendered, not mirrored ones", async () => {
    mockModels({ object: "list", data: THREE });
    const { container } = renderModels();

    await waitFor(() => expect(tableModelIds(container).length).toBe(3));
    const rows = Array.from(container.querySelectorAll("tbody tr"));
    expect(rows.length).toBe(3);
    for (const r of rows) {
      const cells = Array.from(r.querySelectorAll("td")).map((c) => c.textContent ?? "");
      expect(cells[3]).toBe("Rp 5");
      expect(cells[4]).toBe("Rp 10");
    }
    expect(rows[0].textContent).toContain("Nama live-alpha");
    expect(rows[0].textContent).toContain("Vendor Uji");
    expect(rows[0].textContent).toContain("Reasoning · Tools");
  });

  test("pool filter narrows the live list", async () => {
    mockModels({ object: "list", data: THREE });
    const { container } = renderModels();
    await waitFor(() => expect(tableModelIds(container).length).toBe(3));

    fireEvent.click(screen.getByRole("button", { name: "Flex" }));
    expect(tableModelIds(container)).toEqual(["live-beta", "live-gamma"]);
    expect(screen.getByText("Model (2)")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Stable" }));
    expect(tableModelIds(container)).toEqual(["live-alpha"]);

    fireEvent.click(screen.getByRole("button", { name: "Dedicated LoRA" }));
    expect(tableModelIds(container)).toEqual([]);
    expect(screen.getByText("Tidak ada model cocok dengan filter")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Semua" }));
    expect(tableModelIds(container).length).toBe(3);
  });

  test("the calculator select is built from the live catalog", async () => {
    mockModels({ object: "list", data: THREE });
    renderModels();

    const select = (await screen.findByLabelText(
      "Model yang dihitung",
    )) as HTMLSelectElement;
    await waitFor(() => expect(select.querySelectorAll("option").length).toBe(3));
    expect(Array.from(select.querySelectorAll("option")).map((o) => o.value)).toEqual([
      "live-alpha",
      "live-beta",
      "live-gamma",
    ]);
  });

  test("a failing API renders the error state with a working retry", async () => {
    let attempt = 0;
    globalThis.fetch = (async () => {
      attempt += 1;
      if (attempt === 1) {
        return new Response(
          JSON.stringify({ error: { message: "Katalog mati", type: "api_error", param: null, code: "CATALOG_DOWN" } }),
          { status: 503, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ object: "list", data: THREE }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const { container } = renderModels();

    await waitFor(() => expect(screen.getByTestId("data-error")).toBeTruthy());
    expect(screen.getByText("Katalog mati")).toBeTruthy();
    expect(screen.getByText("HTTP 503 · CATALOG_DOWN")).toBeTruthy();
    // Never silently fall back to the static copy.
    expect(tableModelIds(container)).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: "Coba Lagi" }));
    await waitFor(() => expect(tableModelIds(container).length).toBe(3));
    expect(screen.queryByTestId("data-error")).toBeNull();
  });

  test("an unreachable network renders the error state", async () => {
    globalThis.fetch = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;

    renderModels();
    await waitFor(() => expect(screen.getByTestId("data-error")).toBeTruthy());
    expect(screen.getByText("NETWORK_ERROR")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Coba Lagi" })).toBeTruthy();
  });

  test("an empty catalog renders the empty state", async () => {
    mockModels({ object: "list", data: [] });
    const { container } = renderModels();

    await waitFor(() => expect(screen.getByText("Belum ada model terdaftar")).toBeTruthy());
    expect(tableModelIds(container)).toEqual([]);
  });

  test("the module cache serves a remount without a second fetch", async () => {
    mockModels({ object: "list", data: THREE });
    const { unmount } = renderModels();
    await waitFor(() => expect(screen.getByText("Model (3)")).toBeTruthy());
    unmount();

    const calls = mockModels({ object: "list", data: THREE });
    const { container } = renderModels();
    await waitFor(() => expect(tableModelIds(container).length).toBe(3));
    expect(calls).toEqual([]);
  });
});
