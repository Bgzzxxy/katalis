import type Redis from "ioredis";

export async function clearApiKeyCache(redis: Redis): Promise<void> {
  const keys = await redis.keys("apikey:*");
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}