import { createMiddleware } from "hono/factory";
import type Redis from "ioredis";
import type { Db } from "../db";
import { AppError } from "./error-handler";
import { hashApiKey, lookupApiKey, parseApiKey } from "../services/key.service";

export type ApiKeyVariables = {
  Variables: {
    apiKey: {
      id: string;
      userId: string;
      keyPrefix: string;
      isActive: boolean;
      spendLimitIdr: number | null;
      spentIdr: number;
    };
    // Separate variable: keeps the serialized apiKey context at its original
    // 6 fields (per Batch 2/QA contract) while downstream billing gets the hash.
    apiKeyHash: string;
  };
};

const INVALID_KEY = "API key tidak valid";

function invalidApiKey(): AppError {
  return new AppError(401, "invalid_api_key", INVALID_KEY, {
    type: "authentication_error",
  });
}

export function apiKeyAuth(db: Db, redis: Redis) {
  return createMiddleware<ApiKeyVariables>(async (c, next) => {
    const header = c.req.header("authorization");
    if (!header) throw invalidApiKey();

    // Tolerate extra whitespace from SDKs/proxies: "Bearer  sk-ktl-..." etc.
    const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
    if (!match) throw invalidApiKey();
    const raw = match[1];

    const apiKey = await lookupApiKey(db, redis, raw);
    if (!apiKey) throw invalidApiKey();
    if (!apiKey.isActive) throw invalidApiKey();

    c.set("apiKey", apiKey);
    c.set("apiKeyHash", hashApiKey(parseApiKey(raw) as string));
    await next();
  });
}