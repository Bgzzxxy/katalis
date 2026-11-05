// QA (independent): the client must survive every OpenAI error envelope shape
// the backend (or a reverse proxy) can emit, without crashing or losing the
// technical error code. CLAUDE.md §5.4 / Design.md §5.5.
import { afterEach, describe, expect, test } from "bun:test";
import { ApiError } from "../../src/lib/types";
import { createKey, fetchTelemetry } from "../../src/lib/api";

const originalFetch = globalThis.fetch;

function mockFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    return handler(String(url), init);
  }) as unknown as typeof fetch;
  return calls;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("QA API error envelope parsing", () => {
  test("standard OpenAI envelope keeps message, code and status", async () => {
    mockFetch(
      () =>
        new Response(
          JSON.stringify({
            error: {
              message: "API key tidak valid",
              type: "invalid_request_error",
              param: null,
              code: "INVALID_API_KEY",
            },
          }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        ),
    );

    const err = (await fetchTelemetry().catch((e) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(401);
    expect(err.code).toBe("INVALID_API_KEY");
    expect(err.message).toBe("API key tidak valid");
    expect(err.errorCodeLabel).toBe("HTTP 401 · INVALID_API_KEY");
  });

  test("non-JSON (reverse-proxy HTML) body yields a sane generic envelope, no crash", async () => {
    mockFetch(
      () =>
        new Response("<html><body>502 Bad Gateway</body></html>", {
          status: 502,
          headers: { "Content-Type": "text/html" },
        }),
    );

    const err = (await fetchTelemetry().catch((e) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(502);
    expect(err.code).toBe("HTTP_502");
    expect(err.apiType).toBe("api_error");
    expect(err.message).toBe("Terjadi kesalahan");
  });

  test("bare 401 with no JSON body falls back to the auth message", async () => {
    mockFetch(() => new Response("", { status: 401 }));
    const err = (await fetchTelemetry().catch((e) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe("Autentikasi diperlukan");
    expect(err.code).toBe("HTTP_401");
  });

  test("a 5xx with JSON keeps the backend type", async () => {
    mockFetch(
      () =>
        new Response(
          JSON.stringify({
            error: { message: "Gateway down", type: "api_error", param: null, code: "UPSTREAM_DOWN" },
          }),
          { status: 503, headers: { "Content-Type": "application/json" } },
        ),
    );
    const err = (await createKey("x").catch((e) => e)) as ApiError;
    expect(err.code).toBe("UPSTREAM_DOWN");
    expect(err.status).toBe(503);
  });
});

describe("QA API request hygiene", () => {
  test("sends same-origin requests with cookies and JSON content-type", async () => {
    const calls = mockFetch(
      () =>
        new Response(JSON.stringify({ id: "k1" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    await createKey("Cursor");
    expect(calls[0].url).toBe("/api/keys");
    expect(calls[0].init.credentials).toBe("include");
    expect(calls[0].init.method).toBe("POST");
    expect((calls[0].init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });
});
