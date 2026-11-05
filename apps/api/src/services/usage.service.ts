import { sql } from "drizzle-orm";
import type { Db } from "../db";
import { toIdr } from "../db/money";
import { AppError } from "../middleware/error-handler";

export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type UsageHistoryItem = {
  id: number;
  created_at: string;
  model_id: string;
  pool_tier: string;
  upstream_provider: string;
  prompt_tokens: number;
  completion_tokens: number;
  cost_idr: number;
  latency_ms: number;
  http_status: number;
  api_key_id: string;
  api_key_name: string;
};

export type UsageHistory = {
  items: Array<UsageHistoryItem>;
  total: number;
  limit: number;
  offset: number;
};

export type DailyUsageSummary = {
  /** Local (Asia/Jakarta) calendar date, YYYY-MM-DD. */
  date: string;
  tokens: number;
  cost_idr: number;
  requests: number;
};

export type ModelUsageSummary = {
  model_id: string;
  requests: number;
  tokens: number;
  cost_idr: number;
};

export type UsageSummary = {
  range_days: number;
  total_tokens: number;
  total_cost_idr: number;
  total_requests: number;
  daily: Array<DailyUsageSummary>;
  by_model: Array<ModelUsageSummary>;
};
export type DailyUsage = {
  /** Local (Asia/Jakarta) calendar date for the reported window, YYYY-MM-DD. */
  date: string;
  tokens_used: number;
  amount_spent_idr: number;
};

// Indonesia uses WIB (UTC+07:00) with no DST, so the day boundary is a fixed
// offset and needs no tz database lookup.
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

function startOfTodayJakarta(): Date {
  const now = new Date();
  const utcMidnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  return new Date(utcMidnight - JAKARTA_OFFSET_MS);
}

function jakartaDateString(date: Date): string {
  return new Date(date.getTime() + JAKARTA_OFFSET_MS).toISOString().slice(0, 10);
}

/** Today's aggregate consumption for one member, straight from `usage_logs`. */
export async function getDailyUsage(
  db: Db,
  userId: string,
): Promise<DailyUsage> {
  const start = startOfTodayJakarta();

  const rows = (await db.execute(sql`
    SELECT
      COALESCE(SUM(prompt_tokens + completion_tokens), 0)::int AS tokens,
      COALESCE(SUM(cost_charged_idr), 0)::text AS amount
    FROM usage_logs
    WHERE user_id = ${userId} AND created_at >= ${start.toISOString()}
  `)) as Array<{ tokens: number; amount: string }>;

  const row = rows[0];
  return {
    date: jakartaDateString(new Date()),
    tokens_used: row?.tokens ?? 0,
    amount_spent_idr: toIdr(row?.amount ?? 0),
  };
}

export async function getUsageHistory(
  db: Db,
  userId: string,
  opts: { limit: number; offset: number; keyId?: string },
): Promise<UsageHistory> {
  if (
    typeof opts.limit !== "number" ||
    !Number.isInteger(opts.limit) ||
    opts.limit <= 0 ||
    typeof opts.offset !== "number" ||
    !Number.isInteger(opts.offset) ||
    opts.offset < 0
  ) {
    throw new AppError(400, "VALIDATION_ERROR", "Parameter pagination tidak valid", {
      type: "validation_error",
    });
  }

  if (opts.keyId !== undefined && opts.keyId !== "") {
    if (!UUID_REGEX.test(opts.keyId)) {
      throw new AppError(400, "VALIDATION_ERROR", "ID API Key tidak valid", {
        type: "validation_error",
        param: "key_id",
      });
    }
  }

  const limit = Math.min(opts.limit, 100);
  const offset = opts.offset;
  const keyFilter =
    opts.keyId !== undefined && opts.keyId !== ""
      ? sql`AND ul.api_key_id = ${opts.keyId}::uuid`
      : sql``;

  const countRows = (await db.execute(sql`
    SELECT COUNT(*)::int AS count
    FROM usage_logs ul
    WHERE ul.user_id = ${userId}::uuid
      ${keyFilter}
  `)) as Array<{ count: number }>;
  const total = countRows[0]?.count ?? 0;

  const itemRows = (await db.execute(sql`
    SELECT
      ul.id,
      to_char(ul.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at,
      ul.model_id,
      ul.pool_tier,
      ul.upstream_provider,
      ul.prompt_tokens,
      ul.completion_tokens,
      ul.cost_charged_idr,
      ul.latency_ms,
      ul.http_status,
      ul.api_key_id,
      COALESCE(ak.name, '—') AS api_key_name
    FROM usage_logs ul
    LEFT JOIN api_keys ak ON ul.api_key_id = ak.id
    WHERE ul.user_id = ${userId}::uuid
      ${keyFilter}
    ORDER BY ul.created_at DESC, ul.id DESC
    LIMIT ${limit} OFFSET ${offset}
  `)) as Array<{
    id: number;
    created_at: string;
    model_id: string;
    pool_tier: string;
    upstream_provider: string;
    prompt_tokens: number;
    completion_tokens: number;
    cost_charged_idr: string | number;
    latency_ms: number;
    http_status: number;
    api_key_id: string;
    api_key_name: string;
  }>;

  const items: UsageHistoryItem[] = itemRows.map((row) => ({
    id: Number(row.id),
    created_at: String(row.created_at),
    model_id: String(row.model_id),
    pool_tier: String(row.pool_tier),
    upstream_provider: String(row.upstream_provider),
    prompt_tokens: Number(row.prompt_tokens),
    completion_tokens: Number(row.completion_tokens),
    cost_idr: toIdr(row.cost_charged_idr),
    latency_ms: Number(row.latency_ms),
    http_status: Number(row.http_status),
    api_key_id: String(row.api_key_id),
    api_key_name: String(row.api_key_name),
  }));

  return {
    items,
    total,
    limit,
    offset,
  };
}

export async function getUsageSummary(
  db: Db,
  userId: string,
  days: 7 | 30,
): Promise<UsageSummary> {
  if (days !== 7 && days !== 30) {
    throw new AppError(400, "VALIDATION_ERROR", "Parameter days harus bernilai 7 atau 30", {
      type: "validation_error",
      param: "days",
    });
  }

  const now = new Date();
  const nowJakarta = new Date(now.getTime() + JAKARTA_OFFSET_MS);
  const y = nowJakarta.getUTCFullYear();
  const m = nowJakarta.getUTCMonth();
  const d = nowJakarta.getUTCDate();

  const dateStrings: string[] = [];
  const dailyMap = new Map<string, { tokens: number; cost_idr: number; requests: number }>();
  for (let i = days - 1; i >= 0; i--) {
    const dayUtcMidnight = Date.UTC(y, m, d - i);
    const dateStr = new Date(dayUtcMidnight).toISOString().slice(0, 10);
    dateStrings.push(dateStr);
    dailyMap.set(dateStr, { tokens: 0, cost_idr: 0, requests: 0 });
  }

  const earliestMidnightUtc = Date.UTC(y, m, d - (days - 1)) - JAKARTA_OFFSET_MS;
  const startUtc = new Date(earliestMidnightUtc);

  const dailyRows = (await db.execute(sql`
    SELECT
      to_char(created_at AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD') AS day_date,
      COALESCE(SUM(prompt_tokens + completion_tokens), 0)::int AS tokens,
      COALESCE(SUM(cost_charged_idr), 0)::text AS amount,
      COUNT(*)::int AS requests
    FROM usage_logs
    WHERE user_id = ${userId}::uuid AND created_at >= ${startUtc.toISOString()}
    GROUP BY day_date
  `)) as Array<{
    day_date: string;
    tokens: number;
    amount: string;
    requests: number;
  }>;

  for (const row of dailyRows) {
    if (dailyMap.has(row.day_date)) {
      dailyMap.set(row.day_date, {
        tokens: Number(row.tokens),
        cost_idr: toIdr(row.amount),
        requests: Number(row.requests),
      });
    }
  }

  const daily: DailyUsageSummary[] = dateStrings.map((date) => {
    const val = dailyMap.get(date)!;
    return {
      date,
      tokens: val.tokens,
      cost_idr: val.cost_idr,
      requests: val.requests,
    };
  });

  const modelRows = (await db.execute(sql`
    SELECT
      model_id,
      COUNT(*)::int AS requests,
      COALESCE(SUM(prompt_tokens + completion_tokens), 0)::int AS tokens,
      COALESCE(SUM(cost_charged_idr), 0)::text AS amount
    FROM usage_logs
    WHERE user_id = ${userId}::uuid AND created_at >= ${startUtc.toISOString()}
    GROUP BY model_id
    ORDER BY SUM(cost_charged_idr) DESC, requests DESC, model_id ASC
  `)) as Array<{
    model_id: string;
    requests: number;
    tokens: number;
    amount: string;
  }>;

  const by_model: ModelUsageSummary[] = modelRows.map((row) => ({
    model_id: String(row.model_id),
    requests: Number(row.requests),
    tokens: Number(row.tokens),
    cost_idr: toIdr(row.amount),
  }));

  const totalRows = (await db.execute(sql`
    SELECT
      COALESCE(SUM(prompt_tokens + completion_tokens), 0)::int AS total_tokens,
      COALESCE(SUM(cost_charged_idr), 0)::text AS total_amount,
      COUNT(*)::int AS total_requests
    FROM usage_logs
    WHERE user_id = ${userId}::uuid AND created_at >= ${startUtc.toISOString()}
  `)) as Array<{
    total_tokens: number;
    total_amount: string;
    total_requests: number;
  }>;

  const totals = totalRows[0];

  return {
    range_days: days,
    total_tokens: Number(totals?.total_tokens ?? 0),
    total_cost_idr: toIdr(totals?.total_amount ?? 0),
    total_requests: Number(totals?.total_requests ?? 0),
    daily,
    by_model,
  };
}