import { describe, expect, test } from "bun:test";
import { setupDom } from "./setup";
setupDom();
import { render, screen, waitFor } from "@testing-library/react";
import { QrisModal } from "../src/components/billing/QrisModal";
import type { InvoiceStatusView, InvoiceView } from "../src/lib/types";

const invoice: InvoiceView = {
  id: "INV-KTL-20261105-abcde",
  plan_type: "UNLIMITED_10D",
  total_pay_idr: 20000,
  qris_string: "00020101021226670016COM.GOOGLE...",
  status: "PENDING",
  expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
};

function status(state: string): InvoiceStatusView {
  return {
    id: invoice.id,
    plan_type: invoice.plan_type,
    status: state,
    total_pay_idr: invoice.total_pay_idr,
    paid_at: state === "PAID" ? new Date().toISOString() : null,
  };
}

describe("QrisModal polling", () => {
  test("shows pending first, then flips to paid automatically", async () => {
    let calls = 0;
    const fetchStatus = async () => (calls++ === 0 ? status("PENDING") : status("PAID"));

    render(
      <QrisModal
        invoice={invoice}
        fetchStatus={fetchStatus}
        pollMs={10}
        onClose={() => {}}
      />,
    );

    expect(screen.getByText("Menunggu Pembayaran...")).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId("qris-svg")).toBeTruthy(), {
      timeout: 2000,
    });
    expect(screen.getByTestId("qris-countdown").className).toContain("tabular-nums");

    await waitFor(
      () => expect(screen.getByText("Pembayaran Lunas! Saldo telah ditambahkan")).toBeTruthy(),
      { timeout: 2000 },
    );
  });
});