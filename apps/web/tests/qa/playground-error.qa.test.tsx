// QA (independent): the PlaygroundPanel must parse a real OpenAI error envelope
// (HTTP 401) into the JSON panel instead of crashing, and must not require a
// valid key format (any non-empty string is sendable).
import { afterEach, describe, expect, test } from "bun:test";
import { setupDom } from "../setup";
setupDom();
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PlaygroundPanel } from "../../src/components/docs/PlaygroundPanel";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("QA PlaygroundPanel error handling", () => {
  test("renders an OpenAI error envelope with its HTTP status, no crash", async () => {
    globalThis.fetch = (async () =>
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
      )) as unknown as typeof fetch;

    render(<PlaygroundPanel />);
    fireEvent.change(screen.getByLabelText("API key playground"), {
      target: { value: "sk-ktl-BAD" },
    });
    fireEvent.click(screen.getByText("Kirim Request"));

    await waitFor(() => expect(screen.getByText(/HTTP 401/)).toBeTruthy());
    // The parsed JSON body is shown verbatim.
    await waitFor(() => expect(screen.getByText(/INVALID_API_KEY/)).toBeTruthy());
  });

  test("network failure shows the error state, not a stale success", async () => {
    globalThis.fetch = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;

    render(<PlaygroundPanel />);
    fireEvent.change(screen.getByLabelText("API key playground"), {
      target: { value: "sk-ktl-X" },
    });
    fireEvent.click(screen.getByText("Kirim Request"));

    await waitFor(() => expect(screen.getByText("NETWORK_ERROR")).toBeTruthy());
    expect(screen.getByText("Tidak dapat menghubungi gateway")).toBeTruthy();
  });
});
