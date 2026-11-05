// Client-side price simulation. Canonical prices live in the API catalog
// (apps/api/src/services/model-catalog.ts); the web mirror in ./model-catalog.ts
// is pinned to it by tests/qa/pricing-parity.qa.test.ts.
export type PricingModel = {
  priceInIdrPer1M: number;
  priceOutIdrPer1M: number;
  pool: string;
};

/** Dedicated LoRA pool is 30% cheaper on an active Unlimited plan. */
export const UNLIMITED_LORA_DISCOUNT = 0.3;

/**
 * The discount is tied to the model's own pool (the API bills it that way: LoRA
 * + active Unlimited), so a Stable/Flex model must NOT show a −30% price even
 * when the simulation toggle is on.
 */
export function unlimitedDiscountApplies(
  model: PricingModel,
  unlimitedActive: boolean,
): boolean {
  return unlimitedActive && model.pool === "LORA";
}

export function estimateCostIdr(
  model: PricingModel,
  inputTokens: number,
  outputTokens: number,
  unlimitedDiscount: boolean,
): number {
  const raw =
    (inputTokens / 1_000_000) * model.priceInIdrPer1M +
    (outputTokens / 1_000_000) * model.priceOutIdrPer1M;
  return unlimitedDiscountApplies(model, unlimitedDiscount)
    ? raw * (1 - UNLIMITED_LORA_DISCOUNT)
    : raw;
}
