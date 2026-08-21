export interface DashboardStats {
  today: { requests: number; cost: number; tokens: number; avg_latency_ms: number };
  month: { requests: number; cost: number; tokens: number; budget: number; budget_remaining: number };
  by_model: Array<{ model: string; requests: number; cost: number; tokens: number }>;
}

export interface LogEntry {
  id: number;
  prompt: string;
  model_used: string;
  complexity: string | null;
  total_tokens: number;
  cost: number;
  latency_ms: number;
  quality_score: number | null;
  error_message: string | null;
  retrieval_metadata: Record<string, unknown> | null;
  tool_metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface TraceEntry {
  node: string;
  action: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface RouteResponse {
  content: string;
  model: string;
  complexity: string;
  tokens_used: number;
  cost: number;
  latency_ms: number;
  session_id: string;
}

export interface BudgetInfo {
  monthly_budget: number;
  current_spend: number;
  remaining: number;
  percent_used: number;
  is_over_budget: boolean;
  alert_threshold_80: boolean;
  alert_threshold_95: boolean;
}

export interface ApiKey {
  id: number;
  key: string;
  name: string;
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
}

export interface DailyPoint {
  date: string;
  requests: number;
  cost: number;
  tokens: number;
}

export interface ModelPerf {
  model: string;
  requests: number;
  cost: number;
  tokens: number;
  avg_latency_ms: number;
  avg_quality_score: number | null;
  error_rate: number;
}

export interface RagStats {
  rag: {
    requests: number;
    non_rag_requests: number;
    rag_percentage: number;
    avg_latency_ms: number;
    non_rag_avg_latency_ms: number;
    avg_cost: number;
    non_rag_avg_cost: number;
  };
  tools: {
    requests: number;
    non_tool_requests: number;
    tool_percentage: number;
    avg_latency_ms: number;
  };
}

export interface CostBreakdown {
  daily: DailyPoint[];
  by_complexity: Array<{ complexity: string; requests: number; cost: number; avg_latency_ms: number }>;
  by_provider: Array<{ provider: string; requests: number; cost: number }>;
}

export interface UserInfo {
  id: number;
  email: string;
  is_active: boolean;
  monthly_budget: number;
  current_spend: number;
}