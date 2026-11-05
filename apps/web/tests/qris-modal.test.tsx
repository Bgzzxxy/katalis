import { describe, expect, test } from "bun:test";
import { setupDom } from "./setup";
setupDom();
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QrisModal } from "../src/components/billing/QrisModal";
import { PlanSelector } from "../src/components/billing/PlanSelector";
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

  test("renders terminal EXPIRED message and stops polling", () => {
    const expiredInvoice: InvoiceView = {
      ...invoice,
      status: "EXPIRED",
    };

    render(
      <QrisModal
        invoice={expiredInvoice}
        fetchStatus={async () => status("EXPIRED")}
        onClose={() => {}}
      />,
    );

    expect(
      screen.getByText("Tagihan kedaluwarsa. Silakan buat tagihan baru."),
    ).toBeTruthy();
    expect(screen.queryByText("Menunggu Pembayaran...")).toBeNull();
  });

  test("renders invoice ref id and allows manual status check", async () => {
    let manualCalls = 0;
    const fetchStatus = async () => {
      manualCalls++;
      return status("PENDING");
    };

    render(
      <QrisModal
        invoice={invoice}
        fetchStatus={fetchStatus}
        pollMs={60000}
        onClose={() => {}}
      />,
    );

    expect(screen.getByText(invoice.id)).toBeTruthy();
    const cekBtn = screen.getByText("Cek Status");
    await act(async () => {
      fireEvent.click(cekBtn);
    });
    await waitFor(() => expect(manualCalls).toBeGreaterThan(0));
  });
});

describe("PlanSelector v4.0 package grid", () => {
  test("switches between packages and handles preset amounts for PREPAID", () => {
    let selectedPlan = "UNLIMITED_10D";
    let customAmount = 50000;

    const { rerender } = render(
      <PlanSelector
        selected={selectedPlan}
        onSelect={(p) => (selectedPlan = p)}
        customAmount={customAmount}
        onCustomAmountChange={(a) => (customAmount = a)}
      />,
    );

    expect(screen.getByText("Unlimited 10 Hari")).toBeTruthy();
    expect(screen.getByText("POPULER")).toBeTruthy();
    expect(screen.getByText("Trial 1 Hari")).toBeTruthy();
    expect(screen.getByText("Saldo Prabayar")).toBeTruthy();

    // Select Saldo Prabayar
    fireEvent.click(screen.getByText("Saldo Prabayar"));
    expect(selectedPlan).toBe("PREPAID");

    rerender(
      <PlanSelector
        selected={selectedPlan}
        onSelect={(p) => (selectedPlan = p)}
        customAmount={customAmount}
        onCustomAmountChange={(a) => (customAmount = a)}
      />,
    );

    // Presets should be visible
    expect(screen.getByText("Nominal Top-Up Prabayar")).toBeTruthy();
    expect(screen.getByText("Growth")).toBeTruthy();

    // Click 100k preset (Scale)
    fireEvent.click(screen.getByText("Scale"));
    expect(customAmount).toBe(100000);
  });
});
