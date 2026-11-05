import { NavLink } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../hooks/useToast";
import { copyText, formatIdr, formatLatency } from "../../lib/format";
import { CommandPaletteTrigger } from "../command/CommandPalette";

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
    <header className="sticky top-0 z-30 border-b border-hairline bg-surface">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 md:px-6">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded bg-primary font-mono text-[12px] font-semibold text-surface">
            KT
          </span>
          <span className="font-sans text-[14px] font-semibold text-primary">katalis</span>
          <span className="hidden rounded border border-hairline bg-canvas px-1.5 py-0.5 font-mono text-[10px] text-secondary sm:inline">
            GATEWAY
          </span>
        </div>

        {latencyMs !== undefined ? (
          <div className="flex items-center gap-1.5">
            <span
              className={`h-2 w-2 rounded-full ${connected ? "animate-pulse" : ""}`}
              style={{
                background: connected ? "var(--state-success)" : "var(--state-error)",
              }}
            />
            <span className="font-mono text-[11px] text-secondary">
              {connected ? `Terhubung · ${formatLatency(latencyMs)}` : "Koneksi Terputus"}
            </span>
          </div>
        ) : null}

        <nav className="ml-2 hidden items-center gap-1 md:flex">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                `rounded px-3 py-1.5 font-sans text-[13px] ${
                  isActive ? "bg-primary text-surface" : "text-secondary hover:bg-canvas"
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <CommandPaletteTrigger />

          <button
            type="button"
            onClick={copyBaseUrl}
            className="hidden rounded border border-hairline px-2 py-1 font-mono text-[11px] text-secondary hover:border-accent sm:inline"
            title="Salin Base URL"
          >
            {BASE_URL}
          </button>

          {user ? (
            <span className="font-mono text-[13px] font-semibold tabular-nums text-success">
              {formatIdr(user.wallet_balance_idr)}
            </span>
          ) : (
            <NavLink
              to="/auth/login"
              className="rounded bg-primary px-3 py-1.5 font-mono text-[11px] text-surface"
            >
              Masuk
            </NavLink>
          )}
        </div>
      </div>

      <nav className="flex items-center gap-1 overflow-x-auto border-t border-hairline px-4 py-1 md:hidden">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `shrink-0 rounded px-3 py-1.5 font-sans text-[13px] ${
                isActive ? "bg-primary text-surface" : "text-secondary"
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