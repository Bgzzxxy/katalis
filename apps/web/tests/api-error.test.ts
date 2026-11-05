import { describe, expect, test } from "bun:test";
import { ApiError } from "../src/lib/types";

describe("ApiError", () => {
  test("carries technical error code label", () => {
    const err = new ApiError(401, "UNAUTHENTICATED", "Sesi tidak valid");
    expect(err.status).toBe(401);
    expect(err.code).toBe("UNAUTHENTICATED");
    expect(err.errorCodeLabel).toBe("HTTP 401 · UNAUTHENTICATED");
  });

  test("network error has 0 status", () => {
    const err = new ApiError(0, "NETWORK_ERROR", "Tidak dapat terhubung");
    expect(err.errorCodeLabel).toBe("NETWORK_ERROR");
  });
});