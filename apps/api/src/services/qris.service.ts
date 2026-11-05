import { randomInt } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type Redis from "ioredis";
import type { Db } from "../db";
import { paymentInvoices, users } from "../db/schema";
import { toIdr } from "../db/money";
import { WALLET_SEED_PREFIX } from "../db/redis";
import { AppError } from "../middleware/error-handler";
import type { QrisProvider } from "./qris-provider";

export type PlanType = "PREPAID" | "UNLIMITED_10D" | "TRIAL_1D";

export type InvoiceView = {
  id: string;
  plan_type: PlanType;
  base_amount_idr: number;
  bonus_amount_idr: number;
  total_pay_idr: number;
  qris_string: string;
  status: string;
  expires_at: Date;
};

export type InvoiceStatusView = {
  id: string;
  plan_type: string;
  status: string;
  total_pay_idr: number;
  paid_at: Date | null;
};

const BASE58 =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function generateInvoiceId(now = new Date()): string {
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, "");
  let suffix = "";
  for (let i = 0; i < 5; i += 1) {
    suffix += BASE58[randomInt(58)];
  }
  // Uniqueness does not depend on a nonce: the PK and provider_ref both guard.
  return `INV-KTL-${ymd}-${suffix}`;
}

function planPricing(
  planType: string,
  customAmountIdr: number | undefined,
): { base: number; bonus: number; total: number } {
  switch (planType) {
    case "PREPAID": {
      const amount = customAmountIdr ?? 0;
      if (!Number.isInteger(amount) || amount < 5000 || amount > 1_000_000) {
        throw validationError("Nominal harus antara 5.000 dan 1.000.000");
      }
      // shortcut: no bonus program yet. Upgrade: coupon/referral bonus table.
      return { base: amount, bonus: 0, total: amount };
    }
    case "UNLIMITED_10D":
      return { base: 20_000, bonus: 0, total: 20_000 };
    case "TRIAL_1D":
      return { base: 100, bonus: 0, total: 100 };
    default:
      throw new AppError(400, "INVALID_PLAN", "Paket tidak tersedia", {
        type: "validation_error",
        param: "plan_type",
      });
  }
}

function validationError(message: string): AppError {
  return new AppError(400, "VALIDATION_ERROR", message, {
    type: "validation_error",
  });
}

function planTypeOrError(value: string): PlanType {
  if (value === "PREPAID" || value === "UNLIMITED_10D" || value === "TRIAL_1D") {
    return value;
  }
  throw new AppError(400, "INVALID_PLAN", "Paket tidak tersedia", {
    type: "validation_error",
    param: "plan_type",
  });
}

export async function claimTrial(db: Db, userId: string): Promise<void> {
  const [claimed] = await db
    .update(users)
    .set({ hasClaimedTrial: true })
    .where(and(eq(users.id, userId), eq(users.hasClaimedTrial, false)))
    .returning({ id: users.id });
  if (!claimed) {
    throw new AppError(400, "TRIAL_ALREADY_CLAIMED", "Trial sudah pernah diklaim", {
      type: "validation_error",
    });
  }
}

export async function revertTrial(db: Db, userId: string): Promise<void> {
  await db.update(users).set({ hasClaimedTrial: false }).where(eq(users.id, userId));
}

export async function createInvoice(
  db: Db,
  provider: QrisProvider | null,
  userId: string,
  input: { planType: string; customAmountIdr?: number },
): Promise<InvoiceView> {
  if (!provider) {
    throw new AppError(502, "PAYMENT_GATEWAY_ERROR", "Payment gateway belum dikonfigurasi", {
      type: "api_error",
    });
  }

  const planType = planTypeOrError(input.planType);
  const pricing = planPricing(planType, input.customAmountIdr);

  // Trial is claimed BEFORE the gateway call so a failed gateway attempt still
  // consumes the claim? No: reverted when the gateway throws, so a user can retry.
  if (planType === "TRIAL_1D") {
    await claimTrial(db, userId);
  }

  let invoiceId = generateInvoiceId();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const created = await provider.createInvoice({
        merchantRef: invoiceId,
        amountIdr: pricing.total,
        planType,
      });
      const [row] = await db
        .insert(paymentInvoices)
        .values({
          id: invoiceId,
          userId,
          planType,
          baseAmountIdr: pricing.base,
          bonusAmountIdr: pricing.bonus,
          totalPayIdr: pricing.total,
          qrisString: created.qrisString,
          providerRef: created.providerRef,
          status: "PENDING",
          expiresAt: created.expiresAt ?? new Date(Date.now() + 15 * 60 * 1000),
        })
        .returning({
          id: paymentInvoices.id,
          planType: paymentInvoices.planType,
          qrisString: paymentInvoices.qrisString,
          status: paymentInvoices.status,
          expiresAt: paymentInvoices.expiresAt,
          baseAmountIdr: paymentInvoices.baseAmountIdr,
          bonusAmountIdr: paymentInvoices.bonusAmountIdr,
          totalPayIdr: paymentInvoices.totalPayIdr,
        });
      return {
        id: row.id,
        plan_type: row.planType as PlanType,
        base_amount_idr: toIdr(row.baseAmountIdr),
        bonus_amount_idr: toIdr(row.bonusAmountIdr),
        total_pay_idr: toIdr(row.totalPayIdr),
        qris_string: row.qrisString,
        status: row.status,
        expires_at: row.expiresAt,
      };
    } catch (err) {
      // Retry once on id/provider_ref collision, then surface gateway errors.
      if (attempt === 0 && (err as { code?: string }).code === "23505") {
        invoiceId = generateInvoiceId();
        continue;
      }
      if (planType === "TRIAL_1D") {
        await revertTrial(db, userId);
      }
      if (err instanceof AppError) throw err;
      throw new AppError(502, "PAYMENT_GATEWAY_ERROR", "Gagal menghubungi payment gateway", {
        type: "api_error",
      });
    }
  }

  // Unreachable: the second attempt always returns or throws above.
  throw new AppError(502, "PAYMENT_GATEWAY_ERROR", "Gagal menghubungi payment gateway", {
    type: "api_error",
  });
}

export async function getInvoiceStatus(
  db: Db,
  userId: string,
  invoiceId: string,
): Promise<InvoiceStatusView> {
  const [row] = await db
    .select({
      id: paymentInvoices.id,
      userId: paymentInvoices.userId,
      planType: paymentInvoices.planType,
      status: paymentInvoices.status,
      totalPayIdr: paymentInvoices.totalPayIdr,
      paidAt: paymentInvoices.paidAt,
    })
    .from(paymentInvoices)
    .where(eq(paymentInvoices.id, invoiceId))
    .limit(1);

  if (!row || row.userId !== userId) {
    throw new AppError(404, "INVOICE_NOT_FOUND", "Tagihan tidak ditemukan", {
      type: "invalid_request_error",
    });
  }

  return {
    id: row.id,
    plan_type: row.planType,
    status: row.status,
    total_pay_idr: toIdr(row.totalPayIdr),
    paid_at: row.paidAt,
  };
}

export type SettleResult = { status: "credited" | "duplicate" | "terminal" };

/** Settle one webhook event transactionally. `db.transaction` provides the
 *  SELECT ... FOR UPDATE lock via `.for("update")`. The previousRow status is
 *  checked under the lock so concurrent deliveries credit at most once. */
export async function settleWebhook(
  db: Db,
  redis: Redis,
  providerRef: string,
  status: "PAID" | "EXPIRED" | "FAILED",
): Promise<{ ok: true; duplicate?: true }> {
  if (!/^[A-Za-z0-9-]{1,128}$/.test(providerRef)) {
    throw new AppError(400, "INVALID_PAYLOAD", "Payload webhook tidak valid", {
      type: "invalid_request_error",
    });
  }

  const result = await db.transaction(async (tx) => {
    const [invoice] = await tx
      .select()
      .from(paymentInvoices)
      .where(eq(paymentInvoices.providerRef, providerRef))
      .for("update")
      .limit(1);

    if (!invoice) {
      throw new AppError(404, "INVOICE_NOT_FOUND", "Tagihan tidak ditemukan", {
        type: "invalid_request_error",
      });
    }

    if (invoice.status === "PAID") {
      return { ok: true as const, duplicate: true as const, userId: invoice.userId };
    }

    if (status !== "PAID") {
      // Keep PENDING -> EXPIRED/FAILED transitions only. Once terminal, a
      // cross-status delivery must not overwrite the recorded terminal state.
      if (invoice.status !== "PENDING") {
        return { ok: true as const, userId: invoice.userId };
      }
      await tx
        .update(paymentInvoices)
        .set({
          status,
          paidAt: sql`NULL`,
        })
        .where(eq(paymentInvoices.id, invoice.id));
      return { ok: true as const, userId: invoice.userId };
    }

    const base = toIdr(invoice.baseAmountIdr);
    const bonus = toIdr(invoice.bonusAmountIdr);
    const total = toIdr(invoice.totalPayIdr);
    // `totalPayIdr` is what the user pays (== base). `bonus` is extra free
    // credit and is not part of the billed total. Guard the coherent pair and
    // leave a corrupt row uncleared instead of crediting money nobody paid.
    if (base !== total) {
      console.error(
        `[qris] amount mismatch invoice=${invoice.id} base=${base} bonus=${bonus} total=${total}`,
      );
      return { ok: true as const, duplicate: true as const, userId: invoice.userId };
    }
    void bonus;

    if (invoice.planType === "PREPAID") {
      await tx.execute(
        sql`UPDATE users SET wallet_balance_idr = CAST(wallet_balance_idr AS numeric) + ${base.toFixed(4)} + ${bonus.toFixed(4)} WHERE id = ${invoice.userId}`,
      );
    } else if (invoice.planType === "UNLIMITED_10D") {
      await tx.execute(
        sql`UPDATE users SET unlimited_expires_at = GREATEST(COALESCE(unlimited_expires_at, now()), now()) + interval '10 days' WHERE id = ${invoice.userId}`,
      );
    } else if (invoice.planType === "TRIAL_1D") {
      await tx.execute(
        sql`UPDATE users SET unlimited_expires_at = GREATEST(COALESCE(unlimited_expires_at, now()), now()) + interval '1 day' WHERE id = ${invoice.userId}`,
      );
    }

    await tx
      .update(paymentInvoices)
      .set({ status: "PAID", paidAt: new Date() })
      .where(eq(paymentInvoices.id, invoice.id));

    return { ok: true as const, userId: invoice.userId };
  });

  // Best-effort cache re-seed posted AFTER the tx commit. The value is the
  // PostgreSQL balance, so any racing initWallet with a stale pre-credit read
  // must keep the higher PG value (see the snapshot-aware SET NX in redis.ts).
  // The old wallet key is invalidated after seeding to satisfy the "DEL after
  // credit" contract without reopening the stale-NX race.
  if (result.userId && status === "PAID") {
    const [row] = await db
      .select({ balance: users.walletBalanceIdr })
      .from(users)
      .where(eq(users.id, result.userId))
      .limit(1);
    const snapshot = row ? String(row.balance) : undefined;
    if (snapshot !== undefined) {
      await redis.set(`wallet:seed:${result.userId}`, snapshot).catch(() => {});
    }
    await redis.del(`wallet:${result.userId}`).catch(() => {});
  }

  if (result.duplicate) return { ok: true, duplicate: true };
  return { ok: true };
}