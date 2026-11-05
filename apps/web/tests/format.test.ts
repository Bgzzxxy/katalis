import { describe, expect, test } from "bun:test";
import {
  formatNumber,
  formatIdr,
  formatLatency,
  formatDateTime,
  formatCountdown,
} from "../src/lib/format";

describe("format helpers", () => {
  test("formatNumber uses id-ID grouping", () => {
    expect(formatNumber(64250)).toBe("64.250");
    expect(formatNumber(1_000_000)).toBe("1.000.000");
    expect(formatNumber(0)).toBe("0");
  });

  test("formatIdr prefixes Rp", () => {
    expect(formatIdr(64250)).toBe("Rp 64.250");
  });

  test("formatLatency prints ms", () => {
    expect(formatLatency(18)).toBe("18ms");
    expect(formatLatency(18.7)).toBe("19ms");
    expect(formatLatency(-5)).toBe("0ms");
  });

  test("formatCountdown is mm:ss tabular", () => {
    expect(formatCountdown(14 * 60 * 1000)).toBe("14:00");
    expect(formatCountdown(0)).toBe("00:00");
  });

  test("formatDateTime null-safe", () => {
    expect(formatDateTime(null)).toBe("—");
    expect(formatDateTime("bogus")).toBe("—");
  });
});