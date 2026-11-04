import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type { ProviderId, ModelSpec } from "../src/services/model-catalog";
import {
  routeToUpstream,
  type ProviderSpec,
  type RouterConfig,
} from "../src/services/upstream-router";
import {
  startMockUpstream,
  jsonUpstream,
  jsonResponse,
  type MockUpstream,
} from "./helpers/upstream-mock";

const SPEC: ModelSpec = {
  id: "mock-model",
  defaultPool: "STABLE",
  ownedBy: "katalis",
  priceInMicroPer1M: 1,
  priceOutMicroPer1M: 1,
  routes: [
    { provider: "DEEPSEEK", upstreamModel: "mock" },
    { provider: "SILICONFLOW", upstreamModel: "mock" },
  ],
};

function config(
  providers: Partial<Record<ProviderId, ProviderSpec>>,
  firstByteTimeoutMs = 3000,
): RouterConfig {
  return { providers, firstByteTimeoutMs, fetchImpl: fetch };
}

let backend: MockUpstream | undefined;

afterAll(() => {
  backend?.stop();
});

describe("upstream-router", () => {
  test("returns the primary upstream response on success", async () => {
    const primary = startMockUpstream(() => jsonUpstream());
    try {
      const routers = config({
        DEEPSEEK: { id: "DEEPSEEK", baseUrl: primary.url },
      });
      const result = await routeToUpstream(
        routers,
        SPEC,
        JSON.stringify({ model: "mock-model", messages: [] }),
      );
      expect(result.provider).toBe("DEEPSEEK");
      expect(result.response.status).toBe(200);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.response.headers.get("content-type")).toContain("application/json");
    } finally {
      primary.stop();
    }
  });

  test("fails over to the next route when the primary returns 503", async () => {
    const primary = startMockUpstream(() => jsonResponse({ error: "boom" }, 503));
    const secondary = startMockUpstream(() => jsonUpstream());
    try {
      const routers = config({
        DEEPSEEK: { id: "DEEPSEEK", baseUrl: primary.url },
        SILICONFLOW: { id: "SILICONFLOW", baseUrl: secondary.url },
      });
      const result = await routeToUpstream(
        routers,
        SPEC,
        JSON.stringify({ model: "mock-model", messages: [] }),
      );
      expect(result.provider).toBe("SILICONFLOW");
      expect(result.response.status).toBe(200);
      expect(primary.count()).toBe(1);
      expect(secondary.count()).toBe(1);
    } finally {
      primary.stop();
      secondary.stop();
    }
  });

  test("fails over when the primary hangs past the first-byte timeout", async () => {
    const sleepy = startMockUpstream(
      (req) =>
        new Promise((resolve, reject) => {
          const timer = setTimeout(() => resolve(jsonUpstream()), 200);
          req.signal.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(new Error("aborted"));
          });
        }),
    );
    const secondary = startMockUpstream(() => jsonUpstream());
    try {
      const routers = config(
        {
          DEEPSEEK: { id: "DEEPSEEK", baseUrl: sleepy.url },
          SILICONFLOW: { id: "SILICONFLOW", baseUrl: secondary.url },
        },
        40,
      );
      const result = await routeToUpstream(
        routers,
        SPEC,
        JSON.stringify({ model: "mock-model", messages: [] }),
      );
      expect(result.provider).toBe("SILICONFLOW");
      expect(result.response.status).toBe(200);
      expect(secondary.count()).toBe(1);
    } finally {
      sleepy.stop();
      secondary.stop();
    }
  });

  test("throws 502 upstream_error when all upstreams fail", async () => {
    const down = startMockUpstream(() => jsonResponse({ error: "down" }, 503));
    try {
      const routers = config({
        DEEPSEEK: { id: "DEEPSEEK", baseUrl: down.url },
      });
      await expect(
        routeToUpstream(
          routers,
          SPEC,
          JSON.stringify({ model: "mock-model", messages: [] }),
        ),
      ).rejects.toMatchObject({ status: 502, code: "upstream_error" });
      expect(down.count()).toBe(1);
    } finally {
      down.stop();
    }
  });

  test("fails over across providers until one succeeds (chain)", async () => {
    const a = startMockUpstream(() => jsonResponse({}, 502));
    const b = startMockUpstream(() => jsonResponse({}, 504));
    const c = startMockUpstream(() => jsonUpstream({ usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }));
    const spec: ModelSpec = {
      ...SPEC,
      routes: [
        { provider: "DEEPSEEK", upstreamModel: "mock" },
        { provider: "ZHIPU", upstreamModel: "mock" },
        { provider: "VOLCENGINE", upstreamModel: "mock" },
      ],
    };
    try {
      const routers = config({
        DEEPSEEK: { id: "DEEPSEEK", baseUrl: a.url },
        ZHIPU: { id: "ZHIPU", baseUrl: b.url },
        VOLCENGINE: { id: "VOLCENGINE", baseUrl: c.url },
      });
      const result = await routeToUpstream(
        routers,
        spec,
        JSON.stringify({ model: "mock-model", messages: [] }),
      );
      expect(result.provider).toBe("VOLCENGINE");
      expect(result.response.status).toBe(200);
    } finally {
      a.stop();
      b.stop();
      c.stop();
    }
  });
});