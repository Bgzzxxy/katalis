import { describe, expect, test } from "bun:test";
import { setupDom } from "./setup";
setupDom();
import { fireEvent, render, screen } from "@testing-library/react";
import { ModelFilters, type ModelFilterValue } from "../src/components/models/ModelFilters";

function noop() {}

describe("ModelFilters", () => {
  test("marks the active pool chip and emits pool changes", () => {
    const emitted: ModelFilterValue[] = [];
    render(
      <ModelFilters
        value={{ pool: "ALL", capability: null, query: "" }}
        onChange={(v) => emitted.push(v)}
      />,
    );
    fireEvent.click(screen.getByText("Dedicated LoRA"));
    expect(emitted).toEqual([{ pool: "LORA", capability: null, query: "" }]);
  });

  test("emits query changes from the search input", () => {
    const emitted: ModelFilterValue[] = [];
    render(
      <ModelFilters
        value={{ pool: "ALL", capability: null, query: "" }}
        onChange={(v) => emitted.push(v)}
      />,
    );
    fireEvent.change(screen.getByLabelText("Cari model"), {
      target: { value: "deepseek" },
    });
    expect(emitted).toEqual([{ pool: "ALL", capability: null, query: "deepseek" }]);
  });

  test("toggles capability off when active", () => {
    const emitted: ModelFilterValue[] = [];
    render(
      <ModelFilters
        value={{ pool: "ALL", capability: "Vision", query: "" }}
        onChange={(v) => emitted.push(v)}
      />,
    );
    fireEvent.click(screen.getByText("Vision"));
    expect(emitted).toEqual([{ pool: "ALL", capability: null, query: "" }]);
  });

  test("no decorative elements beyond functional controls", () => {
    const { container } = render(
      <ModelFilters value={{ pool: "ALL", capability: null, query: "" }} onChange={noop} />,
    );
    expect(container.querySelectorAll("svg").length).toBe(0);
  });
});