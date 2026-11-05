import { Badge } from "../ui/Badge";
import { POOL_LABELS, type ModelSpec } from "../../lib/model-catalog";
import { formatIdr } from "../../lib/format";
import { useToast } from "../../hooks/useToast";
import { copyText } from "../../lib/format";

export function ModelsTable({
  models,
  unlimitedDiscount,
}: {
  models: ModelSpec[];
  unlimitedDiscount: boolean;
}) {
  const { push } = useToast();

  async function copyModelId(id: string) {
    if (await copyText(id)) push(`ID model ${id} disalin`);
    else push("Gagal menyalin ID model", "error");
  }

  return (
    <div className="overflow-x-auto rounded-md border border-hairline bg-surface">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="bg-canvas">
            <th className="border-b border-hairline px-3 py-2 text-left font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-secondary">
              ID Model
            </th>
            <th className="border-b border-hairline px-3 py-2 text-left font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-secondary">
              Pool
            </th>
            <th className="border-b border-hairline px-3 py-2 text-right font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-secondary">
              Input / 1M
            </th>
            <th className="border-b border-hairline px-3 py-2 text-right font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-secondary">
              Output / 1M
            </th>
            <th className="border-b border-hairline px-3 py-2 text-right font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-secondary">
              Kapabilitas
            </th>
          </tr>
        </thead>
        <tbody>
          {models.map((model) => {
            const inPrice = formatIdr(model.priceInIdrPer1M);
            const outPrice = formatIdr(model.priceOutIdrPer1M);
            return (
              <tr key={model.id} className="border-b border-hairline last:border-b-0 hover:bg-[#F0EEE8]/60">
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => void copyModelId(model.id)}
                    title="Salin ID model"
                    className="rounded border border-hairline bg-canvas px-2 py-0.5 font-mono text-[12px] text-primary hover:border-accent"
                  >
                    {model.id}
                  </button>
                </td>
                <td className="px-3 py-2">
                  <Badge tone={model.pool === "LORA" ? "accent" : model.pool === "STABLE" ? "success" : "secondary"}>
                    {POOL_LABELS[model.pool]}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-primary">
                  {unlimitedDiscount ? (
                    <span className="text-accent"><s className="text-secondary">{inPrice}</s> {formatIdr(model.priceInIdrPer1M * 0.7)}</span>
                  ) : (
                    inPrice
                  )}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-primary">
                  {unlimitedDiscount ? (
                    <span className="text-accent"><s className="text-secondary">{outPrice}</s> {formatIdr(model.priceOutIdrPer1M * 0.7)}</span>
                  ) : (
                    outPrice
                  )}
                </td>
                <td className="px-3 py-2 text-right font-mono text-[11px] text-secondary">
                  {model.capabilities.length ? model.capabilities.join(" · ") : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}