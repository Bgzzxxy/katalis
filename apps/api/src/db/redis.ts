import Redis from "ioredis";

export function createRedis(url: string): Redis {
  return new Redis(url, { lazyConnect: false });
}

export async function pingRedis(redis: Redis): Promise<boolean> {
  try {
    const pong = await redis.ping();
    return pong === "PONG";
  } catch {
    return false;
  }
}