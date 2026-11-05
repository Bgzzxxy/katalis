import { describe, expect, test } from "bun:test";
import { setupDom } from "./setup";
setupDom();
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CreateKeyModal } from "../src/components/keys/CreateKeyModal";
import { SpendLimitModal } from "../src/components/keys/SpendLimitModal";
import { ToastProvider } from "../src/hooks/useToast";
import type { CreatedKey } from "../src/lib/types";

const created: CreatedKey = {
  id: "k1",
  name: "Cursor Laptop",
  key_prefix: "sk-ktl-8f92",
  spend_limit_idr: null,
  spent_idr: 0,
  is_active: true,
  last_used_at: null,
  created_at: new Date().toISOString(),
  key: "sk-ktl-ABCDEFGHJKLMNPQRSTUVWXYZ123456",
};

describe("CreateKeyModal: raw key shown exactly once", () => {
  test("reveals the raw key after creation, never again after close", async () => {
    let closed = 0;
    const { rerender } = render(
      <ToastProvider>
        <CreateKeyModal open onClose={() => (closed += 1)} onCreate={async () => created} />
      </ToastProvider>,
    );

    fireEvent.change(screen.getByLabelText("Nama key"), {
      target: { value: "Cursor Laptop" },
    });
    fireEvent.click(screen.getByText("Buat API Key"));

    await waitFor(() =>
      expect(screen.getByTestId("raw-key").textContent).toBe(created.key),
    );
    expect(screen.getByText(/tidak akan ditampilkan lagi/i)).toBeTruthy();

    fireEvent.click(screen.getByText("Tutup"));
    expect(closed).toBe(1);

    rerender(
      <ToastProvider>
        <CreateKeyModal open={false} onClose={() => (closed += 1)} onCreate={async () => created} />
      </ToastProvider>,
    );
    rerender(
      <ToastProvider>
        <CreateKeyModal open onClose={() => (closed += 1)} onCreate={async () => created} />
      </ToastProvider>,
    );

    expect(screen.queryByTestId("raw-key")).toBeNull();
  });
});

describe("SpendLimitModal", () => {
  test("submits numeric limit and allows clearing limit", async () => {
    let savedLimit: number | null | undefined;
    let closed = false;

    const { rerender } = render(
      <SpendLimitModal
        keyId="k1"
        currentLimit={100_000}
        onSave={async (_id, limit) => {
          savedLimit = limit;
        }}
        onClose={() => {
          closed = true;
        }}
      />,
    );

    expect(screen.getByText("Batas Pemakaian (Rp)")).toBeTruthy();
    expect(screen.getByText(/Rp 100\.000/)).toBeTruthy();

    const input = screen.getByLabelText("Batas pemakaian");
    fireEvent.change(input, { target: { value: "250.000" } });
    fireEvent.click(screen.getByText("Simpan"));

    await waitFor(() => expect(savedLimit).toBe(250000));
    expect(closed).toBe(true);

    // Now test clearing limit
    savedLimit = undefined;
    closed = false;
    rerender(
      <SpendLimitModal
        keyId="k1"
        currentLimit={250_000}
        onSave={async (_id, limit) => {
          savedLimit = limit;
        }}
        onClose={() => {
          closed = true;
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText("Batas pemakaian"), { target: { value: "" } });
    fireEvent.click(screen.getByText("Simpan"));

    await waitFor(() => expect(savedLimit).toBeNull());
    expect(closed).toBe(true);
  });

  test("shows error on invalid input", async () => {
    let savedLimit: number | null | undefined;

    render(
      <SpendLimitModal
        keyId="k1"
        currentLimit={null}
        onSave={async (_id, limit) => {
          savedLimit = limit;
        }}
        onClose={() => {}}
      />,
    );

    fireEvent.change(screen.getByLabelText("Batas pemakaian"), { target: { value: "-5000" } });
    fireEvent.click(screen.getByText("Simpan"));

    expect(screen.getByText("Batas harus angka positif atau kosong")).toBeTruthy();
    expect(savedLimit).toBeUndefined();
  });
});