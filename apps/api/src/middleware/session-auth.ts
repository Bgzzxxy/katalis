import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import {
  verifySessionToken,
  type SessionUser,
} from "../services/auth.service";
import { AppError } from "./error-handler";

export type SessionVariables = {
  Variables: {
    user: SessionUser;
  };
};

export function sessionAuth(jwtSecret: string) {
  return createMiddleware<SessionVariables>(async (c, next) => {
    const token = getCookie(c, "katalis_session");
    if (!token) {
      throw new AppError(401, "UNAUTHENTICATED", "Silakan login terlebih dahulu", {
        type: "auth_error",
      });
    }

    const user = await verifySessionToken(token, jwtSecret);
    c.set("user", user);
    await next();
  });
}