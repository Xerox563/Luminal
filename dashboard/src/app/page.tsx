"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type {
  ApiKey,
  BudgetInfo,
  DashboardStats,
  DailyPoint,
  LogEntry,
  ModelPerf,
  RagStats,
} from "@/lib/types";
import { API_URL } from "@/lib/api";
import {
  StatCard,
  Toast,
  BootLoader,
  LoginScreen,
  ghostBtn,
  easeOutExpo,
} from "@/components/ui";
import { CostTrendChart, BudgetPanel } from "@/components/charts";
import { RagPanel, ModelPerfPanel } from "@/components/panels";
import { PromptSection } from "@/components/prompt";
import { ApiKeysSection, LogsSection } from "@/components/logs";
import { SettingsSection } from "@/components/settings";

const EMPTY_SETTINGS = {
  openrouter_api_key: "",
  openai_api_key: "",
  anthropic_api_key: "",
  deepseek_api_key: "",
  openrouter_base_url: "",
  openai_base_url: "",
  anthropic_base_url: "",
  deepseek_base_url: "",
  ollama_base_url: "",
  use_llm_complexity: "false",
};

const STAT_ICONS = {
  requests: "M3 12h4l3-8 4 16 3-8h4",
  cost: "M12 2v20M17 6c0-2.2-2.2-3.5-5-3.5S7 3.8 7 6s2 3.4 5 3.5c3 .1 5 1.6 5 3.5s-2.2 3.5-5 3.5S7 14 7 12",
  tokens: "M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2z",
  latency: "M13 2 4 14h6l-1 8 9-12h-6l1-8z",
  calendar: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  wallet: "M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-8l-2-2H5a2 2 0 0 0-2 2zM12 12v6M9 15h6",
  trend: "M3 17l6-6 4 4 8-8M21 7v6",
};

const STAT_COLORS = {
  requests: "#60a5fa",
  cost: "#a855f7",
  tokens: "#34d399",
  latency: "#fbbf24",
  calendar: "#f472b6",
  wallet: "#818cf8",
  trend: "#38bdf8",
};

export default function Dashboard() {
  const [token, setToken] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [connected, setConnected] = useState(false);

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [budget, setBudget] = useState<BudgetInfo | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [daily, setDaily] = useState<DailyPoint[]>([]);
  const [modelPerf, setModelPerf] = useState<ModelPerf[]>([]);
  const [ragStats, setRagStats] = useState<RagStats | null>(null);
  const [settings, setSettings] = useState(EMPTY_SETTINGS);

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const tokenRef = useRef<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem("luminal_token");
    tokenRef.current = null;
    setToken(null);
    setStats(null);
    setLogs([]);
    setBudget(null);
    setApiKeys([]);
    setDaily([]);
    setModelPerf([]);
    setRagStats(null);
    setBooting(false);
  }, []);

  const loadAll = useCallback(
    async (silent = false) => {
      const t = tokenRef.current;
      if (!t) return;
      if (!silent) setLoading(true);
      try {
        const [s, l, b, c, mp, r, st] = await Promise.all([
          fetch(`${API_URL}/dashboard/stats`, { headers: { Authorization: `Bearer ${t}` } }),
          fetch(`${API_URL}/dashboard/logs?limit=60`, { headers: { Authorization: `Bearer ${t}` } }),
          fetch(`${API_URL}/dashboard/budget`, { headers: { Authorization: `Bearer ${t}` } }),
          fetch(`${API_URL}/dashboard/cost-breakdown?days=30`, {
            headers: { Authorization: `Bearer ${t}` },
          }),
          fetch(`${API_URL}/dashboard/model-performance?days=30`, {
            headers: { Authorization: `Bearer ${t}` },
          }),
          fetch(`${API_URL}/dashboard/rag-stats?days=30`, {
            headers: { Authorization: `Bearer ${t}` },
          }),
          fetch(`${API_URL}/dashboard/settings`, { headers: { Authorization: `Bearer ${t}` } }),
        ]);
        if (!s.ok) throw new Error("auth");
        setStats(await s.json());
        setLogs(await l.json());
        setBudget(await b.json());
        setDaily((await c.json()).daily);
        setModelPerf(await mp.json());
        setRagStats(await r.json());
        if (st.ok) setSettings(await st.json());
        setConnected(true);
      } catch (e) {
        if (e instanceof Error && e.message === "auth") {
          handleLogout();
          return;
        }
        setConnected(false);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [handleLogout]
  );

  const loadKeys = useCallback(async () => {
    const t = tokenRef.current;
    if (!t) return;
    try {
      const res = await fetch(`${API_URL}/api-keys`, { headers: { Authorization: `Bearer ${t}` } });
      if (res.ok) setApiKeys(await res.json());
    } catch {
      /* silent */
    }
  }, []);

  const handleLogin = useCallback(
    (t: string) => {
      localStorage.setItem("luminal_token", t);
      tokenRef.current = t;
      setToken(t);
      loadAll();
      loadKeys();
    },
    [loadAll, loadKeys]
  );

  // Boot: restore session
  useEffect(() => {
    const saved = localStorage.getItem("luminal_token");
    if (!saved) {
      setBooting(false);
      return;
    }
    tokenRef.current = saved;
    fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${saved}` } })
      .then((r) => {
        if (r.ok) {
          setToken(saved);
          loadAll();
          loadKeys();
        } else {
          localStorage.removeItem("luminal_token");
          tokenRef.current = null;
        }
      })
      .catch(() => setConnected(false))
      .finally(() => setBooting(false));
  }, [loadAll, loadKeys]);

  // Auto-refresh every 45s
  useEffect(() => {
    if (!token) return;
    const id = setInterval(() => loadAll(true), 45000);
    return () => clearInterval(id);
  }, [token, loadAll]);

  if (booting) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <BootLoader />
      </div>
    );
  }

  if (!token) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div style={{ minHeight: "100vh", color: "#e4e4e7" }}>
      <div className="bg-glow top" />
      <div className="bg-glow right" />
      <div className="bg-grid" />

      <Toast toast={toast} />

      <Header connected={connected} budget={budget} onRefresh={() => loadAll(true)} onLogout={handleLogout} />

      <main style={{ maxWidth: 1440, margin: "0 auto", padding: "24px 32px 80px" }}>
        {/* Stat cards */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="skel"
              exit={{ opacity: 0 }}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
                gap: 14,
              }}
            >
              {[...Array(7)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 110, borderRadius: 18 }} />
              ))}
            </motion.div>
          ) : stats ? (
            <motion.div
              key="stats"
              initial="hidden"
              animate="show"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
                gap: 14,
              }}
            >
              <StatCard i={0} label="Requests Today" value={stats.today.requests} fmt={(v) => v.toLocaleString()} icon={STAT_ICONS.requests} accent={STAT_COLORS.requests} />
              <StatCard i={1} label="Cost Today" value={stats.today.cost} fmt={(v) => `$${v >= 1000 ? v.toFixed(2) : v.toFixed(4)}`} icon={STAT_ICONS.cost} accent={STAT_COLORS.cost} />
              <StatCard i={2} label="Tokens Today" value={stats.today.tokens} fmt={(v) => v.toLocaleString()} icon={STAT_ICONS.tokens} accent={STAT_COLORS.tokens} />
              <StatCard i={3} label="Avg Latency" value={stats.today.avg_latency_ms} fmt={(v) => `${Math.round(v)}ms`} icon={STAT_ICONS.latency} accent={STAT_COLORS.latency} />
              <StatCard i={4} label="Monthly Cost" value={stats.month.cost} fmt={(v) => `$${v >= 1000 ? v.toFixed(2) : v.toFixed(4)}`} icon={STAT_ICONS.calendar} accent={STAT_COLORS.calendar} />
              <StatCard i={5} label="Budget Left" value={Math.max(0, stats.month.budget_remaining)} fmt={(v) => `$${v.toFixed(2)}`} icon={STAT_ICONS.wallet} accent={STAT_COLORS.wallet} />
              <StatCard i={6} label="Requests / Month" value={stats.month.requests} fmt={(v) => v.toLocaleString()} icon={STAT_ICONS.trend} accent={STAT_COLORS.trend} />
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Charts row */}
        {!loading && stats && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.5, ease: easeOutExpo }}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)",
              gap: 16,
              marginTop: 16,
            }}
          >
            <CostTrendChart daily={daily} />
            <BudgetPanel
              budget={budget}
              token={token}
              onSaved={(b) => {
                setBudget(b);
                notify("Budget updated");
              }}
            />
          </motion.div>
        )}

        {/* RAG + Models */}
        {!loading && stats && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.5, ease: easeOutExpo }}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.6fr)",
              gap: 16,
              marginTop: 16,
            }}
          >
            <RagPanel rag={ragStats} />
            <ModelPerfPanel data={modelPerf} />
          </motion.div>
        )}

        {/* Prompt tester + live terminal */}
        {!loading && <PromptSection token={token} onComplete={() => loadAll(true)} />}

        {/* Provider settings */}
        <SettingsSection token={token} settings={settings} setSettings={setSettings} notify={notify} />

        {/* API keys + logs */}
        <ApiKeysSection token={token} keys={apiKeys} setKeys={setApiKeys} notify={notify} />
        <LogsSection logs={logs} />
      </main>
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────
function Header({
  connected,
  budget,
  onRefresh,
  onLogout,
}: {
  connected: boolean;
  budget: BudgetInfo | null;
  onRefresh: () => void;
  onLogout: () => void;
}) {
  const pct = budget ? Math.min(100, budget.percent_used) : 0;
  const pctColor =
    budget && budget.alert_threshold_95
      ? "#ef4444"
      : budget && budget.alert_threshold_80
      ? "#fbbf24"
      : "#34d399";

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: easeOutExpo }}
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(8,8,12,0.75)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      <div
        style={{
          maxWidth: 1440,
          margin: "0 auto",
          padding: "14px 32px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <motion.div
            initial={{ rotate: -30, scale: 0.6 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
            whileHover={{ rotate: [0, -8, 8, 0] }}
            style={{
              width: 38,
              height: 38,
              borderRadius: 11,
              background: "linear-gradient(135deg, #6366f1, #a855f7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 19,
              fontWeight: 800,
              color: "white",
              boxShadow: "0 0 24px rgba(139,92,246,0.45)",
            }}
          >
            L
          </motion.div>
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em" }}>Luminal</h1>
            <p style={{ fontSize: 11.5, color: "#71717a", marginTop: 1 }}>
              Intelligent LLM Routing Gateway
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "7px 12px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: connected ? "#34d399" : "#ef4444",
                boxShadow: `0 0 10px ${connected ? "#34d399" : "#ef4444"}`,
                animation: connected ? "pulse-dot 1.6s infinite" : "none",
              }}
            />
            <span
              style={{ fontSize: 12, color: connected ? "#34d399" : "#f87171", fontWeight: 600 }}
            >
              {connected ? "LIVE" : "OFFLINE"}
            </span>
          </div>

          {budget && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 12px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <svg width="22" height="22" viewBox="0 0 36 36">
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="3.5"
                />
                <motion.circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  stroke={pctColor}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 15.5}
                  initial={{ strokeDashoffset: 2 * Math.PI * 15.5 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 15.5 * (1 - pct / 100) }}
                  transition={{ duration: 1.4, ease: "easeOut" }}
                  transform="rotate(-90 18 18)"
                />
              </svg>
              <span style={{ fontSize: 12, color: "#a1a1aa" }}>
                Budget <b style={{ color: pctColor }}>{Math.round(pct)}%</b> used
              </span>
            </div>
          )}

          <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }} onClick={onRefresh} style={ghostBtn} title="Refresh">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
            </svg>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.95 }}
            onClick={onLogout}
            style={{ ...ghostBtn, color: "#f87171", borderColor: "rgba(248,113,113,0.3)" }}
          >
            Logout
          </motion.button>
        </div>
      </div>
    </motion.header>
  );
}