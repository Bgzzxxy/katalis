import { describe, expect, test } from "bun:test";
import { estimateCostIdr, UNLIMITED_LORA_DISCOUNT } from "../src/lib/pricing";

const model = { priceInIdrPer1M: 9, priceOutIdrPer1M: 22 };

describe("TokenCalculator cost model", () => {
  test("computes cost from input/output tokens", () => {
    // 1M in + 1M out = 9 + 22 = 31 IDR
    expect(estimateCostIdr(model, 1_000_000, 1_000_000, false)).toBeCloseTo(31, 5);
    // 500k in + 250k out = 4.5 + 5.5 = 10 IDR
    expect(estimateCostIdr(model, 500_000, 250_000, false)).toBeCloseTo(10, 5);
  });

  test("applies exactly -30% with the Unlimited toggle", () => {
    const full = estimateCostIdr(model, 1_000_000, 1_000_000, false);
    const discounted = estimateCostIdr(model, 1_000_000, 1_000_000, true);
    expect(UNLIMITED_LORA_DISCOUNT).toBe(0.3);
    expect(discounted).toBeCloseTo(full * 0.7, 5);
  });

  test("zero tokens cost nothing", () => {
    expect(estimateCostIdr(model, 0, 0, false)).toBe(0);
  });
});