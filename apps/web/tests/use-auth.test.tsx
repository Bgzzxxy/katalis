import { afterEach, describe, expect, test } from "bun:test";
import { setupDom } from "./setup";
setupDom();
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "../src/hooks/useAuth";
import { RequireAuth } from "../src/components/RequireAuth";

const originalFetch = globalThis.fetch;

function mockSession(status: number, body: unknown) {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    })) as unknown as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function app() {
  return (
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
    </AuthProvider>
  );
}

describe("useAuth + RequireAuth guard", () => {
  test("redirects unauthenticated visitors to login", async () => {
    mockSession(401, {
      error: { message: "Sesi tidak valid", type: "auth_error", param: null, code: "UNAUTHENTICATED" },
    });
    render(app());
    await waitFor(() => expect(screen.getByText("LOGIN PAGE")).toBeTruthy());
  });

  test("renders protected children for a valid session", async () => {
    mockSession(200, {
      id: "u1",
      email: "dev@katalis.id",
      wallet_balance_idr: 64250,
      unlimited_expires_at: null,
    });
    render(app());
    await waitFor(() => expect(screen.getByText("KEYS PAGE")).toBeTruthy());
  });
});