import { describe, expect, test } from "bun:test";
import { estimateCostIdr, UNLIMITED_LORA_DISCOUNT } from "../src/lib/pricing";

const loraModel = { priceInIdrPer1M: 9, priceOutIdrPer1M: 22, pool: "LORA" };
const stableModel = { priceInIdrPer1M: 9, priceOutIdrPer1M: 22, pool: "STABLE" };

describe("TokenCalculator cost model", () => {
  test("computes cost from input/output tokens", () => {
    // 1M in + 1M out = 9 + 22 = 31 IDR
    expect(estimateCostIdr(loraModel, 1_000_000, 1_000_000, false)).toBeCloseTo(31, 5);
    // 500k in + 250k out = 4.5 + 5.5 = 10 IDR
    expect(estimateCostIdr(loraModel, 500_000, 250_000, false)).toBeCloseTo(10, 5);
  });

  test("applies exactly -30% on a LoRA model with the Unlimited toggle", () => {
    const full = estimateCostIdr(loraModel, 1_000_000, 1_000_000, false);
    const discounted = estimateCostIdr(loraModel, 1_000_000, 1_000_000, true);
    expect(UNLIMITED_LORA_DISCOUNT).toBe(0.3);
    expect(discounted).toBeCloseTo(full * 0.7, 5);
  });

  test("never discounts a non-LoRA pool, even with Unlimited on", () => {
    // The backend bills the -30% only for pool === "LORA".
    const full = estimateCostIdr(stableModel, 1_000_000, 1_000_000, false);
    expect(estimateCostIdr(stableModel, 1_000_000, 1_000_000, true)).toBeCloseTo(full, 9);
  });

  test("zero tokens cost nothing", () => {
    expect(estimateCostIdr(loraModel, 0, 0, false)).toBe(0);
  });
});
