// Static model catalog: the single source of truth for /v1/models and for
// upstream routing + pricing. Prices are expressed in micro-IDR (1e-6 IDR) per
// 1,000,000 tokens so all cost math stays integer-exact.
//
// shortcut: prices are business assumptions (Prd §3) pending product sign-off,
// and route order doubles as the failover order (no per-pool upstream split yet).

export type PoolTier = "LORA" | "STABLE" | "FLEX";
export type ProviderId = "SILICONFLOW" | "DEEPSEEK" | "ZHIPU" | "VOLCENGINE";

export type ModelRoute = { provider: ProviderId; upstreamModel: string };

export type ModelSpec = {
  id: string;
  defaultPool: PoolTier;
  ownedBy: string;
  priceInMicroPer1M: number;
  priceOutMicroPer1M: number;
  routes: ModelRoute[];
};

export const POOL_TIERS: readonly PoolTier[] = ["LORA", "STABLE", "FLEX"];

export function asPoolTier(value: string): PoolTier | null {
  return (POOL_TIERS as readonly string[]).includes(value)
    ? (value as PoolTier)
    : null;
}

export const MODEL_CATALOG: readonly ModelSpec[] = [
  {
    id: "deepseek-v4-pro",
    defaultPool: "STABLE",
    ownedBy: "katalis",
    priceInMicroPer1M: 27_000_000,
    priceOutMicroPer1M: 110_000_000,
    routes: [
      { provider: "DEEPSEEK", upstreamModel: "deepseek-v4-pro" },
      { provider: "SILICONFLOW", upstreamModel: "deepseek-ai/DeepSeek-V3" },
      { provider: "VOLCENGINE", upstreamModel: "deepseek-v3-250324" },
    ],
  },
  {
    id: "deepseek-v4.1-flash",
    defaultPool: "STABLE",
    ownedBy: "katalis",
    priceInMicroPer1M: 9_000_000,
    priceOutMicroPer1M: 22_000_000,
    routes: [
      { provider: "DEEPSEEK", upstreamModel: "deepseek-v4.1-flash" },
      { provider: "SILICONFLOW", upstreamModel: "deepseek-ai/DeepSeek-V3" },
      { provider: "VOLCENGINE", upstreamModel: "deepseek-v3-250324" },
    ],
  },
  {
    id: "qwen3-max",
    defaultPool: "STABLE",
    ownedBy: "katalis",
    priceInMicroPer1M: 16_000_000,
    priceOutMicroPer1M: 64_000_000,
    routes: [
      { provider: "SILICONFLOW", upstreamModel: "Qwen/Qwen3-Max" },
      { provider: "VOLCENGINE", upstreamModel: "qwen3-max" },
    ],
  },
  {
    id: "glm-5.3-flash",
    defaultPool: "FLEX",
    ownedBy: "katalis",
    priceInMicroPer1M: 2_000_000,
    priceOutMicroPer1M: 9_000_000,
    routes: [
      { provider: "ZHIPU", upstreamModel: "glm-5.3-flash" },
      { provider: "SILICONFLOW", upstreamModel: "THUDM/GLM-5.3-Flash" },
    ],
  },
  {
    id: "glm-4.6v",
    defaultPool: "STABLE",
    ownedBy: "katalis",
    priceInMicroPer1M: 5_000_000,
    priceOutMicroPer1M: 18_000_000,
    routes: [
      { provider: "ZHIPU", upstreamModel: "glm-4.6v" },
      { provider: "SILICONFLOW", upstreamModel: "THUDM/GLM-4.6V" },
    ],
  },
  {
    id: "kimi-k2",
    defaultPool: "STABLE",
    ownedBy: "katalis",
    priceInMicroPer1M: 12_000_000,
    priceOutMicroPer1M: 48_000_000,
    routes: [
      { provider: "SILICONFLOW", upstreamModel: "moonshotai/Kimi-K2-Instruct" },
      { provider: "VOLCENGINE", upstreamModel: "kimi-k2-250905" },
    ],
  },
  {
    id: "doubao-pro",
    defaultPool: "FLEX",
    ownedBy: "katalis",
    priceInMicroPer1M: 1_000_000,
    priceOutMicroPer1M: 4_000_000,
    routes: [
      { provider: "VOLCENGINE", upstreamModel: "doubao-pro-32k" },
      { provider: "SILICONFLOW", upstreamModel: "ByteDance-Seed/Doubao-Pro" },
    ],
  },
  {
    id: "hunyuan-lora-coder",
    defaultPool: "LORA",
    ownedBy: "katalis",
    priceInMicroPer1M: 3_000_000,
    priceOutMicroPer1M: 12_000_000,
    routes: [
      { provider: "SILICONFLOW", upstreamModel: "katalis/hunyuan-lora-coder" },
      { provider: "VOLCENGINE", upstreamModel: "hunyuan-coder-lora" },
    ],
  },
];

export function findModel(id: string): ModelSpec | undefined {
  return MODEL_CATALOG.find((model) => model.id === id);
}

export function listModels(): ModelSpec[] {
  return [...MODEL_CATALOG];
}
