import { Hono } from "hono";
import type { Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type Redis from "ioredis";
import type { AppEnv } from "../env";
import type { Db } from "../db";
import { sessionAuth, type SessionVariables } from "../middleware/session-auth";
import { AppError } from "../middleware/error-handler";
import {
  createApiKey,
  listApiKeys,
  renameApiKey,
  revokeApiKey,
  setApiKeyActive,
  setSpendLimit,
} from "../services/key.service";

export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function keyIdParam(c: { req: { param: (name: string) => string } }): string {
  const id = c.req.param("id");
  if (!UUID_REGEX.test(id)) {
    throw new AppError(404, "KEY_NOT_FOUND", "API key tidak ditemukan", {
      type: "invalid_request_error",
    });
  }
  return id;
}

const nameSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

const spendLimitSchema = z.object({
  spend_limit_idr: z.union([
    z.number().min(0).max(9999999999.9999),
    z.null(),
  ]),
});

function validationError(c: Context) {
  return c.json(
    {
      error: {
        message: "Validasi input gagal",
        type: "validation_error",
        param: null,
        code: "VALIDATION_ERROR",
      },
    },
    400,
  );
}

export function keysRoutes(db: Db, redis: Redis, env: AppEnv) {
  const app = new Hono<SessionVariables>();
  app.use("*", sessionAuth(env.JWT_SECRET));

  app.post(
    "/",
    zValidator("json", z.object({ name: z.string().trim().min(1).max(100).optional() }), (result, c) => {
      if (!result.success) return validationError(c);
    }),
    async (c) => {
      const { name } = c.req.valid("json");
      const key = await createApiKey(db, redis, c.get("user").id, name);
      return c.json(key, 201);
    },
  );

  app.get("/", async (c) => {
    const keys = await listApiKeys(db, c.get("user").id);
    return c.json(keys, 200);
  });

  app.patch(
    "/:id",
    zValidator("json", nameSchema, (result, c) => {
      if (!result.success) return validationError(c);
    }),
    async (c) => {
      const id = keyIdParam(c);
      const { name } = c.req.valid("json");
      const key = await renameApiKey(db, c.get("user").id, id, name);
      return c.json(key, 200);
    },
  );

  app.put(
    "/:id/spend-limit",
    zValidator("json", spendLimitSchema, (result, c) => {
      if (!result.success) return validationError(c);
    }),
    async (c) => {
      const id = keyIdParam(c);
      const { spend_limit_idr } = c.req.valid("json");
      const key = await setSpendLimit(db, redis, c.get("user").id, id, spend_limit_idr);
      return c.json(key, 200);
    },
  );

  app.post("/:id/pause", async (c) => {
    const id = keyIdParam(c);
    const key = await setApiKeyActive(db, redis, c.get("user").id, id, false);
    return c.json(key, 200);
  });

  app.post("/:id/resume", async (c) => {
    const id = keyIdParam(c);
    const key = await setApiKeyActive(db, redis, c.get("user").id, id, true);
    return c.json(key, 200);
  });

  app.delete("/:id", async (c) => {
    const id = keyIdParam(c);
    const result = await revokeApiKey(db, redis, c.get("user").id, id);
    return c.json(result, 200);
  });

  return app;
}