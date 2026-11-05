import { useId, useState } from "react";
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
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-primary/20 px-4 pt-24" onClick={onClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-full max-w-sm rounded-md border border-hairline bg-surface p-4 outline-none"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2
          id={titleId}
          className="text-[11px] font-semibold uppercase tracking-[0.05em] text-secondary"
        >
          Batas Pemakaian (Rp)
        </h2>
        <input
          aria-label="Batas pemakaian"
          inputMode="numeric"
          className="mt-3 w-full rounded border border-hairline bg-surface px-2 py-1.5 font-mono text-[13px] tabular-nums text-primary outline-none focus:border-accent"
          placeholder="Kosongkan untuk tanpa batas"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <p className="mt-2 text-[11px] text-secondary">
          Saat ini: {currentLimit === null ? "tanpa batas" : formatIdr(currentLimit)}
        </p>
        {error ? <p className="mt-2 font-mono text-[11px] text-error">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={onClose}>Batal</Button>
          <Button variant="primary" onClick={() => void save()} disabled={busy}>
            {busy ? "Menyimpan..." : "Simpan"}
          </Button>
        </div>
      </div>
    </div>
  );
}