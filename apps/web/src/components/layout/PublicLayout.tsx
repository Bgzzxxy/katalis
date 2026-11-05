import type { ReactNode } from "react";
import { Link, Outlet } from "react-router-dom";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";

/** Public shell (v4.0 §5.2): centered top header, no left sidebar. */
export function PublicLayout({ children }: { children?: ReactNode }) {
  const { theme, toggle } = useTheme();

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-30 border-b border-hairline bg-surface/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 md:px-6">
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded bg-primary font-mono text-[11px] font-bold text-surface">
              KT
            </span>
            <span className="font-serif text-base font-semibold tracking-tight text-primary">katalis</span>
          </Link>

          <nav className="ml-4 hidden items-center gap-5 md:flex">
            <NavItem to="/models" label="Model" />
            <NavItem to="/docs" label="Docs" />
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={toggle}
              className="inline-flex items-center justify-center rounded border border-hairline px-2 py-1 text-secondary hover:border-accent hover:text-primary"
              aria-label={theme === "dark" ? "Aktifkan tema terang" : "Aktifkan tema gelap"}
            >
              {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </button>
            <Link className="text-[13px] text-secondary hover:text-primary" to="/auth/login">
              Masuk
            </Link>
            <Link
              className="inline-flex items-center rounded bg-primary px-3 py-1.5 text-[13px] font-medium text-surface hover:opacity-90"
              to="/auth/register"
            >
              Dapatkan API Key
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6">{children ?? <Outlet />}</main>
    </div>
  );
}

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="text-[13px] text-secondary hover:text-primary">
      {label}
    </Link>
  );
}