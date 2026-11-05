import { sql } from "drizzle-orm";
import type { Db } from "../db";
import { toIdr } from "../db/money";

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