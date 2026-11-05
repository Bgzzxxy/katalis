// QA (independent): the web catalog is a DUPLICATE of
// apps/api/src/services/model-catalog.ts. This test pins every field the UI
// renders (id, display name, vendor, pool, both prices, capabilities) against
// the backend source, so a price or label can never drift silently.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MODEL_CATALOG } from "../../src/lib/model-catalog";
import { estimateCostIdr, UNLIMITED_LORA_DISCOUNT } from "../../src/lib/pricing";

const API_DIR = join(import.meta.dir, "..", "..", "..", "api", "src", "services");
const API_CATALOG = join(API_DIR, "model-catalog.ts");

type ApiRow = {
  id: string;
  name: string;
  provider: string;
  pool: string;
  inMicro: number;
  outMicro: number;
};

function parseApiCatalog(): ApiRow[] {
  const text = readFileSync(API_CATALOG, "utf8");
  const re = new RegExp(
    [
      /id:\s*"([^"]+)"/.source,
      /name:\s*"([^"]+)"/.source,
      /provider:\s*"([^"]+)"/.source,
      /defaultPool:\s*"([^"]+)"/.source,
      /priceInMicroPer1M:\s*([\d_]+)/.source,
      /priceOutMicroPer1M:\s*([\d_]+)/.source,
    ].join("[\\s\\S]*?"),
    "g",
  );
  const rows: ApiRow[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    rows.push({
      id: m[1],
      name: m[2],
      provider: m[3],
      pool: m[4],
      inMicro: Number(m[5].replace(/_/g, "")),
      outMicro: Number(m[6].replace(/_/g, "")),
    });
  }
  return rows;
}

type ApiCapabilityRow = { id: string; capabilities: string[] };

/** Reads the CAPABILITIES map literally: `"<id>": ["A", "B"],` */
function parseApiCapabilities(): ApiCapabilityRow[] {
  const text = readFileSync(API_CATALOG, "utf8");
  const block = /const CAPABILITIES[^=]*=\s*\{([\s\S]*?)\n\};/.exec(text)?.[1] ?? "";
  const rows: ApiCapabilityRow[] = [];
  const re = /"([^"]+)":\s*\[([^\]]*)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    rows.push({
      id: m[1],
      capabilities: [...m[2].matchAll(/"([^"]+)"/g)].map((c) => c[1]),
    });
  }
  return rows;
}

describe("QA pricing parity with the API catalog", () => {
  const api = parseApiCatalog();
  const apiCaps = parseApiCapabilities();

  test("sanity: parsed a catalog from both sides", () => {
    expect(api.length).toBeGreaterThan(0);
    expect(apiCaps.length).toBe(api.length);
    expect(MODEL_CATALOG.length).toBe(api.length);
  });

  test("every web model matches the API id, name, vendor and pool", () => {
    const mismatches: string[] = [];
    for (const web of MODEL_CATALOG) {
      const ref = api.find((r) => r.id === web.id);
      if (!ref) {
        mismatches.push(`${web.id}: missing on API side`);
        continue;
      }
      if (web.name !== ref.name) mismatches.push(`${web.id}: name ${web.name} != ${ref.name}`);
      if (web.provider !== ref.provider) {
        mismatches.push(`${web.id}: provider ${web.provider} != ${ref.provider}`);
      }
      if (web.pool !== ref.pool) mismatches.push(`${web.id}: pool ${web.pool} != ${ref.pool}`);
    }
    expect(mismatches).toEqual([]);
  });

  test("every web model has identical IDR/1M prices", () => {
    const mismatches: string[] = [];
    for (const web of MODEL_CATALOG) {
      const ref = api.find((r) => r.id === web.id);
      if (!ref) continue;
      if (web.priceInIdrPer1M !== ref.inMicro / 1_000_000) {
        mismatches.push(`${web.id}: in ${web.priceInIdrPer1M} != ${ref.inMicro / 1_000_000}`);
      }
      if (web.priceOutIdrPer1M !== ref.outMicro / 1_000_000) {
        mismatches.push(`${web.id}: out ${web.priceOutIdrPer1M} != ${ref.outMicro / 1_000_000}`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  test("capability badges match the backend annotations exactly", () => {
    const mismatches: string[] = [];
    for (const web of MODEL_CATALOG) {
      const ref = apiCaps.find((r) => r.id === web.id);
      const got = web.capabilities.join(",");
      const want = (ref?.capabilities ?? []).join(",");
      if (got !== want) mismatches.push(`${web.id}: [${got}] != [${want}]`);
    }
    expect(mismatches).toEqual([]);
  });

  test("-30% is the same 70/100 factor the backend meter applies to LoRA", () => {
    // backend: costMicro = Math.round(costMicro * 70 / 100) for LORA + unlimited
    const model = { priceInIdrPer1M: 3, priceOutIdrPer1M: 12, pool: "LORA" };
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
