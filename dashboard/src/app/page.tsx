"use client";

import { useState, useEffect } from "react";

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

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string>("");

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
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: 20, fontFamily: "system-ui" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1>Luminal Dashboard</h1>
        <button onClick={() => { localStorage.removeItem("luminal_token"); window.location.reload(); }} style={{ padding: "8px 16px", background: "#dc2626", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>
          Logout
        </button>
      </header>

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
          <p>No logs yet. Send a request to /route to see logs here.</p>
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