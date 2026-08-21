"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { BudgetInfo, DailyPoint } from "@/lib/types";
import { fmtMoney, fmtShortDate, api } from "@/lib/api";
import { panelStyle, SectionTitle, ghostBtn, badgeStyle, easeOutExpo } from "@/components/ui";

// ─── Cost & Usage Trend Chart ─────────────────────────────────────────────
export function CostTrendChart({ daily }: { daily: DailyPoint[] }) {
  const W = 640;
  const H = 240;
  const PAD = { l: 46, r: 14, t: 22, b: 30 };
  const points = [...(daily ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  const hasData = points.length > 1 && points.some((p) => p.cost > 0 || p.requests > 0);

  const maxCost = Math.max(...points.map((p) => p.cost), 0.0001);
  const maxReq = Math.max(...points.map((p) => p.requests), 1);
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;

  const x = (i: number) =>
    PAD.l + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const yCost = (c: number) => PAD.t + innerH - (c / maxCost) * innerH;
  const yReq = (r: number) => PAD.t + innerH - (r / maxReq) * innerH;

  const lineCost = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${yCost(p.cost).toFixed(1)}`)
    .join(" ");
  const areaCost = `${lineCost} L${x(points.length - 1).toFixed(1)},${PAD.t + innerH} L${PAD.l},${PAD.t + innerH} Z`;
  const lineReq = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${yReq(p.requests).toFixed(1)}`)
    .join(" ");

  const gridLines = [0.25, 0.5, 0.75].map((f) => PAD.t + innerH - f * innerH);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: 0.35, ease: easeOutExpo }}
      whileHover={{ y: -3 }}
      style={panelStyle}
    >
      <SectionTitle
        title="Cost & Usage Trend"
        subtitle="Last 30 days"
        right={
          <div style={{ display: "flex", gap: 14, fontSize: 11.5, color: "#a1a1aa" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: "#a855f7" }} /> Cost
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: "#38bdf8" }} /> Requests
            </span>
          </div>
        }
      />

      {!hasData ? (
        <div
          style={{
            height: 240,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            color: "#52525b",
          }}
        >
          <motion.svg
            width="44"
            height="44"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#3f3f46"
            strokeWidth="1.5"
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <path d="M3 17l6-6 4 4 8-8M21 7v6" strokeLinecap="round" strokeLinejoin="round" />
          </motion.svg>
          <span style={{ fontSize: 13 }}>No activity in the last 30 days yet</span>
          <span style={{ fontSize: 11.5 }}>Send a prompt to see your cost curve take shape</span>
        </div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#c084fc" />
            </linearGradient>
          </defs>

          {gridLines.map((gy, i) => (
            <line
              key={i}
              x1={PAD.l}
              y1={gy}
              x2={W - PAD.r}
              y2={gy}
              stroke="rgba(255,255,255,0.05)"
              strokeDasharray="3 5"
            />
          ))}

          <motion.path
            d={areaCost}
            fill="url(#areaGrad)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.7 }}
          />

          <motion.path
            d={lineCost}
            fill="none"
            stroke="url(#lineGrad)"
            strokeWidth="2.5"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.6, ease: "easeInOut", delay: 0.4 }}
          />

          <motion.path
            d={lineReq}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="1 7"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.6, ease: "easeInOut", delay: 0.6 }}
          />

          <AnimatePresence>
            {points.map((p, i) => (
              <motion.circle
                key={p.date}
                cx={x(i)}
                cy={yCost(p.cost)}
                r="4"
                fill="#0c0c12"
                stroke="#c084fc"
                strokeWidth="2"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 1.2 + i * 0.05, type: "spring", stiffness: 300, damping: 18 }}
              />
            ))}
          </AnimatePresence>

          {[0, Math.floor(points.length / 2), points.length - 1].map((idx) => (
            <text
              key={idx}
              x={x(idx)}
              y={H - 8}
              textAnchor={idx === 0 ? "start" : idx === points.length - 1 ? "end" : "middle"}
              fontSize="10.5"
              fill="#52525b"
            >
              {fmtShortDate(points[idx].date)}
            </text>
          ))}
        </svg>
      )}
    </motion.div>
  );
}

// ─── Budget Panel ─────────────────────────────────────────────────────────
export function BudgetPanel({
  budget,
  token,
  onSaved,
}: {
  budget: BudgetInfo | null;
  token: string;
  onSaved: (b: BudgetInfo) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState("");
  const [saving, setSaving] = useState(false);

  if (!budget) return null;
  const R = 58;
  const C = 2 * Math.PI * R;
  const pct = Math.min(100, budget.percent_used);
  const color = budget.is_over_budget
    ? "#ef4444"
    : budget.alert_threshold_95
    ? "#ef4444"
    : budget.alert_threshold_80
    ? "#fbbf24"
    : "#34d399";

  const save = async () => {
    const amount = parseFloat(val);
    if (isNaN(amount) || amount < 0) return;
    setSaving(true);
    try {
      const b = await api<{ monthly_budget: number }>("/dashboard/budget", token, {
        method: "PATCH",
        body: JSON.stringify({ monthly_budget: amount }),
      });
      onSaved({
        ...budget,
        monthly_budget: b.monthly_budget,
        percent_used: budget.current_spend > 0 ? (budget.current_spend / b.monthly_budget) * 100 : 0,
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: 0.45, ease: easeOutExpo }}
      whileHover={{ y: -3 }}
      style={panelStyle}
    >
      <SectionTitle
        title="Monthly Budget"
        subtitle={
          budget.is_over_budget
            ? "Over budget!"
            : `${Math.round(budget.remaining)} remaining this month`
        }
        right={
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setEditing(!editing);
              if (!editing) setVal(String(budget.monthly_budget || 50));
            }}
            style={{ ...ghostBtn, padding: "6px 12px", fontSize: 11.5 }}
          >
            {editing ? "Cancel" : "Edit"}
          </motion.button>
        }
      />

      <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
        <div style={{ position: "relative", width: 148, height: 148, flexShrink: 0 }}>
          <svg width="148" height="148" viewBox="0 0 148 148">
            <circle
              cx="74"
              cy="74"
              r={R}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="11"
            />
            <motion.circle
              cx="74"
              cy="74"
              r={R}
              fill="none"
              stroke={color}
              strokeWidth="11"
              strokeLinecap="round"
              strokeDasharray={C}
              initial={{ strokeDashoffset: C }}
              animate={{ strokeDashoffset: C * (1 - pct / 100) }}
              transition={{ duration: 1.5, ease: easeOutExpo }}
              transform="rotate(-90 74 74)"
              style={{ filter: `drop-shadow(0 0 8px ${color}66)` }}
            />
          </svg>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <motion.span
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 220, damping: 16, delay: 0.8 }}
              style={{ fontSize: 26, fontWeight: 800, color }}
            >
              {Math.round(pct)}%
            </motion.span>
            <span style={{ fontSize: 10.5, color: "#71717a", marginTop: 2 }}>used</span>
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: "#71717a", marginBottom: 3 }}>Spent this month</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#f4f4f5" }}>
              {fmtMoney(budget.current_spend, 4)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#71717a", marginBottom: 3 }}>Limit</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{fmtMoney(budget.monthly_budget, 2)}</div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
            {budget.alert_threshold_80 && (
              <motion.span
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                style={badgeStyle("#fbbf24", "rgba(251,191,36,0.1)")}
              >
                ⚠ 80% threshold hit
              </motion.span>
            )}
            {budget.alert_threshold_95 && (
              <motion.span
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                style={badgeStyle("#f87171", "rgba(248,113,113,0.1)")}
              >
                ⚠ 95% threshold hit
              </motion.span>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: "hidden", marginTop: 14 }}
          >
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="number"
                min="0"
                step="1"
                value={val}
                onChange={(e) => setVal(e.target.value)}
                placeholder="Monthly budget ($)"
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: "#0c0c12",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#e4e4e7",
                  fontSize: 13.5,
                  outline: "none",
                  fontFamily: "inherit",
                }}
              />
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={save}
                disabled={saving}
                style={{
                  padding: "10px 20px",
                  borderRadius: 10,
                  border: "none",
                  cursor: "pointer",
                  background: "linear-gradient(135deg, #6366f1, #a855f7)",
                  color: "white",
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "inherit",
                }}
              >
                {saving ? "Saving…" : "Save"}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}