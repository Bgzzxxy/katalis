import { NavLink } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { Currency } from "../ui/Currency";

export const NAV = [
  { to: "/monitor", label: "Overview" },
  { to: "/models", label: "Model" },
  { to: "/keys", label: "API Keys" },
  { to: "/billing", label: "Credits / Top Up" },
  { to: "/usage", label: "Pemakaian" },
  { to: "/docs", label: "Playground" },
] as const;

/** Authenticated workspace left rail (v4.0 §5.2): nav + wallet summary. */
export function Sidebar() {
  const { user } = useAuth();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-hairline bg-surface md:flex">
      <div className="flex h-14 items-center gap-2 border-b border-hairline px-4">
        <span className="grid h-6 w-6 place-items-center rounded bg-primary font-mono text-[11px] font-bold text-surface">
          KT
        </span>
        <span className="font-serif text-base font-semibold tracking-tight text-primary">katalis</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/monitor"}
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
        <p className="font-mono text-[11px] uppercase tracking-[0.05em] text-secondary">Saldo Prabayar</p>
        <div className="mt-1">
          <Currency amount={user?.wallet_balance_idr ?? 0} tone="success" large />
        </div>
        <NavLink
          to="/billing"
          className="mt-3 inline-flex rounded bg-primary px-3 py-1.5 text-[12px] font-medium text-surface hover:opacity-90"
        >
          + Top Up Saldo
        </NavLink>
      </div>
    </aside>
  );
}