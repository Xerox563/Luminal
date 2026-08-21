"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { RouteResponse, TraceEntry } from "@/lib/types";
import { API_URL, NODE_COLORS, fmtMoney, fmtNum, api, newSessionId } from "@/lib/api";
import { panelStyle, SectionTitle, ghostBtn, badgeStyle, easeOutExpo } from "@/components/ui";

interface SettingsMap {
  openrouter_api_key: string;
  openai_api_key: string;
  anthropic_api_key: string;
  deepseek_api_key: string;
  nvidia_api_key: string;
  openrouter_base_url: string;
  openai_base_url: string;
  anthropic_base_url: string;
  deepseek_base_url: string;
  nvidia_base_url: string;
  ollama_base_url: string;
  use_llm_complexity: string;
  default_provider: "openrouter" | "ollama" | "nvidia";
}

type ProviderMode = "openrouter" | "ollama" | "nvidia";

// ─── Prompt Tester + Live Trace Terminal ──────────────────────────────────
export function PromptSection({
  token,
  onComplete,
  settings,
  setSettings,
  notify,
}: {
  token: string;
  onComplete: () => void;
  settings: SettingsMap;
  setSettings: (s: SettingsMap) => void;
  notify: (msg: string) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const [response, setResponse] = useState<RouteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trace, setTrace] = useState<TraceEntry[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [providerSaving, setProviderSaving] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const autoScroll = useRef(true);

  const currentProvider: ProviderMode =
    (settings.default_provider as ProviderMode) || "ollama";

  const switchProvider = async (next: ProviderMode) => {
    if (next === currentProvider || providerSaving) return;
    setProviderSaving(true);
    try {
      const updated = await api<SettingsMap>("/dashboard/settings", token, {
        method: "PUT",
        body: JSON.stringify({ default_provider: next }),
      });
      setSettings({ ...settings, ...updated, default_provider: next });
      notify(
        next === "ollama"
          ? "Switched to Local (Ollama) — runs models on your laptop, free, no API key needed"
          : next === "nvidia"
          ? "Switched to NVIDIA — uses NVIDIA NIM-hosted models"
          : "Switched to Cloud (OpenRouter) — uses best-in-class cloud models"
      );
    } catch (e) {
      notify(e instanceof Error ? e.message : "Failed to switch provider");
    } finally {
      setProviderSaving(false);
    }
  };

  useEffect(() => {
    const el = terminalRef.current;
    if (el && autoScroll.current) el.scrollTop = el.scrollHeight;
  }, [trace]);

  useEffect(
    () => () => {
      esRef.current?.close();
    },
    []
  );

  const connectTrace = (sid: string) => {
    esRef.current?.close();
    setTrace([]);
    setSessionId(sid);
    const es = new EventSource(`${API_URL}/route/trace/${sid}`);
    esRef.current = es;
    es.onmessage = (ev) => {
      try {
        const d = JSON.parse(ev.data);
        if (d.done) {
          es.close();
          esRef.current = null;
        } else {
          setTrace((prev) => [...prev, d]);
        }
      } catch {
        /* ignore malformed events */
      }
    };
    es.onerror = () => {
      es.close();
      esRef.current = null;
    };
  };

  const clearAll = () => {
    esRef.current?.close();
    esRef.current = null;
    setTrace([]);
    setSessionId(null);
    setResponse(null);
    setError(null);
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || sending) return;
    setSending(true);
    setResponse(null);
    setError(null);
    setTrace([]);
    setSessionId(null);

    // Open the trace stream before the /route call resolves so agent steps
    // show up live as the pipeline runs, instead of all at once at the end.
    const sid = newSessionId(token);
    if (sid) connectTrace(sid);

    try {
      const r = await api<RouteResponse>("/route", token, {
        method: "POST",
        body: JSON.stringify({ prompt, api_key: "", session_id: sid || undefined }),
      });
      setResponse(r);
      if (!sid) connectTrace(r.session_id);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error — is the API running?");
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: 0.85, ease: easeOutExpo }}
      style={{
        marginTop: 16,
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) 400px",
        gap: 16,
        alignItems: "start",
      }}
    >
      {/* Prompt card */}
      <motion.div style={panelStyle}>
        <SectionTitle
          title="Route a Prompt"
          subtitle="Runs through the LangGraph agent pipeline"
          right={
            <motion.span
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2.4, repeat: Infinity }}
              style={badgeStyle("#818cf8", "rgba(99,102,241,0.12)")}
            >
              ⚡ LangGraph Agent
            </motion.span>
          }
        />

        {/* Provider Mode Toggle */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 14,
            padding: "10px 14px",
            borderRadius: 14,
            background:
              currentProvider === "ollama"
                ? "linear-gradient(135deg, rgba(52,211,153,0.08), rgba(16,185,129,0.04))"
                : currentProvider === "nvidia"
                ? "linear-gradient(135deg, rgba(118,185,0,0.1), rgba(118,185,0,0.03))"
                : "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(168,85,247,0.04))",
            border:
              currentProvider === "ollama"
                ? "1px solid rgba(52,211,153,0.2)"
                : currentProvider === "nvidia"
                ? "1px solid rgba(118,185,0,0.25)"
                : "1px solid rgba(99,102,241,0.2)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.03em",
                color: "#a1a1aa",
                textTransform: "uppercase",
              }}
            >
              Model Source
            </span>
            <div
              style={{
                display: "flex",
                gap: 2,
                padding: 3,
                borderRadius: 999,
                background: "rgba(0,0,0,0.35)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => switchProvider("ollama")}
                disabled={providerSaving}
                title="Local: Uses Ollama running on your laptop. Free, no API key. Requires: `ollama serve` + `ollama pull mistral`"
                style={{
                  padding: "6px 14px",
                  borderRadius: 999,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 12,
                  fontFamily: "inherit",
                  fontWeight: 700,
                  transition: "all 0.2s",
                  background:
                    currentProvider === "ollama"
                      ? "linear-gradient(135deg, #10b981, #059669)"
                      : "transparent",
                  color: currentProvider === "ollama" ? "white" : "#71717a",
                  boxShadow:
                    currentProvider === "ollama"
                      ? "0 2px 12px rgba(16,185,129,0.35)"
                      : "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" strokeLinejoin="round" />
                  <path d="M2 17l10 5 10-5" strokeLinejoin="round" />
                  <path d="M2 12l10 5 10-5" strokeLinejoin="round" />
                </svg>
                Local (Ollama)
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => switchProvider("openrouter")}
                disabled={providerSaving}
                title="Cloud: Uses OpenRouter API. Requires valid API key + credits. Access to 100+ models."
                style={{
                  padding: "6px 14px",
                  borderRadius: 999,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 12,
                  fontFamily: "inherit",
                  fontWeight: 700,
                  transition: "all 0.2s",
                  background:
                    currentProvider === "openrouter"
                      ? "linear-gradient(135deg, #6366f1, #a855f7)"
                      : "transparent",
                  color: currentProvider === "openrouter" ? "white" : "#71717a",
                  boxShadow:
                    currentProvider === "openrouter"
                      ? "0 2px 12px rgba(139,92,246,0.35)"
                      : "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Cloud (OpenRouter)
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => switchProvider("nvidia")}
                disabled={providerSaving}
                title="NVIDIA: Uses NVIDIA's NIM-hosted API. Requires an NVIDIA API key set in Settings."
                style={{
                  padding: "6px 14px",
                  borderRadius: 999,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 12,
                  fontFamily: "inherit",
                  fontWeight: 700,
                  transition: "all 0.2s",
                  background:
                    currentProvider === "nvidia"
                      ? "linear-gradient(135deg, #76b900, #567800)"
                      : "transparent",
                  color: currentProvider === "nvidia" ? "white" : "#71717a",
                  boxShadow:
                    currentProvider === "nvidia"
                      ? "0 2px 12px rgba(118,185,0,0.35)"
                      : "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M4 4l16 16M4 12h16M4 20L20 4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                NVIDIA
              </motion.button>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: currentProvider === "ollama" ? "#10b981" : currentProvider === "nvidia" ? "#76b900" : "#818cf8",
                boxShadow: `0 0 8px ${currentProvider === "ollama" ? "#10b981" : currentProvider === "nvidia" ? "#76b900" : "#818cf8"}`,
              }}
            />
            <span style={{ fontSize: 11, color: "#71717a", maxWidth: 240 }}>
              {currentProvider === "ollama" ? (
                <>
                  Running on your laptop — <b style={{ color: "#34d399" }}>free</b>. Make sure{" "}
                  <code style={{ fontSize: 10, color: "#a78bfa", background: "rgba(167,139,250,0.08)", padding: "1px 5px", borderRadius: 4 }}>ollama serve</code> is running.
                </>
              ) : currentProvider === "nvidia" ? (
                <>
                  Uses <b style={{ color: "#a3e635" }}>NVIDIA</b> NIM-hosted models.
                  {!settings.nvidia_api_key && (
                    <span style={{ color: "#fbbf24" }}> ⚠ No API key set</span>
                  )}
                </>
              ) : (
                <>
                  Uses cloud models via <b style={{ color: "#a78bfa" }}>OpenRouter</b>.
                  {!settings.openrouter_api_key && (
                    <span style={{ color: "#fbbf24" }}> ⚠ No API key set</span>
                  )}
                </>
              )}
            </span>
          </div>
        </div>

        <form onSubmit={send}>
          <div style={{ position: "relative" }}>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                'Ask anything…  e.g. "What is the capital of France?" or "Analyze AI impact on jobs"'
              }
              rows={4}
              disabled={sending}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(e);
              }}
              style={{
                width: "100%",
                padding: "16px 18px",
                borderRadius: 14,
                background: "#0c0c12",
                border: "1px solid rgba(255,255,255,0.09)",
                color: "#e4e4e7",
                fontFamily: "inherit",
                fontSize: 14,
                lineHeight: 1.6,
                resize: "vertical",
                outline: "none",
                transition: "border-color 0.25s, box-shadow 0.25s",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#6366f1";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.15)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
            <span
              style={{
                position: "absolute",
                right: 12,
                bottom: 10,
                fontSize: 10.5,
                color: "#3f3f46",
                pointerEvents: "none",
              }}
            >
              ⌘/Ctrl + Enter
            </span>
          </div>
          <div
            style={{
              display: "flex",
              gap: 10,
              justifyContent: "flex-end",
              marginTop: 14,
              flexWrap: "wrap",
            }}
          >
            <motion.button
              type="button"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={clearAll}
              style={{ ...ghostBtn, color: "#71717a" }}
            >
              Clear
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              type="submit"
              disabled={sending || !prompt.trim()}
              style={{
                padding: "11px 26px",
                borderRadius: 12,
                cursor: "pointer",
                border: "none",
                background: sending ? "#3f3f46" : "linear-gradient(135deg, #6366f1, #a855f7)",
                color: "white",
                fontSize: 13.5,
                fontWeight: 700,
                opacity: sending || !prompt.trim() ? 0.55 : 1,
                boxShadow: sending ? "none" : "0 4px 24px rgba(139,92,246,0.35)",
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontFamily: "inherit",
              }}
            >
              {sending ? (
                <>
                  <motion.span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      border: "2px solid rgba(255,255,255,0.3)",
                      borderTopColor: "white",
                    }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                  />
                  Processing…
                </>
              ) : (
                <>Send →</>
              )}
            </motion.button>
          </div>
        </form>

        {/* Response / error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              style={{ overflow: "hidden" }}
            >
              <div
                style={{
                  marginTop: 14,
                  padding: "13px 16px",
                  borderRadius: 12,
                  background: "rgba(248,113,113,0.08)",
                  border: "1px solid rgba(248,113,113,0.25)",
                  fontSize: 13,
                  color: "#fca5a5",
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.65,
                }}
              >
                ✕ {error}
              </div>
            </motion.div>
          )}

          {response && !error && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 22 }}
              style={{ marginTop: 14 }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#c084fc",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  Response
                </span>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span style={badgeStyle("#818cf8", "rgba(99,102,241,0.1)")}>{response.model}</span>
                  <span style={badgeStyle("#34d399", "rgba(52,211,153,0.1)")}>
                    {response.complexity}
                  </span>
                  <span style={badgeStyle("#fbbf24", "rgba(251,191,36,0.1)")}>
                    {fmtNum(response.tokens_used)} tok
                  </span>
                  <span style={badgeStyle("#f472b6", "rgba(244,114,182,0.1)")}>
                    {fmtMoney(response.cost, 6)}
                  </span>
                  <span style={badgeStyle("#60a5fa", "rgba(96,165,250,0.1)")}>
                    {Math.round(response.latency_ms)}ms
                  </span>
                </div>
              </div>
              <motion.div
                initial={{ scaleY: 0.96, opacity: 0.6 }}
                animate={{ scaleY: 1, opacity: 1 }}
                style={{
                  background: "#0c0c12",
                  borderRadius: 14,
                  padding: "16px 18px",
                  whiteSpace: "pre-wrap",
                  fontSize: 14,
                  lineHeight: 1.75,
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderLeft: "3px solid #a855f7",
                  color: "#e4e4e7",
                }}
              >
                {response.content}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Terminal */}
      <motion.div
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.55, delay: 1, ease: easeOutExpo }}
        style={{
          background: "#0b0b11",
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.06)",
          overflow: "hidden",
          position: "sticky",
          top: 84,
          boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
        }}
      >
        <div
          style={{
            padding: "13px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ display: "flex", gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#f87171" }} />
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#fbbf24" }} />
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#34d399" }} />
            </div>
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                color: "#a1a1aa",
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              agent-trace
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.05em",
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: sessionId ? "#34d399" : "#52525b",
                  animation: sessionId ? "pulse-dot 1.4s infinite" : "none",
                }}
              />
              <span style={{ color: sessionId ? "#34d399" : "#52525b" }}>
                {sessionId ? "LIVE" : "IDLE"}
              </span>
            </div>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setTerminalOpen(!terminalOpen)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#52525b",
                fontSize: 14,
                display: "flex",
              }}
            >
              <motion.svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                animate={{ rotate: terminalOpen ? 0 : 180 }}
              >
                <path d="M18 15l-6-6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </motion.svg>
            </motion.button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {terminalOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.35, ease: easeOutExpo }}
            >
              <div
                ref={terminalRef}
                className="terminal-scroll"
                style={{
                  height: 420,
                  overflow: "auto",
                  padding: "14px 16px",
                  fontFamily: "'JetBrains Mono', 'Monaco', monospace",
                  fontSize: 12,
                  lineHeight: 1.65,
                }}
              >
                {trace.length === 0 ? (
                  <div
                    style={{
                      color: "#3f3f46",
                      textAlign: "center",
                      marginTop: 90,
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                      alignItems: "center",
                    }}
                  >
                    <motion.div
                      animate={{ opacity: [0.3, 0.8, 0.3] }}
                      transition={{ duration: 2.2, repeat: Infinity }}
                      style={{ fontSize: 13 }}
                    >
                      {sessionId ? "Waiting for agent events…" : "Send a prompt to stream the agent trace"}
                    </motion.div>
                    <motion.div
                      animate={{ opacity: [0.2, 0.6, 0.2] }}
                      transition={{ duration: 2.2, repeat: Infinity, delay: 0.4 }}
                      style={{ fontSize: 11 }}
                    >
                      $ analyze → retrieve → tool → route → generate → critic
                    </motion.div>
                  </div>
                ) : (
                  <>
                    {trace.map((entry, idx) => (
                      <TraceLine key={idx} entry={entry} />
                    ))}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      style={{ marginTop: 8, color: "#3f3f46", fontSize: 11 }}
                    >
                      <span style={{ color: "#34d399" }}>✓</span> trace complete
                    </motion.div>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.section>
  );
}

// ─── Trace Line ───────────────────────────────────────────────────────────
function TraceLine({ entry }: { entry: TraceEntry }) {
  const color = NODE_COLORS[entry.node] || "#9ca3af";
  const time = new Date(entry.timestamp).toLocaleTimeString(undefined, { hour12: false });
  const dataEntries = Object.entries(entry.data).slice(0, 3);

  return (
    <motion.div
      initial={{ opacity: 0, x: -14 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      style={{
        marginBottom: 6,
        borderLeft: `3px solid ${color}`,
        padding: "8px 10px",
        borderRadius: "0 8px 8px 0",
        background: `${color}10`,
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ color: "#3f3f46", fontSize: 10 }}>{time}</span>
        <span
          style={{
            color,
            fontWeight: 700,
            textTransform: "uppercase",
            fontSize: 10,
            background: `${color}22`,
            padding: "2px 8px",
            borderRadius: 4,
            letterSpacing: "0.04em",
          }}
        >
          {entry.node}
        </span>
        <span style={{ color: "#d4d4d8", fontSize: 11 }}>{entry.action}</span>
      </div>
      {dataEntries.length > 0 && (
        <div style={{ marginTop: 4, paddingLeft: 4, fontSize: 10, color: "#71717a" }}>
          {dataEntries.map(([k, v]) => (
            <span key={k} style={{ marginRight: 12 }}>
              <span style={{ color: "#52525b" }}>{k}:</span> {String(v).slice(0, 80)}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}