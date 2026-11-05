import type { Capability, PoolTier } from "../../lib/model-catalog";
import { Search } from "lucide-react";

export type ModelFilterValue = {
  pool: PoolTier | "ALL";
  capability: Capability | null;
  query: string;
};

const POOL_CHIPS: { value: PoolTier | "ALL"; label: string }[] = [
  { value: "ALL", label: "Semua" },
  { value: "LORA", label: "Dedicated LoRA" },
  { value: "STABLE", label: "Stable" },
  { value: "FLEX", label: "Flex" },
];

const CAPABILITY_CHIPS: Capability[] = ["Reasoning", "Vision", "Tools"];

export function ModelFilters({
  value,
  onChange,
}: {
  value: ModelFilterValue;
  onChange: (next: ModelFilterValue) => void;
}) {
  function setPool(pool: PoolTier | "ALL") {
    onChange({ ...value, pool });
  }
  function toggleCapability(cap: Capability) {
    onChange({ ...value, capability: value.capability === cap ? null : cap });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-secondary" aria-hidden="true" />
        <input
          aria-label="Cari model"
          className="rounded border border-hairline bg-surface py-1.5 pl-7 pr-2 font-sans text-[13px] text-primary outline-none focus:border-accent"
          placeholder="Cari model..."
          value={value.query}
          onChange={(e) => onChange({ ...value, query: e.target.value })}
        />
      </div>
      <div className="flex items-center gap-1">
        {POOL_CHIPS.map((chip) => (
          <button
            key={chip.value}
            type="button"
            onClick={() => setPool(chip.value)}
            className={`rounded px-2 py-1 font-sans text-xs ${
              value.pool === chip.value
                ? "bg-primary font-medium text-surface"
                : "border border-hairline text-secondary hover:border-accent hover:text-primary"
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1">
        {CAPABILITY_CHIPS.map((cap) => (
          <button
            key={cap}
            type="button"
            onClick={() => toggleCapability(cap)}
            className={`rounded px-2 py-1 font-sans text-xs ${
              value.capability === cap
                ? "bg-accent font-medium text-surface"
                : "border border-hairline text-secondary hover:border-accent hover:text-primary"
            }`}
          >
            {cap}
          </button>
        ))}
      </div>
    </div>
  );
}