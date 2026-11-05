import type { Capability, PoolTier } from "../../lib/model-catalog";

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
      <input
        aria-label="Cari model"
        className="rounded border border-hairline bg-surface px-2 py-1.5 font-sans text-[13px] text-primary outline-none focus:border-accent"
        placeholder="Cari model..."
        value={value.query}
        onChange={(e) => onChange({ ...value, query: e.target.value })}
      />
      <div className="flex items-center gap-1">
        {POOL_CHIPS.map((chip) => (
          <button
            key={chip.value}
            type="button"
            onClick={() => setPool(chip.value)}
            className={`rounded px-2 py-1 font-mono text-[11px] ${
              value.pool === chip.value
                ? "bg-primary text-surface"
                : "border border-hairline text-secondary hover:border-accent"
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
            className={`rounded px-2 py-1 font-mono text-[11px] ${
              value.capability === cap
                ? "bg-accent text-surface"
                : "border border-hairline text-secondary hover:border-accent"
            }`}
          >
            {cap}
          </button>
        ))}
      </div>
    </div>
  );
}