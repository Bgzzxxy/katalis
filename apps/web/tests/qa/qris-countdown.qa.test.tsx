// QA (independent): the QRIS countdown is a real 15-minute deadline, not a
// cosmetic ticking number. Drives the component with fake timers and checks the
// displayed mm:ss against the invoice expiry the backend issued.
import { describe, expect, test, jest } from "bun:test";
import { setupDom } from "../setup";
setupDom();
import { act, render, screen } from "@testing-library/react";
import { QrisModal } from "../../src/components/billing/QrisModal";
import type { InvoiceStatusView, InvoiceView } from "../../src/lib/types";

const status: InvoiceStatusView = {
  id: "INV-1",
  plan_type: "UNLIMITED_10D",
  status: "PENDING",
  total_pay_idr: 20000,
  paid_at: null,
};

function invoiceExpiringIn(ms: number): InvoiceView {
  return {
    id: "INV-1",
    plan_type: "UNLIMITED_10D",
    total_pay_idr: 20000,
    qris_string: "00020101021226670016COM.GOOGLE",
    status: "PENDING",
    expires_at: new Date(Date.now() + ms).toISOString(),
  };
}

describe("QA QrisModal countdown", () => {
  test("counts down one second per tick and clamps at 00:00", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-11-05T10:00:00.000Z"));
    try {
      render(
        <QrisModal
          invoice={invoiceExpiringIn(10_500)}
          fetchStatus={async () => status}
          pollMs={60_000}
          onClose={() => {}}
        />,
      );

      expect(screen.getByTestId("qris-countdown").textContent).toBe("00:11");

      act(() => {
        jest.advanceTimersByTime(3000);
      });
      expect(screen.getByTestId("qris-countdown").textContent).toBe("00:08");

      // Jump past expiry: must clamp, never go negative.
      act(() => {
        jest.advanceTimersByTime(20_000);
      });
      expect(screen.getByTestId("qris-countdown").textContent).toBe("00:00");
    } finally {
      jest.useRealTimers();
    }
  });

  test("an already-expired invoice renders 00:00 immediately", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-11-05T10:00:00.000Z"));
    try {
      render(
        <QrisModal
          invoice={invoiceExpiringIn(-5000)}
          fetchStatus={async () => status}
          pollMs={60_000}
          onClose={() => {}}
        />,
      );
      expect(screen.getByTestId("qris-countdown").textContent).toBe("00:00");
    } finally {
      jest.useRealTimers();
    }
  });
});
