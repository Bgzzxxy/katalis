import { useState } from "react";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { formatIdr } from "../../lib/format";

export type Plan = {
  id: string;
  label: string;
  priceIdr: number;
  description: string;
  badge?: "accent" | "success";
  customAmount?: boolean;
};

export const PLANS: Plan[] = [
  {
    id: "TRIAL_1D",
    label: "Trial 1 Hari",
    priceIdr: 100,
    description: "Klaim sekali per akun; akses unlimited 1 hari.",
    badge: "accent",
  },
  {
    id: "UNLIMITED_10D",
    label: "Unlimited 10 Hari",
    priceIdr: 20000,
    description: "Akses semua pool termasuk LoRA −30%.",
    badge: "success",
  },
  {
    id: "PREPAID",
    label: "Saldo Prabayar",
    priceIdr: 50000,
    description: "Isi saldo Rp 5.000 – Rp 1.000.000.",
    customAmount: true,
  },
];

export function PlanSelector({
  pending,
  onCheckout,
}: {
  pending: boolean;
  onCheckout: (planType: string, customAmountIdr?: number) => void;
}) {
  const [selected, setSelected] = useState<string>("UNLIMITED_10D");
  const [customAmount, setCustomAmount] = useState(50000);

  return (
    <div className="space-y-3">
      {PLANS.map((plan) => (
        <label
          key={plan.id}
          className={`flex cursor-pointer items-center justify-between rounded-md border p-3 ${
            selected === plan.id ? "border-accent" : "border-hairline"
          } bg-surface`}
        >
          <span className="flex items-center gap-2">
            <input
              type="radio"
              name="plan"
              checked={selected === plan.id}
              onChange={() => setSelected(plan.id)}
              className="accent-[#B77A45]"
            />
            <span>
              <span className="flex items-center gap-2">
                <span className="font-sans text-[13px] font-medium text-primary">{plan.label}</span>
                {plan.badge ? (
                  <Badge tone={plan.badge}>{plan.badge === "accent" ? "TRIAL" : "BEST VALUE"}</Badge>
                ) : null}
              </span>
              <span className="block text-[11px] text-secondary">{plan.description}</span>
            </span>
          </span>
          <span className="font-mono text-[13px] font-semibold tabular-nums text-primary">
            {formatIdr(plan.priceIdr)}
          </span>
        </label>
      ))}

      {selected === "PREPAID" ? (
        <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-secondary">
          Nominal isi ulang (Rp)
          <input
            type="number"
            min={5000}
            max={1000000}
            className="rounded border border-hairline bg-surface px-2 py-1.5 font-mono text-[13px] tabular-nums text-primary outline-none focus:border-accent"
            value={customAmount}
            onChange={(e) => setCustomAmount(Math.max(0, Number(e.target.value) || 0))}
          />
        </label>
      ) : null}

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
    </div>
  );
}