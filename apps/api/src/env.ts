export type AppEnv = {
  DATABASE_URL: string;
  REDIS_URL: string;
  JWT_SECRET: string;
  NODE_ENV: string;
  COOKIE_SECURE: boolean;
  CORS_ORIGINS: string;
};

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
  };
}

export const env = readEnv();