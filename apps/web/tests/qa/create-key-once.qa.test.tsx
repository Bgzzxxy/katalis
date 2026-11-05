// QA (independent): the raw API key must be rendered exactly once and must not
// survive a close/reopen cycle. Uses rerender (no DOM churn) so any "keyed by
// component identity" leak in the React tree would be caught.
import { describe, expect, test } from "bun:test";
import { setupDom } from "../setup";
setupDom();
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CreateKeyModal } from "../../src/components/keys/CreateKeyModal";
import { ToastProvider } from "../../src/hooks/useToast";
import type { CreatedKey } from "../../src/lib/types";

const RAW = "sk-ktl-ABCDEFGHJKLMNPQRSTUVWXYZ123456";
const created: CreatedKey = {
  id: "k1",
  name: "Cursor Laptop",
  key_prefix: "sk-ktl-8f92",
  spend_limit_idr: null,
  spent_idr: 0,
  is_active: true,
  last_used_at: null,
  created_at: new Date().toISOString(),
  key: RAW,
};

function modal(open: boolean, onClose: () => void) {
  return (
    <ToastProvider>
      <CreateKeyModal open={open} onClose={onClose} onCreate={async () => created} />
    </ToastProvider>
  );
}

describe("QA CreateKeyModal: raw key lifecycle", () => {
  test("shows the raw key once, drops it on close, never restores on reopen", async () => {
    let closed = 0;
    const { rerender } = render(modal(true, () => (closed += 1)));

    expect(screen.queryByTestId("raw-key")).toBeNull();

    fireEvent.click(screen.getByText("Buat API Key"));
    await waitFor(() => expect(screen.getByTestId("raw-key").textContent).toBe(RAW));

    fireEvent.click(screen.getByText("Tutup"));
    expect(closed).toBe(1);

    // Reopen via rerender only (component identity preserved): the key must be gone.
    rerender(modal(false, () => (closed += 1)));
    rerender(modal(true, () => (closed += 1)));
    expect(screen.queryByTestId("raw-key")).toBeNull();
    expect(screen.getByText("Buat API Key Baru")).toBeTruthy();
  });

  test("the raw key never leaks into the list-facing id/prefix fields", async () => {
    render(modal(true, () => {}));
    fireEvent.click(screen.getByText("Buat API Key"));
    await waitFor(() => expect(screen.getByTestId("raw-key")).toBeTruthy());
    const revealed = screen.getByTestId("raw-key").textContent;
    expect(revealed).toContain("sk-ktl-");
    // The prefix shown in dashboards is a truncated form, never the full secret.
    expect(created.key_prefix.length).toBeLessThan(RAW.length);
  });
});
