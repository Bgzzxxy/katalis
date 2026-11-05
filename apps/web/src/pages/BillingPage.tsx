import { useState } from "react";
import { Panel } from "../components/ui/Panel";
import { DataState } from "../components/ui/DataState";
import { PlanSelector } from "../components/billing/PlanSelector";
import { QrisModal } from "../components/billing/QrisModal";
import { useAuth } from "../hooks/useAuth";
import { ApiError, type InvoiceView } from "../lib/types";
import { createInvoice, fetchInvoiceStatus } from "../lib/api";

export function BillingPage() {
  const { refresh } = useAuth();
  const [invoice, setInvoice] = useState<InvoiceView | null>(null);
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
    <div className="space-y-4">
      <h1 className="text-base font-semibold text-primary" style={{ letterSpacing: "-0.01em" }}>
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
        <p className="text-[11px] text-secondary">
          Tagihan QRIS aktif selama 15 menit. Saldo masuk otomatis setelah pembayaran terkonfirmasi.
        </p>
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