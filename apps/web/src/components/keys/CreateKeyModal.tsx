import { useId, useState } from "react";
import { Copy, Plus } from "lucide-react";
import { Button } from "../ui/Button";
import { useModal } from "../../hooks/useModal";
import { useToast } from "../../hooks/useToast";
import { copyText } from "../../lib/format";
import type { CreatedKey } from "../../lib/types";

export function CreateKeyModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name?: string) => Promise<CreatedKey>;
}) {
  const [name, setName] = useState("");
  const [created, setCreated] = useState<CreatedKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { push } = useToast();
  const titleId = useId();
  const dialogRef = useModal<HTMLDivElement>(handleClose, open);

  if (!open) return null;

  async function handleCreate() {
    setBusy(true);
    setError(null);
    try {
      const result = await onCreate(name.trim() || undefined);
      setCreated(result);
      push("API key berhasil dibuat");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat API key");
    } finally {
      setBusy(false);
    }
  }

  function handleClose() {
    setCreated(null);
    setName("");
    setError(null);
    onClose();
  }

  async function copyKey() {
    if (created && (await copyText(created.key))) push("API key disalin");
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-primary/20 px-4 pt-24" onClick={handleClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-full max-w-md rounded-md border border-hairline bg-surface p-4 shadow-xl outline-none"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        {!created ? (
          <>
            <h2
              id={titleId}
              className="text-[11px] font-semibold uppercase tracking-[0.05em] text-secondary"
            >
              Buat API Key Baru
            </h2>
            <label className="mt-3 flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-secondary">
              Nama key
              <input
                aria-label="Nama key"
                className="rounded border border-hairline bg-surface px-2 py-1.5 font-sans text-[13px] text-primary outline-none focus:border-accent"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Cursor Laptop"
              />
            </label>
            {error ? <p className="mt-2 font-mono text-[11px] text-error">{error}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <Button onClick={handleClose}>Batal</Button>
              <Button variant="primary" onClick={() => void handleCreate()} disabled={busy} className="inline-flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{busy ? "Memproses..." : "Buat API Key"}</span>
              </Button>
            </div>
          </>
        ) : (
          <>
            <h2
              id={titleId}
              className="text-[11px] font-semibold uppercase tracking-[0.05em] text-secondary"
            >
              API Key Diterbitkan
            </h2>
            <p className="mt-2 text-[13px] text-secondary">
              Salin key berikut sekarang — key tidak akan ditampilkan lagi setelah jendela ditutup.
            </p>
            <div
              data-testid="raw-key"
              className="mt-3 rounded border bg-canvas p-3 font-mono text-[12px] break-all text-primary"
              style={{ borderColor: "var(--accent-main)" }}
            >
              {created.key}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="primary" onClick={() => void copyKey()} className="inline-flex items-center gap-1.5">
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Salin Key</span>
              </Button>
              <Button onClick={handleClose}>Tutup</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}