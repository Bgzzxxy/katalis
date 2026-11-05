import { describe, expect, test } from "bun:test";
import { setupDom } from "./setup";
setupDom();
import { render, screen, fireEvent } from "@testing-library/react";
import { DataState } from "../src/components/ui/DataState";

describe("DataState: 4 mandatory data states", () => {
  test("loading renders skeleton rows and hides children", () => {
    render(
      <DataState state="loading" skeletonRows={4}>
        <div>real-data</div>
      </DataState>,
    );
    expect(screen.getByTestId("data-skeleton")).toBeTruthy();
    expect(screen.getByTestId("data-skeleton").children.length).toBe(4);
    expect(screen.queryByText("real-data")).toBeNull();
  });

  test("empty shows label and one direct action", () => {
    let clicked = 0;
    render(
      <DataState
        state="empty"
        emptyLabel="Belum ada API Key aktif di akun Anda"
        emptyAction={{ label: "+ Buat API Key Pertama", onClick: () => (clicked += 1) }}
      >
        <div>real-data</div>
      </DataState>,
    );
    expect(screen.getByText("Belum ada API Key aktif di akun Anda")).toBeTruthy();
    fireEvent.click(screen.getByText("+ Buat API Key Pertama"));
    expect(clicked).toBe(1);
  });

  test("error shows technical code and retry recovers", () => {
    let retried = 0;
    render(
      <DataState
        state="error"
        errorCode="HTTP 401 · INVALID_API_KEY"
        errorMessage="API key tidak valid"
        onRetry={() => (retried += 1)}
      >
        <div>real-data</div>
      </DataState>,
    );
    expect(screen.getByText("HTTP 401 · INVALID_API_KEY")).toBeTruthy();
    fireEvent.click(screen.getByText("Coba Lagi"));
    expect(retried).toBe(1);
  });

  test("populated renders children", () => {
    render(
      <DataState state="populated">
        <div>real-data</div>
      </DataState>,
    );
    expect(screen.getByText("real-data")).toBeTruthy();
    expect(screen.queryByTestId("data-skeleton")).toBeNull();
  });
});