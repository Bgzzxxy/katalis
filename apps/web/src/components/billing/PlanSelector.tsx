import { useState } from "react";
import { Button } from "../ui/Button";
import { formatIdr } from "../../lib/format";

export type Plan = {
  id: string;
  label: string;
  priceIdr: number;
  description: string;
  badge?: "accent" | "success" | "secondary";
  customAmount?: boolean;
};

export const PLANS: Plan[] = [
  {
    id: "UNLIMITED_10D",
    label: "Unlimited 10 Hari",
    priceIdr: 20000,
    description: "Akses semua pool model termasuk LoRA −30%.",
    badge: "success",
  },
  {
    id: "PREPAID",
    label: "Saldo Prabayar",
    priceIdr: 50000,
    description: "Isi saldo fleksibel Rp 5.000 – Rp 1.000.000.",
    customAmount: true,
  },
  {
    id: "TRIAL_1D",
    label: "Trial 1 Hari",
    priceIdr: 100,
    description: "Klaim sekali per akun; akses unlimited 1 hari.",
    badge: "accent",
  },
];

export const PREPAID_QUICK_AMOUNTS = [
  { amount: 10_000, tier: "Micro" },
  { amount: 25_000, tier: "Starter" },
  { amount: 50_000, tier: "Growth" },
  { amount: 100_000, tier: "Scale" },
  { amount: 250_000, tier: "Enterprise" },
];


const BADGE_LABEL: Record<NonNullable<Plan["badge"]>, string> = {
  accent: "TRIAL",
  success: "POPULER",
  secondary: "STANDAR",
};

export type PlanSelectorProps = {
  selected?: string;
  onSelect?: (planId: string) => void;
  customAmount?: number;
  onCustomAmountChange?: (amount: number) => void;
  pending?: boolean;
  onCheckout?: (planType: string, customAmountIdr?: number) => void;
};

export function PlanSelector({
  selected: controlledSelected,
  onSelect: controlledOnSelect,
  customAmount: controlledCustomAmount,
  onCustomAmountChange: controlledOnCustomAmountChange,
  pending = false,
  onCheckout,
}: PlanSelectorProps) {
  const [internalSelected, setInternalSelected] = useState<string>("UNLIMITED_10D");
  const [internalCustomAmount, setInternalCustomAmount] = useState<number>(50000);

  const selected = controlledSelected ?? internalSelected;
  const customAmount = controlledCustomAmount ?? internalCustomAmount;

  const handleSelect = (id: string) => {
    setInternalSelected(id);
    controlledOnSelect?.(id);
  };

  const handleCustomAmountChange = (amt: number) => {
    setInternalCustomAmount(amt);
    controlledOnCustomAmountChange?.(amt);
  };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {PLANS.map((plan) => {
          const isSelected = selected === plan.id;
          const displayPrice = plan.id === "PREPAID" ? customAmount : plan.priceIdr;
          return (
            <label
              key={plan.id}
              className={`flex flex-col justify-between rounded-md border p-3.5 text-left transition-all cursor-pointer ${
                isSelected
                  ? "border-accent bg-surface ring-1 ring-accent"
                  : "border-hairline bg-surface hover:border-strong"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-1">
                  <span className="font-serif text-[15px] font-medium text-primary">
                    {plan.label}
                  </span>
                  {plan.badge ? (
                    <BadgeSimplified tone={plan.badge}>
                      {BADGE_LABEL[plan.badge]}
                    </BadgeSimplified>
                  ) : null}
                </div>
                <div className="mt-2 font-mono text-base font-semibold tabular-nums text-primary">
                  {formatIdr(displayPrice)}
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-secondary">
                  {plan.description}
                </p>
              </div>

              <div className="mt-3 flex items-center justify-between pt-2.5 border-t border-hairline font-mono text-[10px] text-secondary">
                <span className="flex items-center gap-1.5">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      isSelected ? "bg-accent" : "border border-hairline bg-canvas"
                    }`}
                  />
                  <span>{isSelected ? "Terpilih" : "Pilih"}</span>
                </span>
                <input
                  type="radio"
                  name="plan-selection"
                  aria-label={plan.label}
                  checked={isSelected}
                  onChange={() => handleSelect(plan.id)}
                  className="accent-[var(--accent-main)]"
                />
              </div>
            </label>
          );
        })}
      </div>

      {selected === "PREPAID" ? (
        <div className="rounded-md border border-hairline bg-canvas p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.05em] text-secondary">
              Nominal Top-Up Prabayar
            </span>
            <span className="font-mono text-[10px] text-secondary">
              Min: Rp 5.000 · Max: Rp 1.000.000
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {PREPAID_QUICK_AMOUNTS.map(({ amount, tier }) => (
              <button
                key={amount}
                type="button"
                onClick={() => handleCustomAmountChange(amount)}
                className={`flex flex-col justify-between rounded border p-2 text-left transition-colors cursor-pointer ${
                  customAmount === amount
                    ? "border-accent bg-[var(--accent-bg-subtle)] text-accent font-semibold"
                    : "border-hairline bg-surface text-secondary hover:border-strong hover:text-primary"
                }`}
              >
                <span className="font-mono text-[9px] uppercase tracking-wider">{tier}</span>
                <span className="font-mono text-xs font-semibold tabular-nums mt-1">
                  {formatIdr(amount)}
                </span>
              </button>
            ))}
          </div>

          <div>
            <label
              htmlFor="custom-nominal-input"
              className="block font-mono text-[11px] font-semibold uppercase tracking-[0.05em] text-secondary mb-1"
            >
              Nominal Kustom (Rp)
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 font-mono text-xs text-secondary">
                Rp
              </span>
              <input
                id="custom-nominal-input"
                type="number"
                min={5000}
                max={1000000}
                step={5000}
                className="w-full rounded border border-hairline bg-surface py-1.5 pl-9 pr-3 font-mono text-xs tabular-nums text-primary outline-none focus:border-accent"
                placeholder="50000"
                value={customAmount}
                onChange={(e) =>
                  handleCustomAmountChange(Math.max(0, Number(e.target.value) || 0))
                }
              />
            </div>
          </div>
        </div>
      ) : null}

      {onCheckout && !controlledSelected ? (
        <Button
          variant="primary"
          onClick={() =>
            onCheckout(
              selected,
              selected === "PREPAID"
                ? Math.max(5000, Math.min(1_000_000, customAmount))
                : undefined,
            )
          }
          disabled={pending}
        >
          {pending ? "Membuat tagihan..." : "Buat Tagihan QRIS"}
        </Button>
      ) : null}
    </div>
  );
}

// Small local copy avoids exporting an internal layout detail from ui/Badge.
function BadgeSimplified({
  tone,
  children,
}: {
  tone: "accent" | "success" | "secondary";
  children: string;
}) {
  return (
    <span
      className="rounded border px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase"
      style={{
        color:
          tone === "accent"
            ? "var(--accent-main)"
            : tone === "success"
              ? "var(--state-success)"
              : "var(--text-secondary)",
        borderColor:
          tone === "accent"
            ? "var(--accent-border-subtle)"
            : tone === "success"
              ? "var(--success-border-subtle)"
              : "var(--border-hairline)",
        background:
          tone === "accent"
            ? "var(--accent-bg-subtle)"
            : tone === "success"
              ? "var(--success-bg-subtle)"
              : "var(--bg-canvas)",
      }}
    >
      {children}
    </span>
  );
}