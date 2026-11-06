import { Hono } from "hono";
import type { Context } from "hono";
import type Redis from "ioredis";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Db } from "../db";
import type { AppEnv } from "../env";
import { users } from "../db/schema";
import { apiKeyAuth, type ApiKeyVariables } from "../middleware/api-key-auth";
import { AppError } from "../middleware/error-handler";
import {
  asPoolTier,
  findModel,
  listModels,
  type ModelSpec,
  type PoolTier,
} from "../services/model-catalog";
import {
  providerSpecsFromEnv,
  routeToUpstream,
  type RouterConfig,
} from "../services/upstream-router";
import {
  chargeRequest,
  flexWindow,
  getWalletMicro,
  initWallet,
  meterTokens,
  persistUsage,
} from "../services/token-meter";

const DEFAULT_FIRST_BYTE_TIMEOUT_MS = 3000;
const DEFAULT_FLEX_WINDOW_MS = 5 * 60 * 60 * 1000;
const DEFAULT_FLEX_WINDOW_MAX_TOKENS = 1_000_000;

export function v1ProxyRoutes(
  db: Db,
  redis: Redis,
  env: AppEnv,
  upstreamOverride?: RouterConfig,
) {
  const routerConfig: RouterConfig =
    upstreamOverride ?? {
      providers: providerSpecsFromEnv(
        env as unknown as Record<string, string | number | boolean | undefined>,
      ),
      firstByteTimeoutMs: env.PROXY_FIRST_BYTE_TIMEOUT_MS ?? DEFAULT_FIRST_BYTE_TIMEOUT_MS,
    };
  const flexWindowMs = env.FLEX_WINDOW_MS ?? DEFAULT_FLEX_WINDOW_MS;
  const flexWindowMaxTokens =
    env.FLEX_WINDOW_MAX_TOKENS ?? DEFAULT_FLEX_WINDOW_MAX_TOKENS;

  const app = new Hono<ApiKeyVariables>();
  app.use("*", apiKeyAuth(db, redis));

  app.get("/models", (c) => {
    const now = Math.floor(Date.now() / 1000);
    return c.json({
      object: "list",
      data: listModels().map((model) => ({
        id: model.id,
        object: "model",
        created: now,
        owned_by: model.ownedBy,
        name: model.name,
        provider: model.provider,
      })),
    });
  });

  app.post("/chat/completions", async (c) => {
    const key = c.get("apiKey");
    const keyHash = c.get("apiKeyHash");
    const parsed = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!parsed || typeof parsed.model !== "string") {
      throw new AppError(400, "VALIDATION_ERROR", "Parameter model wajib diisi", {
        type: "invalid_request_error",
        param: "model",
      });
    }

    const model = findModel(parsed.model);
    if (!model) {
      throw new AppError(404, "model_not_found", `Model '${parsed.model}' tidak tersedia`, {
        type: "invalid_request_error",
        param: "model",
      });
    }

    // Pool is a routing/label property of the MODEL, not a client-chosen discount.
    // The only tolerated override is choosing the model's own default pool; any
    // other value (esp. "LORA" on a non-LORA model) is rejected, so clients
    // cannot request the -30% LoRA discount on models that are not LoRA.
    const requestedPool = c.req.header("x-katalis-pool");
    const pool = requestedPool
      ? asPoolTier(requestedPool.toUpperCase())
      : model.defaultPool;
    if (!pool) {
      throw new AppError(400, "VALIDATION_ERROR", "Pool tidak valid", {
        type: "invalid_request_error",
        param: "x-katalis-pool",
      });
    }
    if (pool !== model.defaultPool) {
      throw new AppError(400, "VALIDATION_ERROR", `Pool '${requestedPool}' tidak tersedia untuk model ini`, {
        type: "invalid_request_error",
        param: "x-katalis-pool",
      });
    }

    const unlimitedExpiresAt = await getUnlimitedExpiresAt(db, key.userId);
    if (pool === "LORA" && (!unlimitedExpiresAt || unlimitedExpiresAt.getTime() <= Date.now())) {
      throw new AppError(403, "pool_not_available", "Dedicated LoRA hanya untuk paket Unlimited aktif", {
        type: "invalid_request_error",
        param: "x-katalis-pool",
      });
    }

    const stream = parsed.stream === true;
    const body = {
      ...parsed,
      model: model.id,
      stream,
      ...(stream
        ? {
            stream_options: {
              ...(parsed.stream_options as Record<string, unknown> | undefined),
              include_usage: true,
            },
          }
        : {}),
    };

    const pgWallet = await getPgWalletIdr(db, key.userId);
    await initWallet(redis, key.userId, pgWallet);

    if (pool === "FLEX") {
      const total = await flexWindow(
        redis,
        key.userId,
        estimateTokens(body),
        randomUUID(),
        flexWindowMs,
      );
      if (total > flexWindowMaxTokens) {
        throw new AppError(429, "flex_window_exceeded", "Kuota Flex Pool tercapai", {
          type: "rate_limit_error",
        });
      }
    }

    const routed = await routeToUpstream(
      routerConfig,
      model,
      JSON.stringify(body),
      c.req.raw.signal,
    );

    const claim = {
      userId: key.userId,
      keyId: key.id,
      keyHash,
      model,
      pool,
      provider: routed.provider,
      unlimitedExpiresAt,
      latencyMs: Math.max(routed.latencyMs, 0),
      httpStatus: routed.response.status,
    };

    if (stream) {
      return streamChatResponse(c, db, redis, routed.response, claim, routed.shouldCharge);
    }

    const text = await routed.response.text();
    if (routed.shouldCharge) {
      const usage = parseUsage(model.id, text);
      await settle(db, redis, claim, usage);
    }
    return new Response(text, {
      status: routed.response.status,
      headers: {
        "content-type": routed.response.headers.get("content-type") ?? "application/json",
      },
    });
  });

  return app;
}

type SettleClaim = {
  userId: string;
  keyId: string;
  keyHash: string;
  model: ModelSpec;
  pool: PoolTier;
  provider: string;
  unlimitedExpiresAt: Date | null;
  latencyMs: number;
  httpStatus: number;
};

type ParsedUsage = { promptTokens: number; completionTokens: number };

function estimateTokens(body: Record<string, unknown>): number {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const raw = JSON.stringify(messages).length;
  const maxTokens = typeof body.max_tokens === "number" ? (body.max_tokens as number) : 4096;
  return Math.max(1, Math.ceil(raw / 4) + maxTokens);
}

async function getUnlimitedExpiresAt(db: Db, userId: string): Promise<Date | null> {
  const [row] = await db
    .select({ unlimitedExpiresAt: users.unlimitedExpiresAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.unlimitedExpiresAt ?? null;
}

async function getPgWalletIdr(db: Db, userId: string): Promise<string> {
  const [row] = await db
    .select({ walletBalanceIdr: users.walletBalanceIdr })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.walletBalanceIdr ?? "0";
}

function parseUsage(modelId: string, text: string): ParsedUsage {
  try {
    const parsed = JSON.parse(text) as {
      usage?: { prompt_tokens?: unknown; completion_tokens?: unknown };
    };
    const prompt = Number(parsed.usage?.prompt_tokens ?? 0);
    const completion = Number(parsed.usage?.completion_tokens ?? 0);
    if (Number.isFinite(prompt) && Number.isFinite(completion) && (prompt > 0 || completion > 0)) {
      return { promptTokens: prompt, completionTokens: completion };
    }
  } catch {
    // JSON parse failed; fall through to chars/4.
  }
  return { promptTokens: Math.max(1, Math.ceil(text.length / 4)), completionTokens: 0 };
}

function costMicroFor(claim: SettleClaim, usage: ParsedUsage): number {
  return meterTokens(
    {
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      poolTier: claim.pool,
    },
    claim.model.priceInMicroPer1M,
    claim.model.priceOutMicroPer1M,
    claim.unlimitedExpiresAt,
  ).costMicro;
}

async function settle(db: Db, redis: Redis, claim: SettleClaim, usage: ParsedUsage): Promise<void> {
  const costMicro = costMicroFor(claim, usage);

  // Charge is atomic: it checks balance + spend_limit and debits in one Lua
  // script, returning the ACTUAL debited micro amount (already clamped).
  const { decision, debitMicro } = await chargeRequest(redis, claim.userId, claim.keyHash, costMicro);
  if (decision !== "ok") {
    const walletMicro = await getWalletMicro(redis, claim.userId);
    if (decision === "insufficient" || walletMicro <= 0) {
      throw new AppError(402, "insufficient_balance", "Saldo tidak cukup", {
        type: "insufficient_quota",
      });
    }
    throw new AppError(402, "spend_limit_reached", "Batas pengeluaran API key tercapai", {
      type: "insufficient_quota",
    });
  }

  await persistUsage(db, {
    userId: claim.userId,
    apiKeyId: claim.keyId,
    modelId: claim.model.id,
    poolTier: claim.pool,
    upstreamProvider: claim.provider,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    costMicro: debitMicro,
    latencyMs: claim.latencyMs,
    httpStatus: claim.httpStatus,
  });
}

/**
 * Bill a stream the client abandoned. The upstream still produced tokens that
 * we paid for, so the member pays for what the upstream reported (or, when no
 * usage object arrived, for the bytes that were delivered). Nothing is persisted
 * to `usage_logs`: the request never reached the client, so it is a debit-only
 * correction, not a billed request.
 */
async function settlePartial(redis: Redis, claim: SettleClaim, delivered: string): Promise<void> {
  const billed = parseUsage(claim.model.id, delivered).promptTokens;
  const { decision } = await chargeRequest(
    redis,
    claim.userId,
    claim.keyHash,
    costMicroFor(claim, { promptTokens: billed, completionTokens: 0 }),
  );
  if (decision !== "ok") {
    console.warn(
      `[stream-abort] charge skipped decision=${decision} bytes=${delivered.length}`,
    );
  }
}

async function streamChatResponse(
  c: Context,
  db: Db,
  redis: Redis,
  upstream: Response,
  claim: SettleClaim,
  shouldCharge: boolean,
): Promise<Response> {
  const headers = {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive",
  };

  // Read the body FIRST: by the time the upstream has finished talking, an
  // aborted request no longer exposes its body, which would silently skip both
  // the charge and the 4xx path below.
  const text = await upstream.text();
  const aborted = c.req.raw.signal.aborted;

  if (aborted) {
    // The client walked away mid-stream. It still consumed (and we still paid
    // for) the tokens the upstream produced, so charge that instead of
    // forgetting the request entirely (Prd §7).
    if (shouldCharge) {
      await settlePartial(redis, claim, text);
    }
    return new Response(null, { status: 499 });
  }

  if (shouldCharge) {
    const usage = parseUsage(claim.model.id, text);
    await settle(db, redis, claim, usage);
  }

  return new Response(text, { status: upstream.status, headers });
}