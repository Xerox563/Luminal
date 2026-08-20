"use client";

import { useState, useEffect, useRef } from "react";

interface DashboardStats {
  today: {
    requests: number;
    cost: number;
    tokens: number;
    avg_latency_ms: number;
  };
  month: {
    requests: number;
    cost: number;
    tokens: number;
    budget: number;
    budget_remaining: number;
  };
  by_model: Array<{
    model: string;
    requests: number;
    cost: number;
    tokens: number;
  }>;
}

interface LogEntry {
  id: number;
  prompt: string;
  model_used: string;
  complexity: string | null;
  total_tokens: number;
  cost: number;
  latency_ms: number;
  quality_score: number | null;
  error_message: string | null;
  created_at: string;
}

interface TraceEntry {
  node: string;
  action: string;
  timestamp: string;
  data: Record<string, unknown>;
}

interface RouteResponse {
  content: string;
  model: string;
  complexity: string;
  tokens_used: number;
  cost: number;
  latency_ms: number;
  session_id: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string>("");
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [traceEntries, setTraceEntries] = useState<TraceEntry[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [showTerminal, setShowTerminal] = useState(true);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem("luminal_token");
    if (savedToken) {
      setToken(savedToken);
      fetchStats();
      fetchLogs();
    }
  }, []);

  const fetchStats = async () => {
    if (!token) return;
    try {
      const res = await fetch("http://localhost:8000/dashboard/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error("Failed to fetch stats", e);
    }
  };

  const fetchLogs = async () => {
    if (!token) return;
    try {
      const res = await fetch("http://localhost:8000/dashboard/logs", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (e) {
      console.error("Failed to fetch logs", e);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const res = await fetch("http://localhost:8000/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ username: email, password }),
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("luminal_token", data.access_token);
        setToken(data.access_token);
        fetchStats();
        fetchLogs();
      } else {
        alert("Login failed");
      }
    } catch (e) {
      console.error("Login error", e);
    }
  };

  const connectTrace = (sessionId: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    setTraceEntries([]);
    setCurrentSessionId(sessionId);

    const es = new EventSource(`http://localhost:8000/route/trace/${sessionId}`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.done) {
          es.close();
          eventSourceRef.current = null;
        } else {
          setTraceEntries(prev => [...prev, data]);
        }
      } catch (e) {
        console.error("Trace parse error", e);
      }
    };

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
    };
  };

  const handleSendPrompt = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!prompt.trim() || !token) return;

    setSending(true);
    setResponse(null);
    setTraceEntries([]);
    setCurrentSessionId(null);

    try {
      const res = await fetch("http://localhost:8000/route", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt, api_key: "" }), // api_key not needed with JWT
      });

      if (res.ok) {
        const data: RouteResponse = await res.json();
        setResponse(data.content);
        connectTrace(data.session_id);
        fetchStats();
        fetchLogs();
      } else {
        const error = await res.json();
        setResponse(`Error: ${error.detail || "Request failed"}`);
      }
    } catch (e) {
      setResponse(`Error: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setSending(false);
    }
  };

  const clearTerminal = () => {
    setTraceEntries([]);
    setCurrentSessionId(null);
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  };

  if (!token) {
    return (
      <div style={{ maxWidth: 400, margin: "50px auto", padding: 20, fontFamily: "system-ui" }}>
        <h1>Luminal Dashboard</h1>
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 4 }}>Email</label>
            <input name="email" type="email" required style={{ width: "100%", padding: 8, boxSizing: "border-box" }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 4 }}>Password</label>
            <input name="password" type="password" required style={{ width: "100%", padding: 8, boxSizing: "border-box" }} />
          </div>
          <button type="submit" style={{ width: "100%", padding: 10, background: "#0070f3", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>
            Login
          </button>
        </form>
      </div>
    );
  }

  if (loading) {
    return <div style={{ padding: 20 }}>Loading...</div>;
  }

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: 20, fontFamily: "system-ui" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1>Luminal Dashboard</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ fontSize: 14, color: "#6b7280" }}>
            <input type="checkbox" checked={showTerminal} onChange={e => setShowTerminal(e.target.checked)} style={{ marginRight: 6 }} />
            Live Terminal
          </label>
          <button onClick={() => { localStorage.removeItem("luminal_token"); window.location.reload(); }} style={{ padding: "8px 16px", background: "#dc2626", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>
            Logout
          </button>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: showTerminal ? "1fr 400px" : "1fr", gap: 24 }}>
        <div>
          <section style={{ marginBottom: 24 }}>
            <h2 style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              Send Prompt
              <span style={{ fontSize: 12, color: "#6b7280", fontWeight: "normal" }}>Powered by LangGraph Agent</span>
            </h2>
            <form onSubmit={handleSendPrompt} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="Enter your prompt... (e.g., 'What is the capital of France?' or 'Analyze AI impact on jobs')"
                rows={3}
                style={{ padding: 12, borderRadius: 8, border: "1px solid #e5e7eb", fontFamily: "inherit", fontSize: 14, resize: "vertical" }}
                disabled={sending}
              />
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button
                  type="submit"
                  disabled={sending || !prompt.trim()}
                  style={{
                    padding: "10px 24px",
                    background: sending ? "#9ca3af" : "#0070f3",
                    color: "white",
                    border: "none",
                    borderRadius: 4,
                    cursor: sending ? "not-allowed" : "pointer",
                    fontWeight: 500
                  }}
                >
                  {sending ? "Processing..." : "Send Prompt"}
                </button>
                <button
                  type="button"
                  onClick={clearTerminal}
                  style={{ padding: "10px 24px", background: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb", borderRadius: 4, cursor: "pointer" }}
                >
                  Clear Terminal
                </button>
              </div>
            </form>
          </section>

          {response && (
            <section style={{ marginBottom: 24 }}>
              <h3>Response</h3>
              <div style={{
                background: "#f9fafb",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: 16,
                whiteSpace: "pre-wrap",
                fontSize: 14,
                lineHeight: 1.6
              }}>
                {response}
              </div>
            </section>
          )}

          {stats && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
              <StatCard title="Today's Requests" value={stats.today.requests} />
              <StatCard title="Today's Cost" value={`$${stats.today.cost.toFixed(4)}`} />
              <StatCard title="Today's Tokens" value={stats.today.tokens.toLocaleString()} />
              <StatCard title="Avg Latency" value={`${stats.today.avg_latency_ms.toFixed(0)}ms`} />
              <StatCard title="Monthly Requests" value={stats.month.requests} />
              <StatCard title="Monthly Cost" value={`$${stats.month.cost.toFixed(4)}`} />
              <StatCard title="Budget Remaining" value={`$${Math.max(0, stats.month.budget_remaining).toFixed(2)}`} />
            </div>
          )}

          {stats && stats.by_model.length > 0 && (
            <section style={{ marginBottom: 24 }}>
              <h2>Cost by Model (This Month)</h2>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>
                    <th style={{ padding: 8 }}>Model</th>
                    <th style={{ padding: 8 }}>Requests</th>
                    <th style={{ padding: 8 }}>Cost</th>
                    <th style={{ padding: 8 }}>Tokens</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.by_model.map((m) => (
                    <tr key={m.model} style={{ borderBottom: "1px solid #e5e7eb" }}>
                      <td style={{ padding: 8 }}>{m.model}</td>
                      <td style={{ padding: 8 }}>{m.requests}</td>
                      <td style={{ padding: 8 }}>${m.cost.toFixed(6)}</td>
                      <td style={{ padding: 8 }}>{m.tokens.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <section>
            <h2>Recent Logs</h2>
            {logs.length === 0 ? (
              <p>No logs yet. Send a request to see logs here.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>
                    <th style={{ padding: 8 }}>Time</th>
                    <th style={{ padding: 8 }}>Prompt</th>
                    <th style={{ padding: 8 }}>Model</th>
                    <th style={{ padding: 8 }}>Complexity</th>
                    <th style={{ padding: 8 }}>Tokens</th>
                    <th style={{ padding: 8 }}>Cost</th>
                    <th style={{ padding: 8 }}>Latency</th>
                    <th style={{ padding: 8 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                      <td style={{ padding: 8 }}>{new Date(log.created_at).toLocaleString()}</td>
                      <td style={{ padding: 8, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.prompt}</td>
                      <td style={{ padding: 8 }}>{log.model_used}</td>
                      <td style={{ padding: 8 }}>{log.complexity || "-"}</td>
                      <td style={{ padding: 8 }}>{log.total_tokens.toLocaleString()}</td>
                      <td style={{ padding: 8 }}>${log.cost.toFixed(6)}</td>
                      <td style={{ padding: 8 }}>{log.latency_ms}ms</td>
                      <td style={{ padding: 8, color: log.error_message ? "#dc2626" : "#16a34a" }}>
                        {log.error_message ? "Error" : "Success"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>

        {showTerminal && (
          <div style={{ 
            background: "#1e1e1e", 
            borderRadius: 8, 
            height: "calc(100vh - 140px)", 
            maxHeight: "calc(100vh - 140px)",
            display: "flex", 
            flexDirection: "column",
            border: "1px solid #333"
          }}>
            <div style={{ 
              padding: "12px 16px", 
              background: "#252526", 
              borderBottom: "1px solid #333",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <span style={{ color: "#cccccc", fontFamily: "monospace", fontSize: 13 }}>▶ LIVE AGENT TRACE</span>
              <span style={{ 
                fontSize: 11, 
                color: currentSessionId ? "#4ade80" : "#f87171",
                display: "flex",
                alignItems: "center",
                gap: 6
              }}>
                {currentSessionId ? (
                  <>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80" }}></span>
                    CONNECTED
                  </>
                ) : (
                  <>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f87171" }}></span>
                    WAITING
                  </>
                )}
              </span>
            </div>
            <div style={{ 
              flex: 1, 
              overflow: "auto", 
              padding: 12,
              fontFamily: "'Fira Code', 'Monaco', 'Consolas', monospace",
              fontSize: 12,
              lineHeight: 1.5
            }}>
              {traceEntries.length === 0 ? (
                <div style={{ color: "#666", padding: 20, textAlign: "center" }}>
                  {currentSessionId ? "Waiting for agent events..." : "Send a prompt to see live trace"}
                </div>
              ) : (
                traceEntries.map((entry, idx) => (
                  <TraceLine key={idx} entry={entry} />
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TraceLine({ entry }: { entry: TraceEntry }) {
  const getColor = (node: string) => {
    const colors: Record<string, string> = {
      analyze: "#60a5fa",
      retrieve: "#a78bfa",
      tool: "#fbbf24",
      route: "#34d399",
      generate: "#f87171",
      critic: "#f472b6",
      approval: "#fb923c",
      error_recovery: "#ef4444",
    };
    return colors[node] || "#9ca3af";
  };

  const nodeColor = getColor(entry.node);
  const time = new Date(entry.timestamp).toLocaleTimeString();

  return (
    <div style={{ marginBottom: 4, borderLeft: `3px solid ${nodeColor}`, paddingLeft: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
        <span style={{ color: "#6b7280", fontSize: 11 }}>{time}</span>
        <span style={{ 
          color: nodeColor, 
          fontWeight: 600, 
          textTransform: "uppercase",
          fontSize: 11,
          background: `${nodeColor}22`,
          padding: "1px 6px",
          borderRadius: 3
        }}>
          {entry.node}
        </span>
        <span style={{ color: "#d1d5db", fontSize: 12 }}>{entry.action}</span>
      </div>
      {Object.keys(entry.data).length > 0 && (
        <div style={{ marginTop: 2, paddingLeft: 16, color: "#9ca3af", fontSize: 11 }}>
          {Object.entries(entry.data).map(([k, v]) => (
            <span key={k} style={{ marginRight: 12 }}>
              <span style={{ color: "#6b7280" }}>{k}:</span> {String(v).slice(0, 100)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string | number }) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, background: "white" }}>
      <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 24, fontWeight: 600 }}>{value}</div>
    </div>
  );
}