import { useId, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "../ui/Button";
import { useModal } from "../../hooks/useModal";
import { formatIdr } from "../../lib/format";

export function SpendLimitModal({
  keyId,
  currentLimit,
  onSave,
  onClose,
}: {
  keyId: string;
  currentLimit: number | null;
  onSave: (keyId: string, limitIdr: number | null) => Promise<void>;
  onClose: () => void;
}) {
  const [value, setValue] = useState(currentLimit === null ? "" : String(currentLimit));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const dialogRef = useModal<HTMLDivElement>(onClose);

  async function save() {
    if (busy) return;
    const trimmed = value.trim().replace(/\./g, "");
    let limit: number | null;
    if (trimmed === "") {
      limit = null;
    } else {
      limit = Number(trimmed);
      if (!Number.isFinite(limit) || limit < 0) {
        setError("Batas harus angka positif atau kosong");
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      await onSave(keyId, limit);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan batas");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-primary/20 px-4 pt-20"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-full max-w-sm rounded-lg border border-hairline bg-surface p-5 shadow-xl outline-none"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="flex items-center justify-between border-b border-hairline pb-3">
          <div className="flex items-center gap-2.5">
            <div className="grid h-7 w-7 place-items-center rounded border border-hairline bg-canvas text-accent">
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <h2 id={titleId} className="font-serif text-[17px] font-medium leading-tight text-primary">
                Batas Pemakaian (Rp)
              </h2>
              <p className="font-mono text-[10px] uppercase tracking-wider text-secondary">
                Pagu Pengeluaran Bulanan
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-secondary transition-colors hover:bg-canvas hover:text-primary"
            aria-label="Tutup dialog"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          className="mt-4 space-y-4"
        >
          <div className="space-y-1.5">
            <label
              htmlFor="spend-limit-input"
              className="block font-mono text-[11px] font-semibold uppercase tracking-[0.05em] text-secondary"
            >
              Batas Pemakaian Bulanan (IDR)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[13px] text-secondary">
                Rp
              </span>
              <input
                id="spend-limit-input"
                aria-label="Batas pemakaian"
                inputMode="numeric"
                className="w-full rounded border border-hairline bg-canvas pl-9 pr-3 py-2 font-mono text-[13px] tabular-nums text-primary placeholder:text-secondary outline-none focus:border-accent"
                placeholder="Kosongkan untuk tanpa batas"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoFocus
              />
            </div>
            <p className="text-[11px] text-secondary">
              Saat ini:{" "}
              <span className="font-mono tabular-nums font-medium text-primary">
                {currentLimit === null ? "tanpa batas" : formatIdr(currentLimit)}
              </span>
            </p>
          </div>

          <div className="rounded border border-hairline bg-canvas p-3 text-[11px] text-secondary leading-relaxed">
            Kunci otomatis mengembalikan status <span className="font-mono text-primary font-medium">HTTP 429</span> jika pemakaian mencapai batas ini.
          </div>

          {error ? (
            <div className="rounded border border-error bg-surface p-2 font-mono text-[11px] text-error">
              {error}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-hairline">
            <Button type="button" onClick={onClose}>
              Batal
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => void save()}
              disabled={busy}
            >
              {busy ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}