import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "./schema";

export type DbClient = ReturnType<typeof postgres>;
export type Db = ReturnType<typeof drizzle<typeof schema>>;

export function createDb(
  url: string,
  options: { max: number } = { max: 1 },
): { client: DbClient; db: Db } {
  const client = postgres(url, { max: options.max });
  const db = drizzle(client, { schema });
  return { client, db };
}

export async function pingDb(db: Db): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}