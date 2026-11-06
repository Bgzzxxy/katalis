import { NavLink } from "react-router-dom";
import { X } from "lucide-react";
import { useEffect } from "react";
import { NAV } from "./Sidebar";
import { useAuth } from "../../hooks/useAuth";
import { Currency } from "../ui/Currency";

/** Slide-in drawer holding the workspace navigation + wallet summary. */
export function SidebarDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label="Menu navigasi"
    >
      <div className="absolute inset-0 bg-primary/40" onClick={onClose} />
      <aside className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-hairline bg-surface shadow-lg">
        <div className="flex h-14 items-center justify-between border-b border-hairline px-4">
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded bg-primary font-mono text-[11px] font-bold text-surface">
              KT
            </span>
            <span className="font-serif text-base font-semibold tracking-tight text-primary">
              katalis
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup menu"
            className="rounded p-1 text-secondary hover:bg-canvas hover:text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/monitor"}
              onClick={onClose}
              className={({ isActive }) =>
                `rounded px-3 py-2 text-[13px] ${
                  isActive
                    ? "bg-canvas font-medium text-primary"
                    : "text-secondary hover:bg-canvas hover:text-primary"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-hairline p-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.05em] text-secondary">
            Saldo Prabayar
          </p>
          <div className="mt-1">
            <Currency amount={user?.wallet_balance_idr ?? 0} tone="success" large />
          </div>
          <NavLink
            to="/billing"
            onClick={onClose}
            className="mt-3 inline-flex rounded bg-primary px-3 py-1.5 text-[12px] font-medium text-surface hover:opacity-90"
          >
            + Top Up Saldo
          </NavLink>
        </div>
      </aside>
    </div>
  );
}