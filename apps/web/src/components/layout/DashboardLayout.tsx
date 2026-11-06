import { useState, type ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { Copy, Menu, Moon, Sun } from "lucide-react";
import { SidebarDrawer } from "./SidebarDrawer";
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "../../hooks/useTheme";
import { useToast } from "../../hooks/useToast";
import { useTelemetry } from "../../hooks/useTelemetry";
import { copyText, formatLatency } from "../../lib/format";
import { Currency } from "../ui/Currency";
import { CommandPaletteTrigger } from "../command/CommandPalette";

const BASE_URL = "https://katalis.sh/v1";

/** Authenticated workspace shell: slim utility header + hamburger drawer nav. */
export function DashboardLayout({ children }: { children?: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { data, error } = useTelemetry();
  const latencyMs = error ? -1 : data?.connection.latency_ms;
  const connectionOk = !error && (data?.connection.ok ?? false);
  const connected = connectionOk && latencyMs !== -1;

  const { user } = useAuth();
  const { theme, toggle } = useTheme();
  const { push } = useToast();

  async function copyBaseUrl() {
    if (await copyText(BASE_URL)) push("Base URL disalin");
    else push("Gagal menyalin Base URL", "error");
  }

  return (
    <div className="flex min-h-screen bg-canvas">
      <SidebarDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-hairline bg-surface/95 px-4 backdrop-blur-sm md:px-6">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Buka menu navigasi"
            className="inline-flex shrink-0 items-center justify-center rounded border border-hairline p-2 text-secondary hover:border-accent hover:text-primary"
          >
            <Menu className="h-4 w-4" />
          </button>

          {latencyMs !== undefined ? (
            <div className="flex shrink-0 items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full ${connected ? "animate-pulse" : ""}`}
                style={{ background: connected ? "var(--state-success)" : "var(--state-error)" }}
              />
              <span
                className={`whitespace-nowrap font-mono text-[11px] tabular-nums ${
                  connected ? "text-success" : "text-error"
                }`}
              >
                {connected ? `Terhubung · ${formatLatency(latencyMs)}` : "Koneksi Terputus"}
              </span>
            </div>
          ) : null}

          <div className="ml-auto flex shrink-0 items-center gap-3">
            <CommandPaletteTrigger />

            <button
              type="button"
              onClick={() => void copyBaseUrl()}
              className="hidden items-center gap-1.5 whitespace-nowrap rounded border border-hairline px-2.5 py-1 font-mono text-[11px] text-secondary hover:border-accent xl:inline-flex"
              title="Salin Base URL"
            >
              <span className="tabular-nums">{BASE_URL}</span>
              <Copy className="h-3 w-3" />
            </button>

            <button
              type="button"
              onClick={toggle}
              className="inline-flex shrink-0 items-center justify-center rounded border border-hairline px-2 py-1 text-secondary hover:border-accent hover:text-primary"
              aria-label={theme === "dark" ? "Aktifkan tema terang" : "Aktifkan tema gelap"}
              title={theme === "dark" ? "Tema terang" : "Tema gelap"}
            >
              {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </button>

            {user ? (
              <Currency amount={user.wallet_balance_idr} tone="success" />
            ) : (
              <span className="whitespace-nowrap font-mono text-[11px] text-secondary">—</span>
            )}
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6">{children ?? <Outlet />}</main>
      </div>
    </div>
  );
}