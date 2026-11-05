import { useState } from "react";
import { Check, CheckCircle2, QrCode, Receipt, ShieldCheck, Zap } from "lucide-react";
import { DataState } from "../components/ui/DataState";
import { Currency } from "../components/ui/Currency";
import { Button } from "../components/ui/Button";
import { PlanSelector, PLANS } from "../components/billing/PlanSelector";
import { QrisModal } from "../components/billing/QrisModal";
import { useAuth } from "../hooks/useAuth";
import { ApiError, type InvoiceView } from "../lib/types";
import { createInvoice, fetchInvoiceStatus } from "../lib/api";
import { formatDateTime } from "../lib/format";

interface InvoiceBreakdown extends InvoiceView {
  base_amount_idr?: number;
  bonus_amount_idr?: number;
}

export function BillingPage() {
  const { user, refresh } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<string>("UNLIMITED_10D");
  const [customAmount, setCustomAmount] = useState<number>(50000);
  const [invoice, setInvoice] = useState<InvoiceBreakdown | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<{ code: string; message: string } | null>(null);

  const activePlan = PLANS.find((p) => p.id === selectedPlan) ?? PLANS[0];
  const clampedCustom = Math.max(5000, Math.min(1_000_000, customAmount));
  const currentAmount = selectedPlan === "PREPAID" ? clampedCustom : activePlan.priceIdr;
  const customOutOfRange =
    selectedPlan === "PREPAID" && (customAmount < 5000 || customAmount > 1_000_000);

  async function handleCheckout(planType: string, customAmountIdr?: number) {
    setStatus("loading");
    setError(null);
    const clampedAmount =
      planType === "PREPAID"
        ? Math.max(5000, Math.min(1_000_000, customAmountIdr ?? 50000))
        : undefined;
    try {
      setInvoice(await createInvoice(planType, clampedAmount));
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
      {/* Header Context Strip */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-hairline">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-secondary">
            <span className="uppercase tracking-[0.06em]">Billing & Treasury</span>
            <span>/</span>
            <span className="uppercase text-primary font-medium">Instant Top-Up</span>
          </div>
          <h1 className="font-serif text-[24px] md:text-[28px] font-medium tracking-[-0.015em] text-primary">
            Beli Paket / Top Up
          </h1>
          <p className="text-[13px] text-secondary max-w-2xl">
            Isi saldo inference pool instan dengan QRIS standar nasional. Rekonsiliasi otomatis tervalidasi via Webhook.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded border border-hairline bg-surface px-3 py-1.5 font-mono text-xs shrink-0">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          <span className="text-secondary text-[11px] uppercase tracking-wider">
            Gateway Node: ID-CGK-1 Aktif
          </span>
        </div>
      </div>

      <DataState
        state={status === "error" ? "error" : "populated"}
        errorCode={error?.code}
        errorMessage={error?.message}
        onRetry={() => setStatus("idle")}
      >
        {/* Main 2-Column Checkout Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (2/3 -> 8 Cols) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Current Wallet Balance Card */}
            <div className="rounded-md border border-hairline bg-surface p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-secondary">
                    Saldo Dompet Saat Ini
                  </span>
                  <div className="flex items-baseline gap-2">
                    <Currency amount={user?.wallet_balance_idr ?? 0} large />
                    <span className="font-mono text-xs text-secondary">IDR Saldo Aktif</span>
                  </div>
                  <p className="text-xs text-secondary">
                    {user?.unlimited_expires_at ? (
                      <>Paket Unlimited aktif hingga {formatDateTime(user.unlimited_expires_at)}</>
                    ) : (
                      <>Saldo tidak memiliki masa kedaluwarsa. Berlaku untuk seluruh model komputasi.</>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2.5 rounded border border-hairline bg-canvas px-3 py-2 text-xs shrink-0">
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                  <div>
                    <span className="font-mono text-[11px] font-semibold uppercase text-primary block">
                      Auto-Reconcile Siap
                    </span>
                    <span className="text-[11px] text-secondary">Settlement instan via Webhook</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Plan Selector Section */}
            <div className="rounded-md border border-hairline bg-surface p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-hairline pb-2.5">
                <div>
                  <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-secondary">
                    Pilihan Paket & Nominal
                  </h2>
                  <p className="text-xs text-secondary mt-0.5">
                    Pilih paket Unlimited atau nominal isi ulang saldo fleksibel
                  </p>
                </div>
                <span className="rounded border border-hairline bg-canvas px-2 py-0.5 font-mono text-[10px] uppercase text-secondary">
                  Standard Tier
                </span>
              </div>
              <PlanSelector
                selected={selectedPlan}
                onSelect={setSelectedPlan}
                customAmount={customAmount}
                onCustomAmountChange={setCustomAmount}
                pending={status === "loading"}
              />
            </div>

            {/* Payment Method Selector */}
            <div className="rounded-md border border-hairline bg-surface p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-hairline pb-2.5">
                <div>
                  <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-secondary">
                    Metode Pembayaran
                  </h2>
                  <p className="text-xs text-secondary mt-0.5">
                    Settlement otomatis detik ini juga via interkoneksi BI-FAST / ASPI
                  </p>
                </div>
                <span className="rounded border border-success bg-[var(--success-bg-subtle)] px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-success">
                  0% Biaya Gateway
                </span>
              </div>

              <div className="flex items-start justify-between rounded border border-hairline bg-canvas p-3 gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-hairline bg-surface text-accent">
                    <QrCode className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-serif text-[15px] font-medium text-primary">
                        QRIS Dynamic Instant
                      </span>
                      <span className="rounded bg-surface px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase text-primary border border-hairline">
                        Direkomendasikan
                      </span>
                    </div>
                    <p className="text-[12px] text-secondary">
                      Dukungan penuh: GoPay, OVO, Dana, ShopeePay, LinkAja, BCA Mobile, Livin' Mandiri, CIMB Octo, dan seluruh m-Banking nasional.
                    </p>
                    <div className="flex items-center gap-2 pt-1 font-mono text-[10px] text-secondary">
                      <span className="rounded border border-hairline bg-surface px-1.5 py-0.5">
                        Settlement: Instant (T+0s)
                      </span>
                      <span className="rounded border border-hairline bg-surface px-1.5 py-0.5">
                        Standar BI
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-surface mt-0.5">
                  <Check className="h-3 w-3" />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (1/3 -> 4 Cols) */}
          <div className="lg:col-span-4 space-y-4 lg:sticky lg:top-4">
            {/* Itemized Payment Summary Card */}
            <div className="rounded-md border border-hairline bg-surface p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-hairline pb-2.5">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-secondary">
                  Ringkasan Tagihan
                </span>
                <Receipt className="h-4 w-4 text-secondary" />
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center text-secondary">
                  <span>Paket Terpilih</span>
                  <span className="font-medium text-primary">{activePlan.label}</span>
                </div>
                <div className="flex justify-between items-center text-secondary">
                  <span>Nominal Dasar</span>
                  <Currency amount={currentAmount} />
                </div>
                {customOutOfRange ? (
                  <p className="text-[11px] text-warning">
                    Nominal disesuaikan ke rentang Rp 5.000&ndash;1.000.000.
                  </p>
                ) : null}
                <div className="flex justify-between items-center text-secondary">
                  <span>PPN / Pajak (11%)</span>
                  <span className="font-mono tabular-nums text-primary">Rp 0</span>
                </div>
                <div className="flex justify-between items-center text-secondary">
                  <span>Biaya Gateway</span>
                  <span className="font-mono text-[11px] font-semibold text-success">
                    Rp 0 (Subsidi Katalis)
                  </span>
                </div>
              </div>

              <div className="border-t border-hairline pt-3 space-y-1">
                <div className="flex justify-between items-baseline">
                  <span className="font-serif text-[15px] font-medium text-primary">
                    Total Tagihan
                  </span>
                  <Currency amount={currentAmount} large />
                </div>
                <p className="text-[11px] text-secondary text-right">
                  Termasuk PPN & pembebasan biaya transfer
                </p>
              </div>

              <Button
                variant="primary"
                className="w-full justify-center py-2.5 text-xs font-semibold flex items-center gap-2 cursor-pointer"
                disabled={status === "loading"}
                onClick={() =>
                  void handleCheckout(
                    selectedPlan,
                    selectedPlan === "PREPAID" ? customAmount : undefined,
                  )
                }
              >
                <QrCode className="h-4 w-4" />
                <span>{status === "loading" ? "Membuat Tagihan..." : "Buat Tagihan QRIS"}</span>
              </Button>

              <div className="pt-2 border-t border-hairline space-y-2 text-[11px] text-secondary">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-success shrink-0" />
                  <span>Katalis Escrow Protection standar PCI-DSS</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5 text-accent shrink-0" />
                  <span>Kredit langsung masuk tanpa upload bukti transfer</span>
                </div>
              </div>
            </div>

            {/* Quick Policy Mini Card */}
            <div className="rounded-md border border-hairline bg-surface p-3.5 space-y-1.5">
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-secondary block">
                Informasi Kebijakan
              </span>
              <p className="text-xs text-secondary leading-relaxed">
                Tagihan QRIS aktif selama 15 menit. Saldo top-up tidak memiliki masa kedaluwarsa dan dapat dialokasikan lintas seluruh model komputasi Katalis.
              </p>
            </div>
          </div>
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