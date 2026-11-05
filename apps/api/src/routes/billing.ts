import { Hono } from "hono";
import { z } from "zod";
import type Redis from "ioredis";
import type { Db } from "../db";
import type { AppEnv } from "../env";
import type { QrisProvider } from "../services/qris-provider";
import { createInvoice, getInvoiceStatus } from "../services/qris.service";
import { getDailyUsage } from "../services/usage.service";
import { sessionAuth, type SessionVariables } from "../middleware/session-auth";
import { AppError } from "../middleware/error-handler";

const createInvoiceSchema = z.object({
  plan_type: z.string().min(1),
  custom_amount_idr: z.number().int().optional(),
  coupon_code: z.string().optional(),
});

function validationError(c: { json: (body: unknown, status: number) => Response }) {
  return c.json(
    {
      error: {
        message: "Validasi input gagal",
        type: "validation_error",
        param: null,
        code: "VALIDATION_ERROR",
      },
    },
    400,
  );
}

function badCoupon() {
  return new AppError(400, "VALIDATION_ERROR", "Kode kupon tidak dikenal", {
    type: "validation_error",
    param: "coupon_code",
  });
}

export function billingRoutes(
  db: Db,
  redis: Redis,
  env: AppEnv,
  provider: QrisProvider | null,
) {
  const app = new Hono<SessionVariables>();

  app.use("/invoices/*", sessionAuth(env.JWT_SECRET));

  app.post("/invoices", async (c) => {
    const parsed = await c.req.json().catch(() => null);
    const result = createInvoiceSchema.safeParse(parsed);
    if (!result.success) return validationError(c as never);
    // coupon_code is deferred: there is no coupon table yet.
    if (result.data.coupon_code !== undefined && result.data.coupon_code !== "") {
      throw badCoupon();
    }

    const invoice = await createInvoice(db, provider, c.get("user").id, {
      planType: result.data.plan_type,
      customAmountIdr: result.data.custom_amount_idr,
    });
    return c.json(invoice, 201);
  });

  app.get("/invoices/:id/status", async (c) => {
    const id = c.req.param("id");
    const status = await getInvoiceStatus(db, c.get("user").id, id);
    return c.json(status, 200);
  });


  app.get("/usage", sessionAuth(env.JWT_SECRET), async (c) => {
    const usage = await getDailyUsage(db, c.get("user").id);
    return c.json(usage, 200);
  });

  return app;
}