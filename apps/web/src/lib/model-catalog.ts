// Static marketing mirror of the API model catalog. Prices are IDR per 1M
// tokens (micro-per-1M / 1e6). Capabilities and vendor labels are pinned to the
// backend (apps/api/src/services/model-catalog.ts) by
// tests/qa/pricing-parity.qa.test.ts, so edit BOTH files when a model changes.
//
// MODEL_CATALOG is exported ONLY for LandingPage (the public marketing page must
// still render offline, without an API session). The member-facing Models
// dashboard reads the live catalog from GET /api/models via hooks/useModels.ts.
//
// shortcut: the catalog is duplicated, update both when prices change.

export type PoolTier = "LORA" | "STABLE" | "FLEX";
export type Capability = "Reasoning" | "Vision" | "Tools";

export type ModelSpec = {
  id: string;
  name: string;
  provider: string;
  pool: PoolTier;
  priceInIdrPer1M: number;
  priceOutIdrPer1M: number;
  capabilities: Capability[];
};

export const MODEL_CATALOG: readonly ModelSpec[] = [
  {
    id: "deepseek-v4-pro",
    name: "DeepSeek V4 Pro",
    provider: "DeepSeek",
    pool: "STABLE",
    priceInIdrPer1M: 17.951,
    priceOutIdrPer1M: 53.853,
    capabilities: ["Reasoning", "Tools"],
  },
  {
    id: "deepseek-v4.1-flash",
    name: "DeepSeek V4.1 Flash",
    provider: "DeepSeek",
    pool: "STABLE",
    priceInIdrPer1M: 4.08,
    priceOutIdrPer1M: 16.319,
    capabilities: ["Reasoning", "Tools"],
  },
  {
    id: "qwen3-max",
    name: "Qwen3 Max",
    provider: "Alibaba",
    pool: "STABLE",
    priceInIdrPer1M: 16,
    priceOutIdrPer1M: 64,
    capabilities: ["Reasoning", "Tools"],
  },
  {
    id: "glm-5.3-flash",
    name: "GLM 5.3 Flash",
    provider: "Zhipu",
    pool: "FLEX",
    priceInIdrPer1M: 2.17,
    priceOutIdrPer1M: 7.594,
    capabilities: [],
  },
  {
    id: "glm-4.6v",
    name: "GLM 4.6V",
    provider: "Zhipu",
    pool: "STABLE",
    priceInIdrPer1M: 2.712,
    priceOutIdrPer1M: 8.137,
    capabilities: ["Vision"],
  },
  {
    id: "kimi-k2",
    name: "Kimi K2",
    provider: "Moonshot",
    pool: "STABLE",
    priceInIdrPer1M: 10.517,
    priceOutIdrPer1M: 41.523,
    capabilities: ["Tools"],
  },
  {
    id: "doubao-pro",
    name: "Doubao Pro",
    provider: "ByteDance",
    pool: "FLEX",
    priceInIdrPer1M: 1,
    priceOutIdrPer1M: 4,
    capabilities: [],
  },
  {
    id: "hunyuan-lora-coder",
    name: "Hunyuan LoRA Coder",
    provider: "Tencent",
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

const POOL_TIER_VALUES: readonly string[] = ["LORA", "STABLE", "FLEX"];
const CAPABILITY_VALUES: readonly string[] = ["Reasoning", "Vision", "Tools"];

/** Narrows any untrusted string (e.g. an API row) to a known pool tier. */
export function asPoolTier(value: string): PoolTier | null {
  return POOL_TIER_VALUES.includes(value) ? (value as PoolTier) : null;
}

/** Narrows any untrusted string (e.g. an API row) to a known capability. */
export function asCapability(value: string): Capability | null {
  return CAPABILITY_VALUES.includes(value) ? (value as Capability) : null;
}