import type { ModelSpec, ProviderId } from "./model-catalog";
import { AppError } from "../middleware/error-handler";

export type ProviderSpec = {
  id: ProviderId;
  baseUrl: string;
  apiKey?: string;
};

export type RouterConfig = {
  /** Provider specs keyed by provider id. Missing/undefined entries are skipped. */
  providers: Partial<Record<ProviderId, ProviderSpec>>;
  /** Failover happens only before the first byte arrives. */
  firstByteTimeoutMs: number;
  fetchImpl?: typeof fetch;
};

export type RoutedResponse = {
  response: Response;
  provider: ProviderId;
  latencyMs: number;
  /** false when the upstream answered 4xx: pass through WITHOUT charging. */
  shouldCharge: boolean;
};

/** The client disconnected — NOT an upstream failure. Must not failover. */
export class ClientDisconnectedError extends Error {
  constructor() {
    super("client disconnected");
    this.name = "ClientDisconnectedError";
  }
}

/** First-byte deadline exceeded for one provider — a normal failover trigger. */
class FirstByteTimeoutError extends Error {
  constructor() {
    super("first-byte timeout");
    this.name = "FirstByteTimeoutError";
  }
}

export function providerSpecsFromEnv(
  env: Record<string, string | number | boolean | undefined>,
): Partial<Record<ProviderId, ProviderSpec>> {
  const specs: Partial<Record<ProviderId, ProviderSpec>> = {};
  for (const id of ["SILICONFLOW", "DEEPSEEK", "ZHIPU", "VOLCENGINE"] as const) {
    const baseUrl = env[`UPSTREAM_${id}_BASE_URL`];
    const apiKey = env[`UPSTREAM_${id}_API_KEY`];
    if (typeof baseUrl === "string" && baseUrl.length > 0) {
      specs[id] = {
        id,
        baseUrl,
        ...(typeof apiKey === "string" && apiKey.length > 0 ? { apiKey } : {}),
      };
    }
  }
  return specs;
}

async function fetchOnce(
  config: RouterConfig,
  provider: ProviderSpec,
  body: string,
  signal?: AbortSignal,
): Promise<Response> {
  const fetchImpl = config.fetchImpl ?? globalThis.fetch;
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (provider.apiKey) headers.authorization = `Bearer ${provider.apiKey}`;

  // Two distinct abort sources, tracked separately so we can tell a client
  // disconnect from a first-byte deadline:
  //   - a client abort -> ClientDisconnectedError (never failover)
  //   - the first-byte timer -> FirstByteTimeoutError (failover)
  const controller = new AbortController();
  let clientAborted = false;
  let timedOut = false;

  const onClientAbort = () => {
    clientAborted = true;
    controller.abort();
  };
  if (signal) {
    if (signal.aborted) {
      clientAborted = true;
      controller.abort();
    } else {
      signal.addEventListener("abort", onClientAbort, { once: true });
    }
  }
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, config.firstByteTimeoutMs);

  try {
    return await fetchImpl(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });
  } catch (err) {
    if (clientAborted) throw new ClientDisconnectedError();
    if (timedOut) throw new FirstByteTimeoutError();
    throw err;
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onClientAbort);
  }
}

export async function routeToUpstream(
  config: RouterConfig,
  model: ModelSpec,
  body: string,
  signal?: AbortSignal,
): Promise<RoutedResponse> {
  let lastError: unknown = null;

  for (const route of model.routes) {
    const provider = config.providers[route.provider];
    if (!provider) continue;

    const started = Date.now();
    try {
      // Each route may map the public model id to a different provider model.
      const response = await fetchOnce(config, provider, remapModel(body, route.upstreamModel), signal);
      // 2xx succeeds; 4xx passes through WITHOUT charge; only 5xx fails over.
      if (response.ok) {
        return {
          response,
          provider: route.provider,
          latencyMs: Date.now() - started,
          shouldCharge: true,
        };
      }
      if (response.status >= 400 && response.status < 500) {
        return {
          response,
          provider: route.provider,
          latencyMs: Date.now() - started,
          shouldCharge: false,
        };
      }
      lastError = new Error(`upstream ${route.provider} returned ${response.status}`);
    } catch (err) {
      // A disconnected client stops everything — do not fail over to a backup
      // for a request nobody is listening to anymore.
      if (err instanceof ClientDisconnectedError) throw err;
      lastError = err;
    }
  }

  console.error("[upstream]", lastError instanceof Error ? lastError.message : String(lastError));
  throw new AppError(502, "upstream_error", "Semua upstream gagal", {
    type: "api_error",
  });
}

function remapModel(body: string, upstreamModel: string): string {
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    parsed.model = upstreamModel;
    return JSON.stringify(parsed);
  } catch {
    return body;
  }
}