// Static model catalog: the single source of truth for /v1/models and for
// upstream routing + pricing. Prices are expressed in micro-IDR (1e-6 IDR) per
// 1,000,000 tokens so all cost math stays integer-exact.
//
// `name` and `provider` are presentation labels for the web UI; the web client
// reads the live catalog from GET /api/models, so this file is the one place to
// edit when a model or price changes.
//
// shortcut: prices are business assumptions (Prd §3) pending product sign-off,
// and route order doubles as the failover order (no per-pool upstream split yet).

export type PoolTier = "LORA" | "STABLE" | "FLEX";
export type ProviderId = "SILICONFLOW" | "DEEPSEEK" | "ZHIPU" | "VOLCENGINE";

export type ModelRoute = { provider: ProviderId; upstreamModel: string };

export type ModelSpec = {
  id: string;
  /** Display name, e.g. "DeepSeek V4 Pro". */
  name: string;
  /** Model vendor, e.g. "DeepSeek" (not the gateway's upstream provider). */
  provider: string;
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
    name: "DeepSeek V4 Pro",
    provider: "DeepSeek",
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
    name: "DeepSeek V4.1 Flash",
    provider: "DeepSeek",
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
    name: "Qwen3 Max",
    provider: "Alibaba",
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
    name: "GLM 5.3 Flash",
    provider: "Zhipu",
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
    name: "GLM 4.6V",
    provider: "Zhipu",
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
    name: "Kimi K2",
    provider: "Moonshot",
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
    name: "Doubao Pro",
    provider: "ByteDance",
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
    name: "Hunyuan LoRA Coder",
    provider: "Tencent",
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

/** Client-facing capability annotations. Only documented ones are listed, so
 *  the UI never renders a filter chip the gateway cannot honour. */
export type Capability = "Reasoning" | "Vision" | "Tools";

const CAPABILITIES: Record<string, Capability[]> = {
  "deepseek-v4-pro": ["Reasoning", "Tools"],
  "deepseek-v4.1-flash": ["Reasoning", "Tools"],
  "qwen3-max": ["Reasoning", "Tools"],
  "glm-5.3-flash": [],
  "glm-4.6v": ["Vision"],
  "kimi-k2": ["Tools"],
  "doubao-pro": [],
  "hunyuan-lora-coder": ["Tools"],
};

export function capabilitiesOf(id: string): Capability[] {
  return CAPABILITIES[id] ?? [];
}

export function findModel(id: string): ModelSpec | undefined {
  return MODEL_CATALOG.find((model) => model.id === id);
}

export function listModels(): ModelSpec[] {
  return [...MODEL_CATALOG];
}
