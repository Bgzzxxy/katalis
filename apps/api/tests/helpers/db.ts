import { sql } from "drizzle-orm";
import type { Db, DbClient } from "../../src/db";

export const TEST_DB_URL =
  process.env.DATABASE_URL ??
  "postgres://katalis:katalis_dev@127.0.0.1:5432/katalis_test";

export const TEST_REDIS_URL =
  process.env.REDIS_URL ?? "redis://127.0.0.1:6379";

export const TEST_JWT_SECRET =
  process.env.JWT_SECRET ??
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

export async function resetDb(db: Db): Promise<void> {
  await db.execute(
    sql`TRUNCATE TABLE usage_logs, payment_invoices, api_keys, users RESTART IDENTITY CASCADE`,
  );
}

export async function closeDb(client: DbClient): Promise<void> {
  await client.end();
}