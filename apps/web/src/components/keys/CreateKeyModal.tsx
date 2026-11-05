import { useId, useState } from "react";
import { Check, Copy, KeyRound, Plus, ShieldCheck, X } from "lucide-react";
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
    if (busy) return;
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
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-primary/20 px-4 pt-20"
      onClick={handleClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-full max-w-lg rounded-lg border border-hairline bg-surface p-5 shadow-xl outline-none"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="flex items-center justify-between border-b border-hairline pb-3">
          <div className="flex items-center gap-2.5">
            <div className="grid h-7 w-7 place-items-center rounded border border-hairline bg-canvas text-accent">
              <KeyRound className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <h2 id={titleId} className="font-serif text-[17px] font-medium leading-tight text-primary">
                {!created ? "Buat API Key Baru" : "API Key Diterbitkan"}
              </h2>
              <p className="font-mono text-[10px] uppercase tracking-wider text-secondary">
                {!created ? "Kredensial Gateway" : "Kunci Rahasia Sekali Pakai"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded p-1 text-secondary transition-colors hover:bg-canvas hover:text-primary"
            aria-label="Tutup dialog"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {!created ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleCreate();
            }}
            className="mt-4 space-y-4"
          >
            <div className="space-y-1.5">
              <label
                htmlFor="key-name-input"
                className="block font-mono text-[11px] font-semibold uppercase tracking-[0.05em] text-secondary"
              >
                Nama key
              </label>
              <input
                id="key-name-input"
                aria-label="Nama key"
                className="w-full rounded border border-hairline bg-canvas px-3 py-2 font-sans text-[13px] text-primary placeholder:text-secondary outline-none focus:border-accent"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Cursor Laptop, Aider Bot, Evaluator"
                autoFocus
              />
              <p className="text-[11px] text-secondary">
                Label pengenal untuk membedakan konsumsi token per instans agen atau server.
              </p>
            </div>

            <div className="rounded border border-hairline bg-canvas p-3 text-[11px] text-secondary space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-primary text-[12px]">
                <ShieldCheck className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                <span>Pengungkapan Hash Kredensial</span>
              </div>
              <p className="leading-relaxed">
                Key di-hash dengan SHA-256. Nilai rahasia hanya ditampilkan satu kali saat pembuatan dan tidak dapat dipulihkan jika hilang.
              </p>
            </div>

            {error ? (
              <div className="rounded border border-error bg-surface p-2 font-mono text-[11px] text-error">
                {error}
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-hairline">
              <Button type="button" onClick={handleClose}>
                Batal
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => void handleCreate()}
                disabled={busy}
                className="inline-flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{busy ? "Memproses..." : "Buat API Key"}</span>
              </Button>
            </div>
          </form>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="rounded border border-hairline bg-canvas p-3 space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-success text-[12px]">
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                <span>API Key Berhasil Dibuat</span>
              </div>
              <p className="text-[12px] text-secondary leading-relaxed">
                Salin key berikut sekarang — key tidak akan ditampilkan lagi setelah jendela ditutup.
              </p>
            </div>

            <div className="space-y-1.5">
              <span className="block font-mono text-[11px] font-semibold uppercase tracking-[0.05em] text-secondary">
                Nilai Rahasia Kunci
              </span>
              <div
                data-testid="raw-key"
                className="rounded border bg-canvas p-3 font-mono text-[13px] break-all select-all text-primary"
                style={{ borderColor: "var(--accent-main)" }}
              >
                {created.key}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-hairline">
              <Button
                type="button"
                variant="primary"
                onClick={() => void copyKey()}
                className="inline-flex items-center gap-1.5"
              >
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Salin Key</span>
              </Button>
              <Button type="button" onClick={handleClose}>
                Tutup
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}