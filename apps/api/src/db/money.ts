export function toIdr(value: string | number): number {
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** IDR string/number -> integer micro-IDR (1e-6 IDR). Invalid input -> 0. */
export function toMicroIdr(value: string | number): number {
  return Math.round(toIdr(value) * 1_000_000);
}

/** Integer micro-IDR -> 6-decimal IDR string for `usage_logs.cost_charged_idr`. */
export function microToIdrString(micro: number): string {
  const rounded = Math.round(Number.isFinite(micro) ? micro : 0);
  return (rounded / 1_000_000).toFixed(6);
}

/** Integer micro-IDR -> 4-decimal IDR number (wallet/spent rounding). */
export function round4Idr(micro: number): number {
  const idr = (Number.isFinite(micro) ? micro : 0) / 1_000_000;
  return Math.round(idr * 10_000) / 10_000;
}