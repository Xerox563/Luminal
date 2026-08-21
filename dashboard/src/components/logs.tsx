"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ApiKey, LogEntry } from "@/lib/types";
import { fmtMoney, fmtNum, fmtTime, shortModel, api } from "@/lib/api";
import { panelStyle, SectionTitle, ghostBtn, badgeStyle, easeOutExpo } from "@/components/ui";

// ─── API Keys Section ─────────────────────────────────────────────────────
export function ApiKeysSection({
  token,
  keys,
  setKeys,
  notify,
}: {
  token: string;
  keys: ApiKey[];
  setKeys: (k: ApiKey[]) => void;
  notify: (msg: string) => void;
}) {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const create = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const k = await api<ApiKey>("/api-keys", token, {
        method: "POST",
        body: JSON.stringify({ name: name.trim() }),
      });
      setKeys([k, ...keys]);
      setNewKey(k.key);
      setName("");
      notify("API key created");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Failed to create key");
    } finally {
      setCreating(false);
    }
  };

  const remove = async (id: number) => {
    setDeleting(id);
    try {
      await api(`/api-keys/${id}`, token, { method: "DELETE" });
      setKeys(keys.filter((k) => k.id !== id));
      notify("API key deleted");
    } finally {
      setDeleting(null);
    }
  };

  const copy = (v: string, label: string) => {
    navigator.clipboard?.writeText(v);
    notify(`${label} copied`);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: 0.95, ease: easeOutExpo }}
      style={{ marginTop: 16 }}
    >
      <motion.div whileHover={{ y: -3 }} style={panelStyle}>
        <SectionTitle
          title="API Keys"
          subtitle="Authenticate programmatic access to the gateway"
          right={
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => setShowAll(!showAll)}
              style={ghostBtn}
            >
              {showAll ? "Hide keys" : "Show keys"}
            </motion.button>
          }
        />

        <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="Key name, e.g. production"
            style={{
              flex: 1,
              padding: "11px 15px",
              borderRadius: 11,
              background: "#0c0c12",
              border: "1px solid rgba(255,255,255,0.09)",
              color: "#e4e4e7",
              fontSize: 13.5,
              outline: "none",
              fontFamily: "inherit",
            }}
          />
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={create}
            disabled={creating || !name.trim()}
            style={{
              padding: "11px 22px",
              borderRadius: 11,
              border: "none",
              cursor: "pointer",
              background: "linear-gradient(135deg, #6366f1, #a855f7)",
              color: "white",
              fontSize: 13,
              fontWeight: 600,
              opacity: creating || !name.trim() ? 0.55 : 1,
              fontFamily: "inherit",
            }}
          >
            {creating ? "Creating…" : "+ Create"}
          </motion.button>
        </div>

        <AnimatePresence>
          {newKey && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              style={{ overflow: "hidden" }}
            >
              <div
                style={{
                  marginBottom: 16,
                  padding: "13px 15px",
                  borderRadius: 12,
                  background: "rgba(52,211,153,0.07)",
                  border: "1px solid rgba(52,211,153,0.3)",
                }}
              >
                <div style={{ fontSize: 11.5, color: "#34d399", fontWeight: 600, marginBottom: 7 }}>
                  Save this now — it&apos;s shown only once
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <code
                    style={{
                      flex: 1,
                      fontSize: 12.5,
                      color: "#d1fae5",
                      background: "#0c0c12",
                      padding: "9px 12px",
                      borderRadius: 9,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    {newKey}
                  </code>
                  <motion.button
                    whileHover={{ scale: 1.06 }}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => copy(newKey, "Key")}
                    style={ghostBtn}
                  >
                    Copy
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.06 }}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => setNewKey(null)}
                    style={{ ...ghostBtn, color: "#71717a" }}
                  >
                    Dismiss
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {keys.length === 0 ? (
          <div style={{ textAlign: "center", padding: "18px 0", color: "#52525b", fontSize: 13 }}>
            No API keys yet — create one to call <code>/route</code> from your apps
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {keys.map((k, i) => (
              <motion.div
                key={k.id}
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06, duration: 0.35 }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "11px 14px",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.025)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: "50%",
                    background: k.is_active ? "#34d399" : "#3f3f46",
                    boxShadow: k.is_active ? "0 0 8px #34d39988" : "none",
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 13, fontWeight: 600, color: "#e4e4e7", minWidth: 90 }}>
                  {k.name}
                </span>
                <code
                  style={{
                    flex: 1,
                    fontSize: 12,
                    color: "#71717a",
                    fontFamily: "'JetBrains Mono', monospace",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {showAll ? k.key : k.key.replace(/^(.*)\*\*\*\*/, "$1****")}
                </code>
                <span
                  style={{
                    fontSize: 11,
                    color: k.is_active ? "#34d399" : "#71717a",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  {k.is_active ? "ACTIVE" : "DISABLED"}
                </span>
                <motion.button
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => copy(k.key, "Key")}
                  style={{ ...ghostBtn, padding: "6px 10px", fontSize: 11 }}
                >
                  Copy
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => remove(k.id)}
                  disabled={deleting === k.id}
                  style={{
                    ...ghostBtn,
                    padding: "6px 10px",
                    fontSize: 11,
                    color: "#f87171",
                    borderColor: "rgba(248,113,113,0.25)",
                  }}
                >
                  {deleting === k.id ? "…" : "Delete"}
                </motion.button>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.section>
  );
}

// ─── Logs Section ─────────────────────────────────────────────────────────
export function LogsSection({ logs }: { logs: LogEntry[] }) {
  const [filter, setFilter] = useState<"all" | "success" | "error">("all");
  const filtered =
    filter === "all" ? logs : logs.filter((l) => (filter === "error" ? l.error_message : !l.error_message));

  const complexityColor = (c: string | null) =>
    c === "high"
      ? { color: "#fca5a5", bg: "rgba(248,113,113,0.1)" }
      : c === "medium"
      ? { color: "#fcd34d", bg: "rgba(251,191,36,0.1)" }
      : { color: "#86efac", bg: "rgba(52,211,153,0.1)" };

  return (
    <motion.section
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: 1.05, ease: easeOutExpo }}
      style={{ marginTop: 16 }}
    >
      <motion.div whileHover={{ y: -3 }} style={panelStyle}>
        <SectionTitle
          title="Recent Logs"
          subtitle="Every request traced end to end"
          right={
            <div style={{ display: "flex", gap: 6 }}>
              {(["all", "success", "error"] as const).map((f) => (
                <motion.button
                  key={f}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setFilter(f)}
                  style={{
                    ...ghostBtn,
                    padding: "6px 13px",
                    fontSize: 11.5,
                    ...(filter === f
                      ? {
                          color: "#c084fc",
                          borderColor: "rgba(168,85,247,0.4)",
                          background: "rgba(168,85,247,0.1)",
                        }
                      : {}),
                  }}
                >
                  {f === "all" ? "All" : f === "success" ? "Success" : "Errors"}
                </motion.button>
              ))}
            </div>
          }
        />

        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "34px 0", color: "#52525b", fontSize: 13 }}>
            No logs yet — send a prompt to see activity here
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                  {["Time", "Prompt", "Model", "Complexity", "Tokens", "Latency", "Cost", "Status"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "10px 12px",
                        textAlign: "left",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#71717a",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filtered.map((log) => {
                    const cc = complexityColor(log.complexity);
                    return (
                      <motion.tr
                        key={log.id}
                        layout
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        whileHover={{ background: "rgba(255,255,255,0.02)" }}
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                      >
                        <td style={{ ...td, fontSize: 11.5, color: "#71717a", whiteSpace: "nowrap" }}>
                          {fmtTime(log.created_at)}
                        </td>
                        <td style={{ ...td, maxWidth: 240 }}>
                          <span
                            style={{
                              display: "block",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {log.prompt}
                          </span>
                        </td>
                        <td style={{ ...td, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                          {shortModel(log.model_used)}
                        </td>
                        <td style={td}>
                          <span style={badgeStyle(cc.color, cc.bg)}>
                            {log.complexity || "auto"}
                          </span>
                        </td>
                        <td style={{ ...td, color: "#a1a1aa" }}>{fmtNum(log.total_tokens)}</td>
                        <td style={{ ...td, color: "#a1a1aa" }}>{Math.round(log.latency_ms)}ms</td>
                        <td style={{ ...td, color: "#c084fc", fontWeight: 600 }}>
                          {fmtMoney(log.cost, 6)}
                        </td>
                        <td style={td}>
                          {log.error_message ? (
                            <span style={{ color: "#f87171", fontSize: 12, fontWeight: 600 }}>
                              ● Error
                            </span>
                          ) : (
                            <span style={{ color: "#34d399", fontSize: 12, fontWeight: 600 }}>
                              ● Success
                            </span>
                          )}
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </motion.section>
  );
}

const td: React.CSSProperties = {
  padding: "11px 12px",
  fontSize: 12.5,
  color: "#d4d4d8",
  verticalAlign: "middle",
};