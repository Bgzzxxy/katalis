// QA (independent): the model filter pipeline must be coherent across pool,
// capability and free-text search, and the page must not render a fabricated
// price column. Exercises the real ModelsPage wiring, not just the chips.
import { describe, expect, test } from "bun:test";
import { setupDom } from "../setup";
setupDom();
import { fireEvent, render, screen } from "@testing-library/react";
import { ModelsPage } from "../../src/pages/ModelsPage";
import { ToastProvider } from "../../src/hooks/useToast";

function renderModels() {
  return render(
    <ToastProvider>
      <ModelsPage />
    </ToastProvider>,
  );
}

function modelIds(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("tbody button")).map(
    (b) => b.textContent ?? "",
  );
}

describe("QA ModelsPage filter integration", () => {
  test("shows the full catalog by default", () => {
    const { container } = renderModels();
    expect(modelIds(container).length).toBe(8);
  });

  test("pool filter narrows to Flex models only", () => {
    const { container } = renderModels();
    fireEvent.click(screen.getByRole("button", { name: "Flex" }));
    const ids = modelIds(container);
    expect(ids.sort()).toEqual(["doubao-pro", "glm-5.3-flash"]);
  });

  test("capability filter narrows to Vision models only", () => {
    const { container } = renderModels();
    fireEvent.click(screen.getByRole("button", { name: "Vision" }));
    expect(modelIds(container)).toEqual(["glm-4.6v"]);
  });

  test("search is case-insensitive and composes with the pool filter", () => {
    const { container } = renderModels();
    fireEvent.change(screen.getByLabelText("Cari model"), { target: { value: "GLM" } });
    expect(modelIds(container).sort()).toEqual(["glm-4.6v", "glm-5.3-flash"]);

    fireEvent.click(screen.getByRole("button", { name: "Flex" }));
    expect(modelIds(container)).toEqual(["glm-5.3-flash"]);
  });

  test("an unmatched search yields an empty table, not a crash", () => {
    const { container } = renderModels();
    fireEvent.change(screen.getByLabelText("Cari model"), { target: { value: "zzzz" } });
    expect(modelIds(container)).toEqual([]);
    expect(screen.getByText("Model (0)")).toBeTruthy();
  });

  test("the Unlimited toggle discounts ONLY the Dedicated LoRA row", () => {
    renderModels();
    // deepseek-v4-pro is STABLE: 27 in / 110 out per 1M stays undiscounted.
    expect(screen.getByText("Rp 27")).toBeTruthy();

    fireEvent.click(screen.getByRole("checkbox"));

    // The backend bills -30% only for pool === "LORA" (hunyuan: 3 in / 12 out).
    const struck = Array.from(document.querySelectorAll("tbody s")).map((n) => n.textContent);
    expect(struck).toEqual(["Rp 3", "Rp 12"]);
    expect(screen.getAllByText("Rp 8").length).toBe(1);
    // Stable rows are untouched: no strikethrough, no discounted twin.
    expect(screen.queryByText("Rp 19")).toBeNull();
    expect(screen.getByText("Rp 27").closest("s")).toBeNull();
  });
});
