import { useMemo, useState } from "react";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { DataState } from "../components/ui/DataState";
import { Currency } from "../components/ui/Currency";
import { useAuth } from "../hooks/useAuth";
import { useKeys } from "../hooks/useKeys";
import { useDailyUsage } from "../hooks/useDailyUsage";
import { useToast } from "../hooks/useToast";
import { copyText, formatDateTime, formatIdr, formatNumber } from "../lib/format";
import type { ApiKeyView } from "../lib/types";
import { CreateKeyModal } from "../components/keys/CreateKeyModal";
import { SpendLimitModal } from "../components/keys/SpendLimitModal";
import {
  Copy,
  Gauge,
  KeyRound,
  Pause,
  Play,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Wallet,
} from "lucide-react";

type StatusFilter = "ALL" | "ACTIVE" | "PAUSED";

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "ALL", label: "Semua" },
  { value: "ACTIVE", label: "Aktif" },
  { value: "PAUSED", label: "Dijeda" },
];

export function KeysDashboardPage() {
  const { status, keys, error, refresh, create, setLimit, toggleActive, revoke } = useKeys();
  const { user } = useAuth();
  const dailyUsage = useDailyUsage();
  const { push } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [limitTarget, setLimitTarget] = useState<ApiKeyView | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return keys.filter((key) => {
      const matchesQuery =
        q === "" || key.name.toLowerCase().includes(q) || key.key_prefix.toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === "ALL" || (statusFilter === "ACTIVE" ? key.is_active : !key.is_active);
      return matchesQuery && matchesStatus;
    });
  }, [keys, query, statusFilter]);

  const activeCount = keys.filter((key) => key.is_active).length;

  async function handleRevoke(key: ApiKeyView) {
    if (!confirm(`Revoke API key "${key.name}"? Aksi tidak dapat dibatalkan.`)) return;
    try {
      await revoke(key.id);
      push("API key dicabut", "error");
    } catch (err) {
      push(err instanceof Error ? err.message : "Gagal mencabut key", "error");
    }
  }

  async function copyPrefix(prefix: string) {
    if (await copyText(prefix)) push("Prefix key disalin");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-secondary">
            Console Credentials
          </p>
          <h1 className="mt-1 font-serif text-[22px] leading-7 font-medium tracking-[-0.015em] text-primary">
            API Keys
          </h1>
          <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-secondary">
            Kelola key untuk agen, editor, dan pipeline dengan batas pengeluaran terperinci.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 self-start"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Buat API Key Baru</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-md border border-hairline bg-surface p-4">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-secondary">
              Sisa Saldo
            </p>
            <Wallet className="h-4 w-4 text-secondary" aria-hidden="true" />
          </div>
          <div className="mt-2">
            <Currency amount={user?.wallet_balance_idr ?? 0} tone="success" large />
          </div>
          <p className="mt-1 font-mono text-[10px] text-secondary">
            Tersedia untuk konsumsi API gateway
          </p>
        </div>
        <div className="rounded-md border border-hairline bg-surface p-4">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-secondary">
              Status Paket
            </p>
            <KeyRound className="h-4 w-4 text-secondary" aria-hidden="true" />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="font-mono text-[13px] tabular-nums text-primary">
              {user?.unlimited_expires_at ? formatDateTime(user.unlimited_expires_at) : "Standar"}
            </span>
            <Badge tone={user?.unlimited_expires_at ? "accent" : "success"}>
              {user?.unlimited_expires_at ? "UNLIMITED 10 HARI" : "PAY-AS-YOU-GO"}
            </Badge>
          </div>
          <p className="mt-1 font-mono text-[10px] text-secondary">
            {user?.unlimited_expires_at ? "Masa aktif paket berjalan" : "Tagihan dihitung per pemakaian token"}
          </p>
        </div>
        <div className="rounded-md border border-hairline bg-surface p-4">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-secondary">
              Pemakaian Hari Ini
            </p>
            <Gauge className="h-4 w-4 text-secondary" aria-hidden="true" />
          </div>
          {dailyUsage.status === "populated" && dailyUsage.data ? (
            <>
              <p
                data-testid="daily-usage-amount"
                className="mt-2 font-mono text-[22px] font-semibold tabular-nums text-primary"
              >
                {formatIdr(dailyUsage.data.amount_spent_idr)}
              </p>
              <p className="mt-1 flex items-center justify-between gap-2 font-mono text-[10px] text-secondary">
                <span className="tabular-nums">
                  {formatNumber(dailyUsage.data.tokens_used)} token
                </span>
                <span className="tabular-nums">{dailyUsage.data.date} WIB</span>
              </p>
            </>
          ) : dailyUsage.status === "error" ? (
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="font-mono text-[12px] text-error">
                {dailyUsage.error?.errorCodeLabel ?? "Gagal memuat"}
              </span>
              <button
                type="button"
                onClick={() => void dailyUsage.refresh()}
                className="rounded border border-hairline px-2 py-0.5 font-mono text-[10px] text-secondary hover:border-accent hover:text-primary"
              >
                Muat ulang
              </button>
            </div>
          ) : (
            <div className="mt-3 h-9 animate-pulse rounded bg-canvas" />
          )}
        </div>
      </div>

      <DataState
        state={status}
        skeletonRows={5}
        emptyLabel="Belum ada API Key aktif di akun Anda"
        emptyAction={{ label: "+ Buat API Key Pertama", onClick: () => setShowCreate(true) }}
        errorCode={error?.errorCodeLabel}
        errorMessage={error?.message}
        onRetry={() => void refresh()}
      >
        <div className="overflow-x-auto rounded-md border border-hairline bg-surface">
          <div className="flex flex-col gap-2 border-b border-hairline bg-canvas px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:w-64">
              <Search
                className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-secondary"
                aria-hidden="true"
              />
              <input
                aria-label="Filter berdasarkan nama atau prefix"
                className="w-full rounded border border-hairline bg-surface py-1.5 pl-8 pr-2 font-sans text-[13px] text-primary placeholder:text-secondary outline-none focus:border-accent"
                placeholder="Filter nama atau prefix…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="inline-flex rounded border border-hairline p-0.5">
              {STATUS_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setStatusFilter(filter.value)}
                  className={`rounded px-2.5 py-1 font-mono text-[11px] font-medium transition-colors ${
                    statusFilter === filter.value
                      ? "bg-surface text-primary"
                      : "text-secondary hover:text-primary"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-canvas">
                <th className="border-b border-hairline px-3 py-2 text-left font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-secondary">Nama Key</th>
                <th className="border-b border-hairline px-3 py-2 text-left font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-secondary">Prefix Key</th>
                <th className="border-b border-hairline px-3 py-2 text-left font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-secondary">Pemakaian / Batas</th>
                <th className="border-b border-hairline px-3 py-2 text-left font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-secondary">Terakhir Digunakan</th>
                <th className="border-b border-hairline px-3 py-2 text-left font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-secondary">Status</th>
                <th className="border-b border-hairline px-3 py-2 text-right font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-secondary">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center font-mono text-[12px] text-secondary">
                    Tidak ada key yang cocok dengan filter.
                  </td>
                </tr>
              ) : (
                filtered.map((key) => {
                  const limit = key.spend_limit_idr;
                  const pct = limit !== null && limit > 0 ? Math.min(100, Math.round((key.spent_idr / limit) * 100)) : limit === 0 ? 100 : null;
                  const usageTone =
                    pct === null ? "var(--accent-main)" : pct >= 90 ? "var(--state-error)" : pct >= 75 ? "var(--state-warning)" : "var(--accent-main)";
                  const usageTextTone =
                    pct === null ? "text-accent" : pct >= 90 ? "text-error" : pct >= 75 ? "text-warning" : "text-accent";
                  return (
                    <tr key={key.id} className="border-b border-hairline last:border-b-0 hover:bg-canvas/60">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <KeyRound className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                          <span className="font-sans text-[13px] font-medium text-primary">{key.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          <code className="rounded border border-hairline bg-canvas px-1.5 py-0.5 font-mono text-[12px] text-primary">
                            {key.key_prefix}
                          </code>
                          <button
                            type="button"
                            onClick={() => void copyPrefix(key.key_prefix)}
                            className="rounded p-1 text-secondary transition-colors hover:bg-canvas hover:text-primary"
                            aria-label={`Salin prefix ${key.key_prefix}`}
                            title="Salin prefix"
                          >
                            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        {pct === null ? (
                          <span className="font-mono text-[12px] tabular-nums text-primary">
                            {formatIdr(key.spent_idr)}{" "}
                            <span className="text-secondary">/ tanpa batas</span>
                          </span>
                        ) : (
                          <div className="max-w-[220px] space-y-1">
                            <div className="flex items-center justify-between gap-2 font-mono text-[12px] tabular-nums">
                              <span className="text-primary">
                                {formatIdr(key.spent_idr)}{" "}
                                <span className="text-secondary">/ {formatIdr(limit as number)}</span>
                              </span>
                              <span className={`font-semibold ${usageTextTone}`}>{pct}%</span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded border border-hairline">
                              <div className="h-full" style={{ width: `${pct}%`, background: usageTone }} />
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-secondary whitespace-nowrap">
                        {formatDateTime(key.last_used_at)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 font-mono text-[11px] font-medium ${
                            key.is_active ? "text-success" : "text-secondary"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${key.is_active ? "bg-success" : "bg-secondary"}`}
                          />
                          {key.is_active ? "AKTIF" : "DIBEKUKAN"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setLimitTarget(key)}
                            className="rounded p-1.5 text-secondary transition-colors hover:bg-canvas hover:text-primary"
                            aria-label={`Atur batas pemakaian ${key.name}`}
                            title="Atur batas pemakaian"
                          >
                            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void toggleActive(key.id, !key.is_active)}
                            className="rounded p-1.5 text-secondary transition-colors hover:bg-canvas hover:text-primary"
                            aria-label={key.is_active ? `Jeda ${key.name}` : `Aktifkan ${key.name}`}
                            title={key.is_active ? "Jeda" : "Aktifkan"}
                          >
                            {key.is_active ? (
                              <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                            ) : (
                              <Play className="h-3.5 w-3.5" aria-hidden="true" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleRevoke(key)}
                            className="rounded p-1.5 text-secondary transition-colors hover:text-error"
                            aria-label={`Revoke ${key.name}`}
                            title="Revoke"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          <div className="flex items-center justify-between border-t border-hairline bg-canvas px-3 py-2 font-mono text-[10px] text-secondary">
            <span>
              {activeCount} aktif · {keys.length} total
            </span>
            <span>Kunci di-hash SHA-256</span>
          </div>
        </div>
      </DataState>

      {showCreate ? (
        <CreateKeyModal
          open
          onClose={() => setShowCreate(false)}
          onCreate={create}
        />
      ) : null}
      {limitTarget ? (
        <SpendLimitModal
          keyId={limitTarget.id}
          currentLimit={limitTarget.spend_limit_idr}
          onSave={setLimit}
          onClose={() => setLimitTarget(null)}
        />
      ) : null}
    </div>
  );
}