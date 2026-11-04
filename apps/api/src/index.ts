import { createApp } from "./app";
import { createDb } from "./db";
import { createRedis } from "./db/redis";
import { env } from "./env";

const { client, db } = createDb(env.DATABASE_URL, { max: 10 });
const redis = createRedis(env.REDIS_URL);

const app = createApp({ db, redis, env });

// Close DB and Redis connections cleanly on shutdown so deploys and dev restarts
// do not leak connections.
async function shutdown() {
  try {
    redis.disconnect();
    await client.end();
  } finally {
    process.exit(0);
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

export default {
  port: Number(process.env.PORT ?? 3000),
  fetch: app.fetch,
};

export { db };