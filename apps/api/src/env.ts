export type AppEnv = {
  DATABASE_URL: string;
  REDIS_URL: string;
  JWT_SECRET: string;
  NODE_ENV: string;
  COOKIE_SECURE: boolean;
  CORS_ORIGINS: string;
  // Optional proxy/upstream settings (Batch 3). Optional so the many test
  // fixtures that build an AppEnv literal keep compiling; consumers apply
  // their own defaults when a field is absent.
  PROXY_FIRST_BYTE_TIMEOUT_MS?: number;
  FLEX_WINDOW_MS?: number;
  FLEX_WINDOW_MAX_TOKENS?: number;
  UPSTREAM_SILICONFLOW_BASE_URL?: string;
  UPSTREAM_SILICONFLOW_API_KEY?: string;
  UPSTREAM_DEEPSEEK_BASE_URL?: string;
  UPSTREAM_DEEPSEEK_API_KEY?: string;
  UPSTREAM_ZHIPU_BASE_URL?: string;
  UPSTREAM_ZHIPU_API_KEY?: string;
  UPSTREAM_VOLCENGINE_BASE_URL?: string;
  UPSTREAM_VOLCENGINE_API_KEY?: string;
};

function readPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function readEnv(): AppEnv {
  const DATABASE_URL = process.env.DATABASE_URL ?? "";
  const REDIS_URL = process.env.REDIS_URL ?? "";
  const JWT_SECRET = process.env.JWT_SECRET ?? "";
  const NODE_ENV = process.env.NODE_ENV ?? "development";
  const COOKIE_SECURE = process.env.COOKIE_SECURE === "true";
  const CORS_ORIGINS = process.env.CORS_ORIGINS ?? "";

  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }
  if (!REDIS_URL) {
    throw new Error("REDIS_URL is required");
  }
  if (JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters");
  }

  return {
    DATABASE_URL,
    REDIS_URL,
    JWT_SECRET,
    NODE_ENV,
    COOKIE_SECURE,
    CORS_ORIGINS,
    PROXY_FIRST_BYTE_TIMEOUT_MS: readPositiveInt(
      process.env.PROXY_FIRST_BYTE_TIMEOUT_MS,
      3000,
    ),
    FLEX_WINDOW_MS: readPositiveInt(process.env.FLEX_WINDOW_MS, 5 * 60 * 60 * 1000),
    FLEX_WINDOW_MAX_TOKENS: readPositiveInt(
      process.env.FLEX_WINDOW_MAX_TOKENS,
      1_000_000,
    ),
    UPSTREAM_SILICONFLOW_BASE_URL: process.env.UPSTREAM_SILICONFLOW_BASE_URL,
    UPSTREAM_SILICONFLOW_API_KEY: process.env.UPSTREAM_SILICONFLOW_API_KEY,
    UPSTREAM_DEEPSEEK_BASE_URL: process.env.UPSTREAM_DEEPSEEK_BASE_URL,
    UPSTREAM_DEEPSEEK_API_KEY: process.env.UPSTREAM_DEEPSEEK_API_KEY,
    UPSTREAM_ZHIPU_BASE_URL: process.env.UPSTREAM_ZHIPU_BASE_URL,
    UPSTREAM_ZHIPU_API_KEY: process.env.UPSTREAM_ZHIPU_API_KEY,
    UPSTREAM_VOLCENGINE_BASE_URL: process.env.UPSTREAM_VOLCENGINE_BASE_URL,
    UPSTREAM_VOLCENGINE_API_KEY: process.env.UPSTREAM_VOLCENGINE_API_KEY,
  };
}

export const env = readEnv();