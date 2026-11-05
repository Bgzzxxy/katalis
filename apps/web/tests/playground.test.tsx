import { afterEach, describe, expect, test } from "bun:test";
import { setupDom } from "./setup";
setupDom();
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PlaygroundPanel } from "../src/components/docs/PlaygroundPanel";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("PlaygroundPanel", () => {
  test("sends an OpenAI-shaped request and shows status + latency", async () => {
    let captured: { url: string; body: unknown; auth: string | null } | null = null;
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      captured = {
        url: String(url),
        body: JSON.parse(String(init.body)),
        auth: (init.headers as Record<string, string>)["Authorization"] ?? null,
      };
      return new Response(
        JSON.stringify({
          id: "cmpl-1",
          choices: [{ message: { role: "assistant", content: "hi" } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as unknown as typeof fetch;

    render(<PlaygroundPanel />);

    fireEvent.change(screen.getByLabelText("API key playground"), {
      target: { value: "sk-ktl-TESTKEY" },
    });
    fireEvent.click(screen.getByText("Kirim Request"));

    await waitFor(() => expect(screen.getByText(/HTTP 200/)).toBeTruthy());

    expect(captured!.url).toBe("/v1/chat/completions");
    expect(captured!.auth).toBe("Bearer sk-ktl-TESTKEY");
    expect((captured!.body as { model: string }).model).toBe("deepseek-v4-pro");
    expect(screen.getByText(/ms$/)).toBeTruthy();
  });
});