import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { setCookie, deleteCookie } from "hono/cookie";
import { z } from "zod";
import type { AppEnv } from "../env";
import type { Db } from "../db";
import {
  getPublicUser,
  login,
  register,
  signSessionToken,
} from "../services/auth.service";
import { sessionAuth } from "../middleware/session-auth";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(72),
});

export function authRoutes(db: Db, appEnv: AppEnv) {
  const app = new Hono();

  app.post(
    "/register",
    zValidator("json", registerSchema, (result, c) => {
      if (!result.success) {
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
    }),
    async (c) => {
      const { email, password } = c.req.valid("json");
      const user = await register(db, { email, password });
      return c.json(user, 201);
    },
  );

  app.post(
    "/login",
    zValidator("json", loginSchema, (result, c) => {
      if (!result.success) {
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
    }),
    async (c) => {
      const { email, password } = c.req.valid("json");
      const { user, session } = await login(db, { email, password });
      const token = await signSessionToken(session, appEnv.JWT_SECRET);

      setCookie(c, "katalis_session", token, {
        httpOnly: true,
        sameSite: "Lax",
        path: "/",
        maxAge: 604800,
        secure: appEnv.COOKIE_SECURE,
      });

      return c.json(user, 200);
    },
  );

  app.post("/logout", async (c) => {
    deleteCookie(c, "katalis_session", {
      httpOnly: true,
      sameSite: "Lax",
      path: "/",
      maxAge: 0,
      secure: appEnv.COOKIE_SECURE,
    });
    return c.json({ ok: true }, 200);
  });

  app.get("/session", sessionAuth(appEnv.JWT_SECRET), async (c) => {
    const user = await getPublicUser(db, c.get("user").id);
    return c.json(user, 200);
  });

  return app;
}