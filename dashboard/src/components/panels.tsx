"use client";

import { motion } from "framer-motion";
import type { ModelPerf, RagStats } from "@/lib/types";
import { fmtMoney, fmtNum, shortModel } from "@/lib/api";
import { panelStyle, SectionTitle, MiniStat, easeOutExpo } from "@/components/ui";

// ─── RAG & Tools Panel ────────────────────────────────────────────────────
export function RagPanel({ rag }: { rag: RagStats | null }) {
  const r = rag?.rag;
  const t = rag?.tools;

  const bar = (label: string, pct: number, color: string, detail: string) => (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: "#a1a1aa" }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{pct}%</span>
      </div>
      <div
        style={{
          height: 7,
          borderRadius: 99,
          background: "rgba(255,255,255,0.05)",
          overflow: "hidden",
        }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, pct)}%` }}
          transition={{ duration: 1.2, ease: easeOutExpo, delay: 0.4 }}
          style={{
            height: "100%",
            borderRadius: 99,
            background: `linear-gradient(90deg, ${color}88, ${color})`,
            boxShadow: `0 0 12px ${color}44`,
          }}
        />
      </div>
      <div style={{ fontSize: 11, color: "#52525b", marginTop: 4 }}>{detail}</div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: 0.6, ease: easeOutExpo }}
      whileHover={{ y: -3 }}
      style={panelStyle}
    >
      <SectionTitle title="RAG & Tool Usage" subtitle="Last 30 days" />
      {bar(
        "RAG retrieval",
        r?.rag_percentage ?? 0,
        "#a78bfa",
        `${r?.requests ?? 0} requests used retrieval · avg ${Math.round(r?.avg_latency_ms ?? 0)}ms`
      )}
      {bar(
        "Tool calls (MCP)",
        t?.tool_percentage ?? 0,
        "#fbbf24",
        `${t?.requests ?? 0} requests used tools · avg ${Math.round(t?.avg_latency_ms ?? 0)}ms`
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 6 }}>
        <MiniStat label="RAG avg cost" value={fmtMoney(r?.avg_cost ?? 0, 6)} />
        <MiniStat label="Non-RAG avg cost" value={fmtMoney(r?.non_rag_avg_cost ?? 0, 6)} />
        <MiniStat label="RAG latency" value={`${Math.round(r?.avg_latency_ms ?? 0)}ms`} />
        <MiniStat label="Tool latency" value={`${Math.round(t?.avg_latency_ms ?? 0)}ms`} />
      </div>
    </motion.div>
  );
}

// ─── Model Performance ────────────────────────────────────────────────────
export function ModelPerfPanel({ data }: { data: ModelPerf[] }) {
  const maxCost = Math.max(...data.map((d) => d.cost), 0.0001);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: 0.7, ease: easeOutExpo }}
      whileHover={{ y: -3 }}
      style={panelStyle}
    >
      <SectionTitle title="Model Performance" subtitle="Cost & quality by model" />
      {data.length === 0 ? (
        <div style={{ padding: "30px 0", textAlign: "center", color: "#52525b", fontSize: 13 }}>
          No model usage yet
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {data.map((m, i) => (
            <motion.div
              key={m.model}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + i * 0.08, duration: 0.4 }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: "#d4d4d8",
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {shortModel(m.model)}
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "#c084fc" }}>
                  {fmtMoney(m.cost)}
                </span>
              </div>
              <div
                style={{
                  height: 8,
                  borderRadius: 99,
                  background: "rgba(255,255,255,0.05)",
                  overflow: "hidden",
                }}
              >
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 1, delay: 0.7 + i * 0.08, ease: easeOutExpo }}
                  style={{
                    height: "100%",
                    transformOrigin: "left",
                    borderRadius: 99,
                    background: "linear-gradient(90deg, #6366f1, #a855f7)",
                    boxShadow: "0 0 14px rgba(168,85,247,0.35)",
                    width: `${Math.max(4, (m.cost / maxCost) * 100)}%`,
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 14,
                  marginTop: 5,
                  fontSize: 11,
                  color: "#71717a",
                  flexWrap: "wrap",
                }}
              >
                <span>{m.requests} req</span>
                <span>{fmtNum(m.tokens)} tok</span>
                <span>{Math.round(m.avg_latency_ms)}ms</span>
                {m.avg_quality_score != null && <span>quality {m.avg_quality_score.toFixed(2)}</span>}
                <span style={{ color: m.error_rate > 0 ? "#f87171" : "#34d399" }}>
                  {m.error_rate > 0 ? `${m.error_rate}% err` : "0% err"}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}