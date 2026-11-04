// Offline upstream server used by Batch 3 tests. It lets the proxy be exercised
// end-to-end without ever touching a paid provider.

export function jsonUpstream(opts?: { chunks?: string[]; usage?: object }): Response {
  const content = (opts?.chunks ?? ["hello"]).join("");
  const usage = opts?.usage ?? {
    prompt_tokens: 10,
    completion_tokens: 5,
    total_tokens: 15,
  };
  return new Response(
    JSON.stringify({
      id: "cmpl-mock",
      object: "chat.completion",
      created: 0,
      model: "mock-model",
      choices: [
        { index: 0, message: { role: "assistant", content }, finish_reason: "stop" },
      ],
      usage,
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

export function sseUpstream(chunks: string[], usage: object): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ choices: [], usage })}\n\ndata: [DONE]\n\n`,
        ),
      );
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

export type MockUpstream = {
  port: number;
  url: string;
  count: () => number;
  stop: () => void;
};

export type MockHandler = (req: Request) => Response | Promise<Response>;

export function startMockUpstream(handler: MockHandler): MockUpstream {
  let count = 0;
  const server = Bun.serve({
    port: 0,
    fetch(req) {
      count += 1;
      return handler(req);
    },
  });

  return {
    port: server.port as number,
    url: `http://127.0.0.1:${server.port}`,
    count: () => count,
    stop: () => server.stop(true),
  };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
