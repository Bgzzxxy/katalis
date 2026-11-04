import { createApp } from "./app";
import { createDb } from "./db";
import { createRedis } from "./db/redis";
import { env } from "./env";

const { client: _client, db } = createDb(env.DATABASE_URL, { max: 10 });
const redis = createRedis(env.REDIS_URL);

const app = createApp({ db, redis, env });

export default {
  port: Number(process.env.PORT ?? 3000),
  fetch: app.fetch,
};

export { db };