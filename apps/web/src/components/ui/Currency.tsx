import { formatNumber } from "../../lib/format";

/** Split-weight Rupiah (Design.md §3.4.1): the numeric value carries the visual
 *  weight while the small "Rp" unit stays in the background. */
export function Currency({
  amount,
  tone = "primary",
  large = false,
}: {
  amount: number;
  tone?: "primary" | "success" | "accent" | "error";
  large?: boolean;
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "accent"
        ? "text-accent"
        : tone === "error"
          ? "text-error"
          : "text-primary";

  return (
    <span className="font-mono tabular-nums">
      <span className="mr-1 text-xs font-normal text-secondary">Rp</span>
      <span className={`${large ? "text-[22px] leading-7" : "text-[13px]"} font-semibold ${toneClass}`}>
        {formatNumber(amount)}
      </span>
    </span>
  );
}