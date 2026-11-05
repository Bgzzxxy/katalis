export type UsageHistoryItem = {
  id: number;
  created_at: string;
  model_id: string;
  pool_tier: string;
  upstream_provider: string;
  prompt_tokens: number;
  completion_tokens: number;
  cost_idr: number;
  latency_ms: number;
  http_status: number;
  api_key_id: string;
  api_key_name: string;
};

export type UsageHistory = {
  items: UsageHistoryItem[];
  total: number;
  limit: number;
  offset: number;
};

export type DailyUsageSummary = {
  date: string;
  tokens: number;
  cost_idr: number;
  requests: number;
};

export type ModelUsageSummary = {
  model_id: string;
  requests: number;
  tokens: number;
  cost_idr: number;
};

export type UsageSummary = {
  range_days: number;
  total_tokens: number;
  total_cost_idr: number;
  total_requests: number;
  daily: DailyUsageSummary[];
  by_model: ModelUsageSummary[];
};
