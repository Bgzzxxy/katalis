// No fabricated status: the playground header badge must reflect the outcome of
// the last request, and non-2xx envelopes must route to the error pane with the
// backend's own code/message instead of an empty assistant bubble.
import { afterEach, describe, expect, test } from "bun:test";
import { setupDom } from "./setup";
setupDom();
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PlaygroundPanel } from "../src/components/docs/PlaygroundPanel";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function renderPanel() {
  render(<PlaygroundPanel />);
  fireEvent.change(screen.getByLabelText("API key playground"), {
    target: { value: "sk-ktl-TEST" },
  });
  fireEvent.click(screen.getByText("Kirim Request"));
}

describe("PlaygroundPanel status badge", () => {
  test("shows GATEWAY ERROR and the backend error code when the request is rejected", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          error: {
            message: "Batas pengeluaran API key tercapai",
            type: "insufficient_quota",
            param: null,
            code: "spend_limit_reached",
          },
        }),
        { status: 402, headers: { "content-type": "application/json" } },
      )) as unknown as typeof fetch;

    renderPanel();

    await waitFor(() => {
      expect(screen.getByTestId("playground-status").textContent).toBe("GATEWAY ERROR");
    });
    expect(screen.getByTestId("data-error").textContent).toContain("spend_limit_reached");
    expect(screen.getByTestId("data-error").textContent).toContain(
      "Batas pengeluaran API key tercapai",
    );
  });

  test("stays GATEWAY ONLINE for a successful completion", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "Halo dari Katalis." } }],
          usage: { prompt_tokens: 12, completion_tokens: 4, total_tokens: 16 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      )) as unknown as typeof fetch;

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText("Halo dari Katalis.")).toBeTruthy();
    });
    expect(screen.getByTestId("playground-status").textContent).toBe("GATEWAY ONLINE");
    expect(screen.queryByTestId("data-error")).toBeNull();
  });
});
