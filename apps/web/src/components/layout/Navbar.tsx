import { NavLink } from "react-router-dom";
import { Copy } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../hooks/useToast";
import { copyText, formatLatency } from "../../lib/format";
import { CommandPaletteTrigger } from "../command/CommandPalette";
import { Currency } from "../ui/Currency";

const TABS = [
  { to: "/monitor", label: "Monitor" },
  { to: "/models", label: "Model" },
  { to: "/keys", label: "Dashboard Key" },
  { to: "/billing", label: "Beli / Top Up" },
  { to: "/docs", label: "Docs & Playground" },
];

const BASE_URL = "https://katalis.sh/v1";

export function Navbar({
  latencyMs,
  connectionOk = true,
}: {
  latencyMs?: number;
  connectionOk?: boolean;
}) {
  const { user } = useAuth();
  const { push } = useToast();

  async function copyBaseUrl() {
    if (await copyText(BASE_URL)) push("Base URL disalin");
    else push("Gagal menyalin Base URL", "error");
  }

  const connected = connectionOk && latencyMs !== -1;

  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-surface/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 md:px-6">
        <div className="flex shrink-0 items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded bg-primary font-mono text-[12px] font-bold text-surface">
            KT
          </span>
          <span className="font-serif text-base font-semibold tracking-tight text-primary">
            katalis
          </span>
          <span className="hidden rounded border border-hairline bg-canvas px-1.5 py-0.5 font-mono text-[10px] text-secondary sm:inline">
            GATEWAY
          </span>
        </div>

        {latencyMs !== undefined ? (
          <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
            <span
              className={`h-2 w-2 rounded-full ${connected ? "animate-pulse" : ""}`}
              style={{
                background: connected ? "var(--state-success)" : "var(--state-error)",
              }}
            />
            <span className={`whitespace-nowrap font-mono text-[11px] tabular-nums ${connected ? "text-success" : "text-error"}`}>
              {connected ? `Terhubung · ${formatLatency(latencyMs)}` : "Koneksi Terputus"}
            </span>
          </div>
        ) : null}

        {/* Tabs need the full row; below xl they move to the scrollable second row
            so nothing wraps in the 768-1280px range. */}
        <nav className="ml-2 hidden shrink-0 items-center gap-1 xl:flex">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                `whitespace-nowrap rounded px-3 py-1.5 font-sans text-xs ${
                  isActive
                    ? "bg-primary font-medium text-surface"
                    : "text-secondary hover:text-primary hover:bg-canvas"
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-3">
          <CommandPaletteTrigger />

          <button
            type="button"
            onClick={copyBaseUrl}
            className="hidden items-center gap-1.5 whitespace-nowrap rounded border border-hairline px-2.5 py-1 font-mono text-[11px] text-secondary hover:border-accent xl:inline-flex"
            title="Salin Base URL"
          >
            <span className="tabular-nums">{BASE_URL}</span>
            <Copy className="h-3 w-3" aria-hidden="true" />
          </button>

          {user ? (
            <Currency amount={user.wallet_balance_idr} tone="success" />
          ) : (
            <NavLink
              to="/auth/login"
              className="shrink-0 whitespace-nowrap rounded bg-primary px-3 py-1.5 font-sans text-xs font-medium text-surface"
            >
              Masuk
            </NavLink>
          )}
        </div>
      </div>

      <nav className="flex items-center gap-1 overflow-x-auto border-t border-hairline px-4 py-1 xl:hidden">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `shrink-0 whitespace-nowrap rounded px-3 py-1.5 font-sans text-xs ${
                isActive
                  ? "bg-primary font-medium text-surface"
                  : "text-secondary hover:text-primary hover:bg-canvas"
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}