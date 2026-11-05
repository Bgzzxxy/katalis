// QA (independent): Session plumbing edge cases the happy path misses.
// (a) a network failure (not a 401) must surface an error state, not a silent
//     "logged out"; (b) logout must clear the user so the guard redirects.
import { afterEach, describe, expect, test } from "bun:test";
import { setupDom } from "../setup";
setupDom();
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "../../src/hooks/useAuth";
import { RequireAuth } from "../../src/components/RequireAuth";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mockSessionOnce(handler: () => Response | Promise<Response>) {
  globalThis.fetch = (async () => handler()) as unknown as typeof fetch;
}

describe("QA useAuth session edge cases", () => {
  test("session fetch network failure -> protected route still redirects to login", async () => {
    mockSessionOnce(() => {
      throw new TypeError("Failed to fetch");
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/keys"]}>
          <Routes>
            <Route path="/auth/login" element={<div>LOGIN PAGE</div>} />
            <Route
              path="/keys"
              element={
                <RequireAuth>
                  <div>KEYS PAGE</div>
                </RequireAuth>
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByText("LOGIN PAGE")).toBeTruthy());
    expect(screen.queryByText("KEYS PAGE")).toBeNull();
  });

  test("logout clears the user and flips status to empty", async () => {
    let phase = 0;
    globalThis.fetch = (async (url: string) => {
      if (String(url).includes("/logout")) {
        phase = 2;
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      // 1st call: session populated; later calls: unauthenticated
      if (phase === 0) {
        phase = 1;
        return new Response(
          JSON.stringify({
            id: "u1",
            email: "dev@katalis.id",
            wallet_balance_idr: 64250,
            unlimited_expires_at: null,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("", { status: 401 });
    }) as unknown as typeof fetch;

    let api: ReturnType<typeof useAuth> | null = null;
    function Probe() {
      api = useAuth();
      return <div data-testid="status">{api.status}</div>;
    }

    render(
      <AuthProvider>
        <MemoryRouter>
          <Probe />
        </MemoryRouter>
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("populated"));
    await api!.logout();
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("empty"));
    expect(api!.user).toBeNull();
  });
});
