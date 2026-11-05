// QA (independent): the model filter pipeline must be coherent across pool,
// capability and free-text search, and the page must not render a fabricated
// price column. Exercises the real ModelsPage wiring, not just the chips.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { setupDom } from "../setup";
setupDom();
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ModelsPage } from "../../src/pages/ModelsPage";
import { ToastProvider } from "../../src/hooks/useToast";
import { MODEL_CATALOG } from "../../src/lib/model-catalog";
import { resetModelsCache } from "../../src/hooks/useModels";
import { formatIdr } from "../../src/lib/format";

const originalFetch = globalThis.fetch;

const LIVE_FIXTURE = {
  object: "list",
  data: MODEL_CATALOG.map((m) => ({
    id: m.id,
    name: m.name,
    provider: m.provider,
    pool: m.pool,
    owned_by: "katalis",
    price_in_idr_per_1m: m.priceInIdrPer1M,
    price_out_idr_per_1m: m.priceOutIdrPer1M,
    capabilities: [...m.capabilities],
  })),
};

beforeEach(() => {
  resetModelsCache();
  globalThis.fetch = (async (url: string) => {
    if (String(url).includes("/api/models")) {
      return new Response(JSON.stringify(LIVE_FIXTURE), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: { message: "Not found", code: "NOT_FOUND" } }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;
});

afterEach(() => {
  resetModelsCache();
  globalThis.fetch = originalFetch;
});

async function renderModels() {
  const res = render(
    <ToastProvider>
      <ModelsPage />
    </ToastProvider>,
  );
  await waitFor(() => expect(modelIds(res.container).length).toBe(8));
  return res;
}

function modelIds(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("tbody button")).map(
    (b) => b.textContent ?? "",
  );
}
describe("QA ModelsPage filter integration", () => {
  test("shows the full catalog by default", async () => {
    const { container } = await renderModels();
    expect(modelIds(container).length).toBe(8);
  });

  test("pool filter narrows to Flex models only", async () => {
    const { container } = await renderModels();
    fireEvent.click(screen.getByRole("button", { name: "Flex" }));
    const ids = modelIds(container);
    expect(ids.sort()).toEqual(["doubao-pro", "glm-5.3-flash"]);
  });

  test("capability filter narrows to Vision models only", async () => {
    const { container } = await renderModels();
    fireEvent.click(screen.getByRole("button", { name: "Vision" }));
    expect(modelIds(container)).toEqual(["glm-4.6v"]);
  });

  test("search is case-insensitive and composes with the pool filter", async () => {
    const { container } = await renderModels();
    fireEvent.change(screen.getByLabelText("Cari model"), { target: { value: "GLM" } });
    expect(modelIds(container).sort()).toEqual(["glm-4.6v", "glm-5.3-flash"]);

    fireEvent.click(screen.getByRole("button", { name: "Flex" }));
    expect(modelIds(container)).toEqual(["glm-5.3-flash"]);
  });

  test("an unmatched search yields an empty table, not a crash", async () => {
    const { container } = await renderModels();
    fireEvent.change(screen.getByLabelText("Cari model"), { target: { value: "zzzz" } });
    expect(modelIds(container)).toEqual([]);
    expect(screen.getByText("Model (0)")).toBeTruthy();
  });

  test("the Unlimited toggle discounts ONLY the Dedicated LoRA row", async () => {
    await renderModels();
    // deepseek-v4-pro is STABLE: its list price stays undiscounted.
    const stable = MODEL_CATALOG.find((m) => m.id === "deepseek-v4-pro")!;
    const stableIn = formatIdr(stable.priceInIdrPer1M);
    expect(screen.getByText(stableIn)).toBeTruthy();

    fireEvent.click(screen.getByRole("checkbox"));

    // The backend bills -30% only for pool === "LORA" (hunyuan: 3 in / 12 out).
    const struck = Array.from(document.querySelectorAll("tbody s")).map((n) => n.textContent);
    expect(struck).toEqual(["Rp 3", "Rp 12"]);
    const loraRow = Array.from(document.querySelectorAll("tbody tr")).find((tr) =>
      tr.textContent?.includes("hunyuan-lora-coder"),
    )!;
    const loraCells = Array.from(loraRow.querySelectorAll("td")).map((td) => td.textContent ?? "");
    // Struck list price plus its own -30% twin (3 → 2, 12 → 8).
    expect(loraCells[3]).toContain(formatIdr(3 * 0.7));
    expect(loraCells[4]).toContain(formatIdr(12 * 0.7));
    // Stable rows are untouched: no strikethrough, no discounted twin.
    const stableRow = Array.from(document.querySelectorAll("tbody tr")).find((tr) =>
      tr.textContent?.includes("deepseek-v4-pro"),
    )!;
    expect(stableRow.querySelector("s")).toBeNull();
    expect(stableRow.textContent).toContain(stableIn);
  });
});
