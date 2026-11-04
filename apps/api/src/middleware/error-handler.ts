import type { Context } from "hono";

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