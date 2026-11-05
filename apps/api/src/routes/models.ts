import { Hono } from "hono";
import { capabilitiesOf, listModels } from "../services/model-catalog";

/** Public, read-only, UI-shaped catalog. Mirrors the web ModelSpec so the
 *  dashboard never hardcodes a second copy of display names or capabilities. */
export function modelsRoutes() {
  const app = new Hono();

  app.get("/", (c) => {
    return c.json({
      object: "list",
      data: listModels().map((model) => ({
        id: model.id,
        name: model.name,
        provider: model.provider,
        pool: model.defaultPool,
        owned_by: model.ownedBy,
        price_in_idr_per_1m: model.priceInMicroPer1M / 1_000_000,
        price_out_idr_per_1m: model.priceOutMicroPer1M / 1_000_000,
        capabilities: capabilitiesOf(model.id),
      })),
    });
  });

  return app;
}