// Client-side price simulation. Canonical prices live in the API catalog
// (apps/api/src/services/model-catalog.ts); the web copy below mirrors them.
// shortcut: catalog duplication is a known drift risk — upgrade to a public
// /v1/models pricing endpoint when the backend exposes prices.
import { MODEL_CATALOG } from "./model-catalog";

export const UNLIMITED_LORA_DISCOUNT = 0.3;

export type PricingModel = {
  priceInIdrPer1M: number;
  priceOutIdrPer1M: number;
};

export function estimateCostIdr(
  model: PricingModel,
  inputTokens: number,
  outputTokens: number,
  unlimitedDiscount: boolean,
): number {
  const raw =
    (inputTokens / 1_000_000) * model.priceInIdrPer1M +
    (outputTokens / 1_000_000) * model.priceOutIdrPer1M;
  return unlimitedDiscount ? raw * (1 - UNLIMITED_LORA_DISCOUNT) : raw;
}

export { MODEL_CATALOG };