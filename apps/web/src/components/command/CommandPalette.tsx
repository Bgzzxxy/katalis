import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MODEL_CATALOG } from "../../lib/model-catalog";

export type PaletteAction = { id: string; label: string; hint?: string; run: () => void };

/** Global ⌘K / Ctrl+K command palette. Opens via the small navbar trigger. */
export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return { open, setOpen };
}

export function CommandPaletteTrigger() {
  const { open, setOpen } = useCommandPalette();
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden rounded border border-hairline px-2 py-1 font-mono text-[11px] text-secondary hover:border-accent lg:inline"
        aria-label="Buka command palette"
      >
        Cari model... ⌘K
      </button>
      {open ? <CommandPalette onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const actions = useMemo<PaletteAction[]>(() => {
    const pages: PaletteAction[] = [
      ["Monitor", "/monitor"],
      ["Model", "/models"],
      ["Dashboard Key", "/keys"],
      ["Beli / Top Up", "/billing"],
      ["Docs & Playground", "/docs"],
    ].map(([label, to]) => ({
      id: `page:${to}`,
      label,
      hint: "Halaman",
      run: () => navigate(to),
    }));

    const models: PaletteAction[] = MODEL_CATALOG.map((m) => ({
      id: `model:${m.id}`,
      label: m.id,
      hint: m.pool,
      run: () => navigate(`/models?q=${encodeURIComponent(m.id)}`),
    }));

    return [...pages, ...models];
  }, [navigate]);

  const filtered = actions.filter((a) =>
    a.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-primary/20 px-4 pt-24"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-lg rounded-md border border-hairline bg-surface shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Command palette"
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari halaman atau model..."
          aria-label="Cari halaman atau model"
          className="w-full border-b border-hairline bg-surface px-3 py-2 font-sans text-[13px] text-primary outline-none"
        />
        <ul className="max-h-80 overflow-y-auto">
          {filtered.length === 0 ? (
            <li className="px-3 py-3 text-[13px] text-secondary">Tidak ada hasil</li>
          ) : (
            filtered.slice(0, 12).map((action) => (
              <li key={action.id}>
                <button
                  type="button"
                  onClick={() => {
                    action.run();
                    onClose();
                  }}
                  className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-canvas"
                >
                  <span className="font-mono text-[12px] text-primary">{action.label}</span>
                  <span className="font-mono text-[10px] uppercase text-secondary">
                    {action.hint}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}