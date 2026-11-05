// Shared API/domain types for the web client. All money values are IDR
// (already decoded from fixed-point by the backend), timestamps are Date | null
// after JSON parsing or raw strings before parsing.

export type User = {
  id: string;
  email: string;
  wallet_balance_idr: number;
  unlimited_expires_at: string | null;
};

export type ApiKeyView = {
  id: string;
  name: string;
  key_prefix: string;
  spend_limit_idr: number | null;
  spent_idr: number;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
};

export type CreatedKey = ApiKeyView & { key: string };

export type InvoiceView = {
  id: string;
  plan_type: "PREPAID" | "UNLIMITED_10D" | "TRIAL_1D";
  total_pay_idr: number;
  qris_string: string;
  status: string;
  expires_at: string;
};

export type InvoiceStatusView = {
  id: string;
  plan_type: string;
  status: string;
  total_pay_idr: number;
  paid_at: string | null;
};

export type Telemetry = {
  connection: { ok: boolean; latency_ms: number };
  total_tokens: number;
  requests_per_second: number;
  avg_latency_ms: number;
  pools: Array<{ tier: "LORA" | "STABLE" | "FLEX"; recent_requests: number; load_pct: number }>;
  window: Array<{ t: number; tokens: number; requests: number }>;
};

export type DailyUsage = {
  date: string;
  tokens_used: number;
  amount_spent_idr: number;
};

export type OPENAI_ERROR_SHAPE = {
  error: { message: string; type: string; param: string | null; code: string };
};

export type DataStatus = "loading" | "empty" | "error" | "populated";

export class ApiError extends Error {
  status: number;
  code: string;
  apiType: string;
  param: string | null;
  cause?: unknown;

  constructor(
    status: number,
    code: string,
    message: string,
    apiType = "api_error",
    param: string | null = null,
    cause?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.apiType = apiType;
    this.param = param;
    this.cause = cause;
  }

  /** Compact technical label shown inside DataState error panels. */
  get errorCodeLabel(): string {
    return this.status === 0 ? "NETWORK_ERROR" : `HTTP ${this.status} · ${this.code}`;
  }
}