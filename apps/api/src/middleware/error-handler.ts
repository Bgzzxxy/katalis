import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";

export class AppError extends Error {
  status: number;
  code: string;
  type: string;
  param?: string;

  constructor(
    status: number,
    code: string,
    message: string,
    options: { type?: string; param?: string } = {},
  ) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.type = options.type ?? "api_error";
    this.param = options.param;
  }
}

export function toOpenAiError(err: AppError) {
  return {
    error: {
      message: err.message,
      type: err.type,
      param: err.param ?? null,
      code: err.code,
    },
  };
}

export function errorHandler(err: Error, c: Context) {
  if (err instanceof AppError) {
    return c.json(toOpenAiError(err), err.status as 400 | 401 | 403 | 404 | 502 | 503);
  }

  // Handle Hono's HTTPException (e.g. malformed JSON from c.req.json() yields 400,
  // unmatched method yields 405, etc.) and any error carrying an HTTP status.
  const statusCarrier = err as unknown as { status?: unknown };
  if (err instanceof HTTPException || typeof statusCarrier.status === "number") {
    const status = statusCarrier.status as number;
    const code =
      status === 400
        ? "VALIDATION_ERROR"
        : status === 404
          ? "NOT_FOUND"
          : status === 405
            ? "METHOD_NOT_ALLOWED"
            : status === 401
              ? "UNAUTHENTICATED"
              : "API_ERROR";

    return c.json(
      {
        error: {
          message: err.message || "Request failed",
          type: status >= 500 ? "api_error" : "invalid_request_error",
          param: null,
          code,
        },
      },
      status as 400 | 401 | 403 | 404 | 405 | 500 | 502 | 503,
    );
  }

  console.error("[unhandled]", err);
  return c.json(
    {
      error: {
        message: "Internal server error",
        type: "api_error",
        param: null,
        code: "INTERNAL_ERROR",
      },
    },
    500,
  );
}