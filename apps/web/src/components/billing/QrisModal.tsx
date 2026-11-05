import { useEffect, useId, useRef, useState } from "react";
import QRCode from "qrcode";
import { CheckCircle2, Clock, Copy, Loader2, QrCode, RefreshCw, X } from "lucide-react";
import { Button } from "../ui/Button";
import { useModal } from "../../hooks/useModal";
import { formatCountdown, formatIdr } from "../../lib/format";
import { Currency } from "../ui/Currency";
import type { InvoiceStatusView, InvoiceView } from "../../lib/types";
const TERMINAL = new Set(["PAID", "EXPIRED", "FAILED"]);

export function QrisModal({
  invoice,
  fetchStatus,
  pollMs = 3000,
  onClose,
  onPaid,
}: {
  invoice: InvoiceView;
  fetchStatus: (invoiceId: string) => Promise<InvoiceStatusView>;
  pollMs?: number;
  onClose: () => void;
  onPaid?: () => void;
}) {
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [status, setStatus] = useState<string>(invoice.status);
  const [countdownMs, setCountdownMs] = useState(
    () => new Date(invoice.expires_at).getTime() - Date.now(),
  );
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const titleId = useId();
  const dialogRef = useModal<HTMLDivElement>(onClose);
  const onPaidRef = useRef(onPaid);
  onPaidRef.current = onPaid;
  useEffect(() => {
    let cancelled = false;
    // SVG instead of canvas: qrcode's canvas path needs a real raster backend,
    // which happy-dom/jsdom lack. SVG renders identically and is testable.
    QRCode.toString(invoice.qris_string, {
      type: "svg",
      width: 240,
      margin: 1,
      color: { dark: "#282824", light: "#FAF9F5" },
    })
      .then((svg) => {
        if (!cancelled) setQrSvg(svg);
      })
      .catch(() => {
        if (!cancelled) setQrSvg(null);
      });
    return () => {
      cancelled = true;
    };
  }, [invoice.qris_string]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdownMs((prev) => Math.max(0, prev - 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (TERMINAL.has(status)) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const next = await fetchStatus(invoice.id);
        if (!cancelled && next.status !== status) setStatus(next.status);
      } catch {
        // transient polling failure: keep current status, try again next tick
      }
    };
    const timer = setInterval(() => void poll(), pollMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [status, invoice.id, fetchStatus, pollMs]);

  const paid = status === "PAID";

  // Fires only on the PENDING→PAID transition (status is initialised from the
  // invoice and the poller never resets a terminal status).
  useEffect(() => {
    if (paid) onPaidRef.current?.();
  }, [paid]);

  const handleCopyRef = async () => {
    try {
      await navigator.clipboard.writeText(invoice.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore clipboard error
    }
  };

  const handleManualCheck = async () => {
    setChecking(true);
    try {
      const next = await fetchStatus(invoice.id);
      if (next.status !== status) setStatus(next.status);
    } catch {
      // ignore transient status check error
    } finally {
      setChecking(false);
    }
  };
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-primary/40 px-4 py-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-full max-w-md rounded-md border border-hairline bg-surface p-5 shadow-xl outline-none my-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-hairline pb-3">
          <div>
            <div className="flex items-center gap-2">
              <QrCode className="h-4 w-4 text-accent" />
              <h2
                id={titleId}
                className="font-serif text-[18px] font-medium text-primary"
              >
                Pembayaran QRIS Dinamis
              </h2>
            </div>
            <div className="flex items-center gap-1.5 mt-1 font-mono text-[11px] text-secondary">
              <span>Ref:</span>
              <span className="font-semibold text-primary">{invoice.id}</span>
              <button
                type="button"
                onClick={handleCopyRef}
                className="ml-1 text-accent hover:underline cursor-pointer"
              >
                {copied ? "Disalin!" : "Salin"}
              </button>
            </div>
          </div>
          <button
            type="button"
            aria-label="Tutup Modal"
            onClick={onClose}
            className="rounded p-1 text-secondary hover:text-primary hover:bg-canvas transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {paid ? (
          <div
            className="mt-4 rounded-md border p-4 text-center space-y-2"
            style={{
              background: "var(--success-bg-subtle)",
              borderColor: "var(--state-success)",
            }}
          >
            <div className="flex items-center justify-center gap-1.5 text-success">
              <CheckCircle2 className="h-5 w-5" />
              <p className="font-mono text-[13px] font-semibold text-success">
                Pembayaran Lunas! Saldo telah ditambahkan
              </p>
            </div>
            <p className="text-xs text-secondary">
              Saldo otomatis terrekonsiliasi ke dompet akun Anda.
            </p>
          </div>
        ) : TERMINAL.has(status) ? (
          <div
            className="mt-4 rounded-md border p-4 text-center"
            style={{
              background: "var(--error-bg-subtle)",
              borderColor: "var(--state-error)",
            }}
          >
            <p className="font-mono text-[13px] font-semibold text-error">
              {status === "EXPIRED"
                ? "Tagihan kedaluwarsa. Silakan buat tagihan baru."
                : "Pembayaran gagal. Silakan buat tagihan baru."}
            </p>
          </div>
        ) : (
          <>
            {/* National QRIS Strip */}
            <div className="mt-3.5 flex items-center justify-between rounded border border-hairline bg-canvas px-3 py-1.5 font-mono text-[10px]">
              <div className="flex items-center gap-1.5">
                <span className="font-bold tracking-wider text-error">QRIS</span>
                <span className="text-secondary">|</span>
                <span className="text-secondary font-medium">STANDAR NASIONAL</span>
              </div>
              <div className="flex items-center gap-1.5 text-success font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                <span>BI-FAST LIVE</span>
              </div>
            </div>

            {/* QR Code Container */}
            <div className="mt-3 flex flex-col items-center justify-center rounded border border-hairline bg-surface p-3">
              {qrSvg ? (
                <div
                  data-testid="qris-svg"
                  className="h-52 w-52 flex items-center justify-center"
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                />
              ) : (
                <div className="grid h-52 w-52 place-items-center font-mono text-xs text-secondary">
                  Memuat QR...
                </div>
              )}
              <div className="mt-2 flex items-center gap-1 font-mono text-[10px] text-secondary">
                <CheckCircle2 className="h-3 w-3 text-success" />
                <span>NMID: ID1020038891002 · KATALIS AI</span>
              </div>
            </div>

            {/* Countdown Expiration Timer */}
            <div className="mt-3 flex items-center justify-between rounded border border-hairline bg-canvas px-3 py-1.5 font-mono text-xs">
              <div className="flex items-center gap-1.5 text-secondary">
                <Clock className="h-3.5 w-3.5 text-warning" />
                <span>Sisa Waktu Pembayaran:</span>
              </div>
              <span
                data-testid="qris-countdown"
                className="font-semibold tabular-nums text-accent"
              >
                {formatCountdown(countdownMs)}
              </span>
            </div>

            {/* Price breakdown */}
            <div className="mt-3 w-full rounded border border-hairline bg-canvas p-2.5 font-mono text-xs space-y-1">
              <div className="flex items-center justify-between text-secondary">
                <span>Nominal</span>
                <span className="text-primary tabular-nums">
                  {formatIdr(invoice.total_pay_idr)}
                </span>
              </div>
              <div className="flex items-center justify-between text-secondary">
                <span>Biaya Transaksi / Admin</span>
                <span className="text-success font-medium">Rp 0 (Disubsidi Katalis)</span>
              </div>
              <div className="border-t border-hairline pt-1 flex items-center justify-between font-semibold text-primary">
                <span>Total Bayar</span>
                <Currency amount={invoice.total_pay_idr} />
              </div>
            </div>

            {/* Live Webhook Polling Status */}
            <div className="mt-3 flex items-center gap-2 rounded border border-hairline bg-canvas px-3 py-2 text-xs">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-accent shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[11px] font-medium text-primary truncate">
                  Menunggu Pembayaran...
                </p>
                <p className="text-[10px] text-secondary">
                  Pembayaran Verifikasi otomatis via Webhook (polling status)
                </p>
              </div>
            </div>

            {/* Supported Payment Methods */}
            <div className="mt-3 pt-2.5 border-t border-hairline">
              <p className="font-mono text-[9px] uppercase tracking-wider text-secondary text-center mb-1.5">
                Didukung oleh Seluruh m-Banking & Dompet Digital
              </p>
              <div className="flex flex-wrap items-center justify-center gap-1 font-mono text-[9px] text-secondary">
                <span className="rounded border border-hairline bg-canvas px-1.5 py-0.5">BCA Mobile</span>
                <span className="rounded border border-hairline bg-canvas px-1.5 py-0.5">Livin' Mandiri</span>
                <span className="rounded border border-hairline bg-canvas px-1.5 py-0.5">GoPay</span>
                <span className="rounded border border-hairline bg-canvas px-1.5 py-0.5">OVO</span>
                <span className="rounded border border-hairline bg-canvas px-1.5 py-0.5">ShopeePay</span>
                <span className="rounded border border-hairline bg-canvas px-1.5 py-0.5">Dana</span>
                <span className="rounded border border-hairline bg-canvas px-1.5 py-0.5">CIMB Octo</span>
              </div>
            </div>
          </>
        )}

        {/* Modal Action Buttons Bar */}
        <div className="mt-4 pt-3 border-t border-hairline flex items-center justify-between gap-2">
          {!paid && !TERMINAL.has(status) ? (
            <>
              <button
                type="button"
                onClick={handleCopyRef}
                className="inline-flex items-center gap-1.5 rounded border border-hairline bg-canvas px-2.5 py-1.5 font-mono text-xs text-secondary hover:text-primary hover:border-strong transition-colors cursor-pointer"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>{copied ? "Ref Disalin" : "Salin Ref"}</span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleManualCheck}
                  disabled={checking}
                  className="inline-flex items-center gap-1.5 rounded border border-hairline bg-canvas px-2.5 py-1.5 font-mono text-xs text-primary hover:border-accent transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${checking ? "animate-spin" : ""}`} />
                  <span>Cek Status</span>
                </button>
                <Button onClick={onClose}>Batal</Button>
              </div>
            </>
          ) : (
            <div className="w-full flex justify-end">
              <Button onClick={onClose}>{paid ? "Selesai" : "Tutup"}</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}