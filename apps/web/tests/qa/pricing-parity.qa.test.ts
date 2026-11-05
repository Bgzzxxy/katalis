// QA (independent): the price-calculator contract vs the backend.
// The web catalog is a duplicate of apps/api/src/services/model-catalog.ts, so
// QA pins BOTH (a) the per-model price parity and (b) that the -30% discount is
// the same 70/100 factor used by the backend token meter for the LoRA pool.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MODEL_CATALOG } from "../../src/lib/model-catalog";
import { estimateCostIdr, UNLIMITED_LORA_DISCOUNT } from "../../src/lib/pricing";

const API_CATALOG = join(
  import.meta.dir,
  "..",
  "..",
  "..",
  "api",
  "src",
  "services",
  "model-catalog.ts",
);

type ApiRow = { id: string; inMicro: number; outMicro: number };

function parseApiCatalog(): ApiRow[] {
  const text = readFileSync(API_CATALOG, "utf8");
  const rows: ApiRow[] = [];
  const re = /id:\s*"([^"]+)"[\s\S]*?priceInMicroPer1M:\s*([\d_]+)[\s\S]*?priceOutMicroPer1M:\s*([\d_]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    rows.push({
      id: m[1],
      inMicro: Number(m[2].replace(/_/g, "")),
      outMicro: Number(m[3].replace(/_/g, "")),
    });
  }
  return rows;
}

describe("QA pricing parity with the API catalog", () => {
  const api = parseApiCatalog();

  test("sanity: parsed a catalog from both sides", () => {
    expect(api.length).toBeGreaterThan(0);
    expect(MODEL_CATALOG.length).toBe(api.length);
  });

  test("every web model exists in the API catalog with identical IDR/1M prices", () => {
    const mismatches: string[] = [];
    for (const web of MODEL_CATALOG) {
      const ref = api.find((r) => r.id === web.id);
      if (!ref) {
        mismatches.push(`${web.id}: missing on API side`);
        continue;
      }
      if (web.priceInIdrPer1M !== ref.inMicro / 1_000_000) {
        mismatches.push(`${web.id}: in ${web.priceInIdrPer1M} != ${ref.inMicro / 1_000_000}`);
      }
      if (web.priceOutIdrPer1M !== ref.outMicro / 1_000_000) {
        mismatches.push(`${web.id}: out ${web.priceOutIdrPer1M} != ${ref.outMicro / 1_000_000}`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  test("-30% is the same 70/100 factor the backend meter applies to LoRA", () => {
    // backend: costMicro = Math.round(costMicro * 70 / 100) for LORA + unlimited
    const model = { priceInIdrPer1M: 3, priceOutIdrPer1M: 12 };
    const nominal = estimateCostIdr(model, 1_000_000, 1_000_000, false); // 15
    const backendDiscounted = Math.round((nominal * 1_000_000 * 70) / 100) / 1_000_000;
    const webDiscounted = estimateCostIdr(model, 1_000_000, 1_000_000, true);
    expect(webDiscounted).toBeCloseTo(backendDiscounted, 9);
    expect(UNLIMITED_LORA_DISCOUNT).toBe(0.3);
  });

  test("extreme / adversarial inputs stay finite and non-negative", () => {
    const model = MODEL_CATALOG[0];
    for (const [a, b] of [
      [0, 0],
      [1e9, 1e9],
      [0, 1e9],
    ] as const) {
      const cost = estimateCostIdr(model, a, b, true);
      expect(Number.isFinite(cost)).toBe(true);
      expect(cost).toBeGreaterThanOrEqual(0);
    }
    // Integer overflow must not produce NaN.
    expect(Number.isFinite(estimateCostIdr(model, Number.MAX_SAFE_INTEGER, 0, false))).toBe(true);
  });
});
