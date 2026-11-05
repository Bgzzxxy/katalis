import { useState } from "react";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { DataState } from "../components/ui/DataState";
import { Currency } from "../components/ui/Currency";
import { useAuth } from "../hooks/useAuth";
import { useKeys } from "../hooks/useKeys";
import { useToast } from "../hooks/useToast";
import { formatDateTime, formatIdr } from "../lib/format";
import type { ApiKeyView } from "../lib/types";
import { CreateKeyModal } from "../components/keys/CreateKeyModal";
import { SpendLimitModal } from "../components/keys/SpendLimitModal";

export function KeysDashboardPage() {
  const { status, keys, error, refresh, create, setLimit, toggleActive, revoke } = useKeys();
  const { user } = useAuth();
  const { push } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [limitTarget, setLimitTarget] = useState<ApiKeyView | null>(null);

  async function handleRevoke(key: ApiKeyView) {
    if (!confirm(`Revoke API key "${key.name}"? Aksi tidak dapat dibatalkan.`)) return;
    try {
      await revoke(key.id);
      push("API key dicabut", "error");
    } catch (err) {
      push(err instanceof Error ? err.message : "Gagal mencabut key", "error");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-[22px] leading-7 font-medium tracking-[-0.015em] text-primary">
          Dashboard Key
        </h1>
        <Button variant="primary" onClick={() => setShowCreate(true)}>
          + Buat API Key Baru
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-md border border-hairline bg-surface p-3">
          <p className="font-serif text-lg font-medium text-primary">Sisa Saldo</p>
          <div className="mt-1">
            <Currency amount={user?.wallet_balance_idr ?? 0} tone="success" large />
          </div>
        </div>
        <div className="rounded-md border border-hairline bg-surface p-3">
          <p className="font-serif text-lg font-medium text-primary">Status Paket Unlimited</p>
          <div className="mt-1 flex items-center justify-between">
            <span className="font-mono text-[13px] tabular-nums text-primary">
              {user?.unlimited_expires_at ? formatDateTime(user.unlimited_expires_at) : "—"}
            </span>
            <Badge tone={user?.unlimited_expires_at ? "accent" : "secondary"}>
              {user?.unlimited_expires_at ? "UNLIMITED 10 HARI" : "PAY-AS-YOU-GO"}
            </Badge>
          </div>
        </div>
        {/* shortcut: the third §5.4 card needs a backend daily-allowance field that does not exist yet; a fabricated value would violate Design.md §1, so it is omitted. */}
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
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-canvas">
                <th className="border-b border-hairline px-3 py-2 text-left font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-secondary">Nama Key</th>
                <th className="border-b border-hairline px-3 py-2 text-left font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-secondary">Prefix Key</th>
                <th className="border-b border-hairline px-3 py-2 text-right font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-secondary">Pemakaian / Batas</th>
                <th className="border-b border-hairline px-3 py-2 text-left font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-secondary">Terakhir Digunakan</th>
                <th className="border-b border-hairline px-3 py-2 text-left font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-secondary">Status</th>
                <th className="border-b border-hairline px-3 py-2 text-right font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-secondary">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id} className="border-b border-hairline last:border-b-0 hover:bg-[#F0EEE8]/60">
                  <td className="px-3 py-2 font-sans font-medium text-primary">{key.name}</td>
                  <td className="px-3 py-2 font-mono text-[12px] text-secondary">{key.key_prefix}…</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-primary">
                    {formatIdr(key.spent_idr)}
                    <span className="text-secondary"> / </span>
                    {key.spend_limit_idr === null ? (
                      <span className="text-secondary">tanpa batas</span>
                    ) : (
                      <span className="tabular-nums">{formatIdr(key.spend_limit_idr)}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-secondary">
                    {formatDateTime(key.last_used_at)}
                  </td>
                  <td className="px-3 py-2">
                    <Badge tone={key.is_active ? "success" : "secondary"}>
                      {key.is_active ? "AKTIF" : "DIBEKUKAN"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1.5">
                      <Button onClick={() => setLimitTarget(key)}>Batas</Button>
                      <Button onClick={() => void toggleActive(key.id, !key.is_active)}>
                        {key.is_active ? "Jeda" : "Lanjut"}
                      </Button>
                      <Button variant="danger" onClick={() => void handleRevoke(key)}>
                        Revoke
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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