"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
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

const PROVIDER_KEYS: Array<keyof SettingsMap> = [
  "openrouter_api_key", "openai_api_key", "anthropic_api_key", "deepseek_api_key", "nvidia_api_key",
];

const FIELDS: Array<{ key: keyof SettingsMap; label: string; hint: string; secret?: boolean }> = [
  { key: "openrouter_api_key", label: "OpenRouter", hint: "Single key for 100+ models (recommended)", secret: true },
  { key: "openai_api_key", label: "OpenAI", hint: "sk-... (GPT models)", secret: true },
  { key: "anthropic_api_key", label: "Anthropic", hint: "sk-ant-... (Claude models)", secret: true },
  { key: "deepseek_api_key", label: "DeepSeek", hint: "DeepSeek models", secret: true },
  { key: "nvidia_api_key", label: "NVIDIA", hint: "NVIDIA NIM API (Llama, Nemotron, Mixtral)", secret: true },
];

function maskValue(value: string): string {
  if (!value) return "";
  if (value.length <= 8) return "••••";
  return `${value.slice(0, 4)}••••••••${value.slice(-4)}`;
}

export function SettingsSection({
  token,
  settings,
  setSettings,
  notify,
}: {
  token: string;
  settings: SettingsMap;
  setSettings: React.Dispatch<React.SetStateAction<SettingsMap>>;
  notify: (msg: string) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);
  const [useLLM, setUseLLM] = useState(settings.use_llm_complexity === "true");
  const [llmDirty, setLlmDirty] = useState(false);

  const setVal = (key: string, v: string) => {
    setValues((prev) => ({ ...prev, [key]: v }));
    setDirty(true);
  };

  const hasProviderKey = (k: keyof SettingsMap) => !!settings[k];

  const save = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      for (const f of FIELDS) {
        const entered = (values[f.key] ?? "").trim();
        if (entered) body[f.key] = entered;
      }
      if (llmDirty) body.use_llm_complexity = useLLM;
      if (values.default_provider) body.default_provider = values.default_provider;
      const updated = await api<SettingsMap>("/dashboard/settings", token, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      setSettings((prev) => {
        const merged: SettingsMap = { ...prev };
        const mergedDict = merged as unknown as Record<string, string>;
        const updatedDict = updated as unknown as Record<string, string>;
        for (const k of Object.keys(updatedDict)) {
          const key = k as keyof SettingsMap;
          const isProviderKey = PROVIDER_KEYS.includes(key);
          const userEntered = (values[k] ?? "").trim();
          if (isProviderKey && userEntered) {
            mergedDict[k] = maskValue(userEntered);
          } else if (!isProviderKey || !prev[key]) {
            mergedDict[k] = updatedDict[k];
          }
        }
        if (llmDirty) merged.use_llm_complexity = updated.use_llm_complexity;
        return merged;
      });
      setValues({});
      setDirty(false);
      setLlmDirty(false);
      notify("Provider settings saved — applied immediately");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: 0.9, ease: easeOutExpo }}
      style={{ marginTop: 16 }}
    >
      <motion.div whileHover={{ y: -3 }} style={panelStyle}>
        <SectionTitle
          title="Provider Settings"
          subtitle="Keys are saved to the database and applied instantly (no restart needed)"
          right={
            <div style={{ display: "flex", gap: 6 }}>
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setShowSecrets(!showSecrets)}
                style={ghostBtn}
              >
                {showSecrets ? "Hide values" : "Show values"}
              </motion.button>
            </div>
          }
        />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
          {FIELDS.map((f, i) => {
            const current = settings[f.key];
            const entered = values[f.key] ?? "";
            return (
              <motion.div
                key={f.key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i, duration: 0.3 }}
                style={{
                  background: "rgba(255,255,255,0.025)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 14,
                  padding: "14px 16px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#e4e4e7" }}>{f.label}</span>
                  {current && (
                    <span style={badgeStyle("#34d399", "rgba(52,211,153,0.1)")}>● configured</span>
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    marginBottom: 6,
                    padding: "9px 12px",
                    borderRadius: 10,
                    background: "#0c0c12",
                    border: "1px solid rgba(255,255,255,0.07)",
                    fontSize: 12.5,
                    color: "#71717a",
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {current ? (
                    showSecrets && !entered
                      ? current
                      : current.length > 8 && !current.includes("••••••••")
                        ? maskValue(current)
                        : current
                  ) : (
                    "Not set — uses .env or empty"
                  )}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type={showSecrets && !entered ? "text" : "password"}
                    value={entered}
                    onChange={(e) => setVal(f.key, e.target.value)}
                    placeholder={f.secret ? "Enter new key…" : "Enter URL…"}
                    style={{
                      flex: 1,
                      padding: "9px 12px",
                      borderRadius: 10,
                      background: "#0c0c12",
                      border: "1px solid rgba(255,255,255,0.09)",
                      color: "#e4e4e7",
                      fontSize: 13,
                      outline: "none",
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  />
                </div>
                <div style={{ fontSize: 10.5, color: "#52525b", marginTop: 6 }}>{f.hint}</div>
              </motion.div>
            );
          })}
        </div>

        {/* Toggle + save bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            marginTop: 16,
            paddingTop: 16,
            borderTop: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <button
            onClick={() => {
              setUseLLM(!useLLM);
              setLlmDirty(true);
              setDirty(true);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#a1a1aa",
              fontFamily: "inherit",
              fontSize: 12.5,
              textAlign: "left",
            }}
          >
            <span
              style={{
                width: 38,
                height: 21,
                borderRadius: 99,
                background: useLLM ? "#6366f1" : "rgba(255,255,255,0.1)",
                position: "relative",
                transition: "background 0.25s",
                flexShrink: 0,
              }}
            >
              <motion.span
                layout
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                style={{
                  position: "absolute",
                  top: 2,
                  left: useLLM ? 19 : 2,
                  width: 17,
                  height: 17,
                  borderRadius: "50%",
                  background: "white",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
                }}
              />
            </span>
            <span>
              <b style={{ color: "#d4d4d8" }}>LLM-as-judge complexity</b>
              <br />
              <span style={{ fontSize: 10.5, color: "#52525b" }}>
                Use an LLM to score complexity instead of heuristics
              </span>
            </span>
          </button>

          {/* Provider mode toggle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginTop: 12,
            }}
          >
            <span
              style={{
                fontSize: 12.5,
                color: "#cbd5e1",
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              Default Provider:
            </span>
            <div
              style={{
                display: "flex",
                gap: 4,
                alignItems: "center",
              }}
            >
              <button
                style={{
                  padding: "6px 12px",
                  borderRadius: 20,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: settings.default_provider === "openrouter"
                    ? "rgba(99, 102, 241, 0.2)"
                    : "rgba(255,255,255,0.05)",
                  cursor: "pointer",
                  fontSize: 12,
                  fontFamily: "inherit",
                  color: settings.default_provider === "openrouter" ? "#6366f1" : "#a1a1aa",
                  transition: "all 0.2s",
                }}
                onClick={() => setVal("default_provider", "openrouter")}
                title="OpenRouter (cloud models, requires API key + credits)"
              >
                OpenRouter
              </button>
              <button
                style={{
                  padding: "6px 12px",
                  borderRadius: 20,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: settings.default_provider === "ollama"
                    ? "rgba(99, 102, 241, 0.2)"
                    : "rgba(255,255,255,0.05)",
                  cursor: "pointer",
                  fontSize: 12,
                  fontFamily: "inherit",
                  color: settings.default_provider === "ollama" ? "#6366f1" : "#a1a1aa",
                  transition: "all 0.2s",
                }}
                onClick={() => setVal("default_provider", "ollama")}
                title="Ollama (local models, free, no API key needed)"
              >
                Ollama
              </button>
              <button
                style={{
                  padding: "6px 12px",
                  borderRadius: 20,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: settings.default_provider === "nvidia"
                    ? "rgba(118, 185, 0, 0.2)"
                    : "rgba(255,255,255,0.05)",
                  cursor: "pointer",
                  fontSize: 12,
                  fontFamily: "inherit",
                  color: settings.default_provider === "nvidia" ? "#a3e635" : "#a1a1aa",
                  transition: "all 0.2s",
                }}
                onClick={() => setVal("default_provider", "nvidia")}
                title="NVIDIA (NIM-hosted models, requires NVIDIA API key)"
              >
                NVIDIA
              </button>
            </div>
          </div>

          <AnimatePresence>
            {dirty && (
              <motion.div
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                style={{ display: "flex", gap: 8 }}
              >
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => {
                    setValues({});
                    setDirty(false);
                    setLlmDirty(false);
                    setUseLLM(settings.use_llm_complexity === "true");
                  }}
                  style={{ ...ghostBtn, color: "#71717a" }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={save}
                  disabled={saving}
                  style={{
                    padding: "10px 22px",
                    borderRadius: 11,
                    border: "none",
                    cursor: "pointer",
                    background: "linear-gradient(135deg, #6366f1, #a855f7)",
                    color: "white",
                    fontSize: 13,
                    fontWeight: 600,
                    opacity: saving ? 0.6 : 1,
                    fontFamily: "inherit",
                  }}
                >
                  {saving ? "Saving…" : hasProviderKey("openrouter_api_key") ? "Update Settings" : "Save Settings"}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.section>
  );
}