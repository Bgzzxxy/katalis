// Browser->API access is same-origin (Vite proxies /api and /v1 in dev, and a
// reverse proxy in prod) with credentials so the httpOnly session cookie is
// sent automatically. Every backend error is an OpenAI-shaped envelope
// (Design.md §5.5 / app.ts), parsed here into a typed ApiError.

import { ApiError } from "./types";
import type {
  OPENAI_ERROR_SHAPE,
  User,
  Telemetry,
  ApiKeyView,
  CreatedKey,
  InvoiceView,
  InvoiceStatusView,
} from "./types";

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    let body: OPENAI_ERROR_SHAPE | null = null;
    try {
      body = (await res.json()) as OPENAI_ERROR_SHAPE;
    } catch {
      // Non-JSON error body (reverse proxy HTML). Generic envelope below.
    }

    const message =
      body?.error?.message ??
      (res.status === 401 ? "Autentikasi diperlukan" : "Terjadi kesalahan");
    const code = body?.error?.code ?? `HTTP_${res.status}`;
    const apiType =
      body?.error?.type ?? (res.status >= 500 ? "api_error" : "invalid_request_error");
    throw new ApiError(res.status, code, message, apiType, body?.error?.param ?? null);
  }

  return (await res.json()) as T;
}

export function fetchTelemetry(): Promise<Telemetry> {
  return apiFetch<Telemetry>("/api/telemetry");
}

export function fetchKeys(): Promise<ApiKeyView[]> {
  return apiFetch<ApiKeyView[]>("/api/keys");
}

export function createKey(name?: string): Promise<CreatedKey> {
  return apiFetch<CreatedKey>("/api/keys", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function setSpendLimit(keyId: string, spendLimitIdr: number | null): Promise<ApiKeyView> {
  return apiFetch<ApiKeyView>(`/api/keys/${keyId}/spend-limit`, {
    method: "PUT",
    body: JSON.stringify({ spend_limit_idr: spendLimitIdr }),
  });
}

export function setKeyActive(keyId: string, active: boolean): Promise<ApiKeyView> {
  return apiFetch<ApiKeyView>(`/api/keys/${keyId}/${active ? "resume" : "pause"}`, {
    method: "POST",
  });
}

export function revokeKey(keyId: string): Promise<{ id: string; deleted: boolean }> {
  return apiFetch<{ id: string; deleted: boolean }>(`/api/keys/${keyId}`, {
    method: "DELETE",
  });
}

export function login(email: string, password: string): Promise<User> {
  return apiFetch<User>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function register(email: string, password: string): Promise<User> {
  return apiFetch<User>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function logout(): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>("/api/auth/logout", { method: "POST" });
}

export function createInvoice(
  planType: string,
  customAmountIdr?: number,
): Promise<InvoiceView> {
  return apiFetch<InvoiceView>("/api/billing/invoices", {
    method: "POST",
    body: JSON.stringify({
      plan_type: planType,
      custom_amount_idr: customAmountIdr,
    }),
  });
}

export function fetchInvoiceStatus(invoiceId: string): Promise<InvoiceStatusView> {
  return apiFetch<InvoiceStatusView>(`/api/billing/invoices/${invoiceId}/status`);
}