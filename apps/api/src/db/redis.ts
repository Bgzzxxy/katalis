import Redis from "ioredis";

export function createRedis(url: string): Redis {
  return new Redis(url, { lazyConnect: false });
}

export async function pingRedis(
  redis: Redis,
  timeoutMs: number = 2000,
): Promise<boolean> {
  try {
    const pingPromise = redis.ping();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("redis ping timeout")), timeoutMs),
    );
    const pong = await Promise.race([pingPromise, timeoutPromise]);
    return pong === "PONG";
  } catch {
    return false;
  }
}