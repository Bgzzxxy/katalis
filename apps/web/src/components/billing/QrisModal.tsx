import { useEffect, useId, useRef, useState } from "react";
import QRCode from "qrcode";
import { Button } from "../ui/Button";
import { useModal } from "../../hooks/useModal";
import { formatCountdown } from "../../lib/format";
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

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-primary/20 px-4 pt-16" onClick={onClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-full max-w-md rounded-md border border-hairline bg-surface p-5 shadow-xl outline-none"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2
          id={titleId}
          className="text-[11px] font-semibold uppercase tracking-[0.05em] text-secondary"
        >
          Scan QRIS untuk Membayar
        </h2>

        {paid ? (
          <div
            className="mt-4 rounded-md border p-4 text-center"
            style={{ background: "var(--success-subtle)", borderColor: "var(--state-success)" }}
          >
            <p className="font-mono text-[13px] font-semibold text-success">
              Pembayaran Lunas! Saldo telah ditambahkan
            </p>
          </div>
        ) : TERMINAL.has(status) ? (
          <div
            className="mt-4 rounded-md border p-4 text-center"
            style={{ background: "var(--error-subtle)", borderColor: "var(--state-error)" }}
          >
            <p className="font-mono text-[13px] font-semibold text-error">
              {status === "EXPIRED"
                ? "Tagihan kedaluwarsa. Silakan buat tagihan baru."
                : "Pembayaran gagal. Silakan buat tagihan baru."}
            </p>
          </div>
        ) : (
          <>
            <div
              className="mt-4 flex items-center justify-center rounded-md border bg-surface p-4"
              style={{ borderColor: "var(--border-hairline)" }}
            >
              {qrSvg ? (
                <div
                  data-testid="qris-svg"
                  className="h-60 w-60"
                  // Generated locally by `qrcode` from the payload; no user HTML.
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                />
              ) : (
                <div className="grid h-60 w-60 place-items-center text-[12px] text-secondary">
                  Memuat QR...
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-secondary">
                  Total Bayar
                </p>
                <div className="mt-1">
                  <Currency amount={invoice.total_pay_idr} large />
                </div>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-secondary">
                  Kedaluwarsa
                </p>
                <p
                  data-testid="qris-countdown"
                  className="font-mono text-xl font-semibold tabular-nums text-accent"
                >
                  {formatCountdown(countdownMs)}
                </p>
              </div>
            </div>

            <p className="mt-3 text-center font-mono text-[11px] text-secondary">
              Menunggu Pembayaran...
            </p>
          </>
        )}

        <div className="mt-5 flex justify-end">
          <Button onClick={onClose}>{paid ? "Selesai" : "Tutup"}</Button>
        </div>
      </div>
    </div>
  );
}