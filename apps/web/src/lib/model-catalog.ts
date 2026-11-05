// Web mirror of the API model catalog (apps/api/src/services/model-catalog.ts).
// Prices are IDR per 1M tokens (micro-per-1M / 1e6). Capabilities are client
// annotations: only documented ones are set, so no filter chip is fabricated.
// shortcut: the catalog is duplicated, update both when prices change.

export type PoolTier = "LORA" | "STABLE" | "FLEX";
export type Capability = "Reasoning" | "Vision" | "Tools";

export type ModelSpec = {
  id: string;
  pool: PoolTier;
  priceInIdrPer1M: number;
  priceOutIdrPer1M: number;
  capabilities: Capability[];
};

export const MODEL_CATALOG: readonly ModelSpec[] = [
  {
    id: "deepseek-v4-pro",
    pool: "STABLE",
    priceInIdrPer1M: 27,
    priceOutIdrPer1M: 110,
    capabilities: ["Reasoning", "Tools"],
  },
  {
    id: "deepseek-v4.1-flash",
    pool: "STABLE",
    priceInIdrPer1M: 9,
    priceOutIdrPer1M: 22,
    capabilities: ["Reasoning", "Tools"],
  },
  {
    id: "qwen3-max",
    pool: "STABLE",
    priceInIdrPer1M: 16,
    priceOutIdrPer1M: 64,
    capabilities: ["Reasoning", "Tools"],
  },
  {
    id: "glm-5.3-flash",
    pool: "FLEX",
    priceInIdrPer1M: 2,
    priceOutIdrPer1M: 9,
    capabilities: [],
  },
  {
    id: "glm-4.6v",
    pool: "STABLE",
    priceInIdrPer1M: 5,
    priceOutIdrPer1M: 18,
    capabilities: ["Vision"],
  },
  {
    id: "kimi-k2",
    pool: "STABLE",
    priceInIdrPer1M: 12,
    priceOutIdrPer1M: 48,
    capabilities: ["Tools"],
  },
  {
    id: "doubao-pro",
    pool: "FLEX",
    priceInIdrPer1M: 1,
    priceOutIdrPer1M: 4,
    capabilities: [],
  },
  {
    id: "hunyuan-lora-coder",
    pool: "LORA",
    priceInIdrPer1M: 3,
    priceOutIdrPer1M: 12,
    capabilities: ["Tools"],
  },
];

export const POOL_LABELS: Record<PoolTier, string> = {
  LORA: "Dedicated LoRA",
  STABLE: "Stable",
  FLEX: "Flex",
};