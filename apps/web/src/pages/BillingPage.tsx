import { useState } from "react";
import { DataState } from "../components/ui/DataState";
import { Panel } from "../components/ui/Panel";
import { Currency } from "../components/ui/Currency";
import { PlanSelector } from "../components/billing/PlanSelector";
import { QrisModal } from "../components/billing/QrisModal";
import { useAuth } from "../hooks/useAuth";
import { ApiError, type InvoiceView } from "../lib/types";
import { createInvoice, fetchInvoiceStatus } from "../lib/api";

interface InvoiceBreakdown extends InvoiceView {
  base_amount_idr?: number;
  bonus_amount_idr?: number;
}

export function BillingPage() {
  const { refresh } = useAuth();
  const [invoice, setInvoice] = useState<InvoiceBreakdown | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<{ code: string; message: string } | null>(null);

  async function handleCheckout(planType: string, customAmountIdr?: number) {
    setStatus("loading");
    setError(null);
    try {
      setInvoice(await createInvoice(planType, customAmountIdr));
      setStatus("idle");
    } catch (err) {
      const apiErr =
        err instanceof ApiError ? err : new ApiError(0, "NETWORK_ERROR", "Gagal membuat tagihan");
      setError({ code: apiErr.errorCodeLabel, message: apiErr.message });
      setStatus("error");
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-[22px] leading-7 font-medium tracking-[-0.015em] text-primary">
        Beli Paket / Top Up
      </h1>

      <Panel title="Pilih Paket">
        <PlanSelector pending={status === "loading"} onCheckout={(p, a) => void handleCheckout(p, a)} />
      </Panel>

      <DataState
        state={status === "error" ? "error" : "populated"}
        errorCode={error?.code}
        errorMessage={error?.message}
        onRetry={() => setStatus("idle")}
      >
        <div className="space-y-6">
          {invoice ? (
            <Panel title="Rincian Tagihan">
              <div className="space-y-2 text-[13px]">
                <div className="flex items-center justify-between">
                  <span className="text-secondary">Nominal Dasar</span>
                  <Currency amount={invoice.base_amount_idr ?? invoice.total_pay_idr} />
                </div>
                {(invoice.bonus_amount_idr ?? 0) > 0 ? (
                  <div className="flex items-center justify-between">
                    <span className="text-secondary">Bonus Saldo</span>
                    <Currency amount={invoice.bonus_amount_idr ?? 0} tone="success" />
                  </div>
                ) : null}
                <div className="flex items-center justify-between border-t border-hairline pt-2">
                  <span className="text-secondary">Total Bayar</span>
                  <Currency amount={invoice.total_pay_idr} />
                </div>
              </div>
            </Panel>
          ) : (
            <p className="text-[13px] text-pretty text-secondary">
              Tagihan QRIS aktif selama 15 menit. Saldo masuk otomatis setelah pembayaran terkonfirmasi.
            </p>
          )}
        </div>
      </DataState>

      {invoice ? (
        <QrisModal
          invoice={invoice}
          fetchStatus={fetchInvoiceStatus}
          onClose={() => setInvoice(null)}
          onPaid={() => void refresh()}
        />
      ) : null}
    </div>
  );
}