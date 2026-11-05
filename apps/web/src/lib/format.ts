// Client-only formatting helpers (Design.md §3.2/§3.3). All dynamic numerals
// add tabular-nums at the call site; these functions return plain strings.

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("id-ID").format(Math.round(value));
}

export function formatIdr(value: number): string {
  return `Rp ${formatNumber(value)}`;
}

export function formatLatency(ms: number): string {
  return `${Math.max(0, Math.round(ms))}ms`;
}

export function formatDateTime(value: string | Date | null): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const datePart = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
  const timePart = new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  return `${datePart} ${timePart} WIB`;
}

export function formatCountdown(msLeft: number): string {
  const total = Math.max(0, Math.ceil(msLeft / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}