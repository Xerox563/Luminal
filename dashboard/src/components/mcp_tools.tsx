"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api, API_URL } from "@/lib/api";
import { panelStyle, SectionTitle, ghostBtn, easeOutExpo } from "@/components/ui";

interface McpTool {
  id: number;
  name: string;
  description: string | null;
  endpoint_url: string;
  auth_type: string;
  auth_config: Record<string, any> | null;
  trigger_keywords: string[] | null;
  parameters_schema: Record<string, any> | null;
  requires_approval: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const emptyForm = {
  name: "",
  description: "",
  endpoint_url: "",
  auth_type: "none",
  auth_api_key: "",
  auth_token: "",
  auth_username: "",
  auth_password: "",
  trigger_keywords: "",
  parameters_schema: "",
  requires_approval: false,
};

export function McpToolsSection({
  token,
  notify,
}: {
  token: string;
  notify: (msg: string) => void;
}) {
  const [tools, setTools] = useState<McpTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const loadTools = async () => {
    try {
      const res = await api<{ tools: McpTool[] }>("/dashboard/mcp-tools", token);
      setTools(res.tools || []);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Failed to load tools");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTools(); }, []);

  const setVal = (key: string, v: any) => setForm((prev) => ({ ...prev, [key]: v }));

  const handleSave = async () => {
    if (!form.name.trim() || !form.endpoint_url.trim()) {
      notify("Name and endpoint URL are required");
      return;
    }

    setSaving(true);
    try {
      const keywords = form.trigger_keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);

      let authConfig: Record<string, any> | null = null;
      if (form.auth_type === "api_key" && form.auth_api_key) {
        authConfig = { api_key: form.auth_api_key };
      } else if (form.auth_type === "bearer" && form.auth_token) {
        authConfig = { token: form.auth_token };
      } else if (form.auth_type === "basic" && form.auth_username) {
        authConfig = { username: form.auth_username, password: form.auth_password };
      }

      let parametersSchema: Record<string, any> | null = null;
      if (form.parameters_schema.trim()) {
        try {
          parametersSchema = JSON.parse(form.parameters_schema);
        } catch {
          notify("Invalid JSON in parameters schema");
          setSaving(false);
          return;
        }
      }

      const body = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        endpoint_url: form.endpoint_url.trim(),
        auth_type: form.auth_type,
        auth_config: authConfig,
        trigger_keywords: keywords.length > 0 ? keywords : null,
        parameters_schema: parametersSchema,
        requires_approval: form.requires_approval,
      };

      if (editingId) {
        await api(`/dashboard/mcp-tools/${editingId}`, token, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        notify(`Tool "${form.name}" updated`);
      } else {
        await api("/dashboard/mcp-tools", token, {
          method: "POST",
          body: JSON.stringify(body),
        });
        notify(`Tool "${form.name}" created`);
      }

      await loadTools();
      setForm(emptyForm);
      setEditingId(null);
      setShowAdd(false);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Failed to save tool");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (tool: McpTool) => {
    setForm({
      name: tool.name,
      description: tool.description || "",
      endpoint_url: tool.endpoint_url,
      auth_type: tool.auth_type,
      auth_api_key: tool.auth_config?.api_key || "",
      auth_token: tool.auth_config?.token || "",
      auth_username: tool.auth_config?.username || "",
      auth_password: tool.auth_config?.password || "",
      trigger_keywords: tool.trigger_keywords?.join(", ") || "",
      parameters_schema: tool.parameters_schema ? JSON.stringify(tool.parameters_schema, null, 2) : "",
      requires_approval: tool.requires_approval,
    });
    setEditingId(tool.id);
    setShowAdd(true);
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete tool "${name}"?`)) return;
    try {
      await api(`/dashboard/mcp-tools/${id}`, token, { method: "DELETE" });
      await loadTools();
      notify(`Tool "${name}" deleted`);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const handleToggle = async (tool: McpTool) => {
    try {
      await api(`/dashboard/mcp-tools/${tool.id}`, token, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !tool.is_active }),
      });
      await loadTools();
      notify(`Tool "${tool.name}" ${tool.is_active ? "disabled" : "enabled"}`);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Toggle failed");
    }
  };

  const inputStyle: React.CSSProperties = {
    flex: 1,
    padding: "10px 13px",
    borderRadius: 10,
    background: "#0c0c12",
    border: "1px solid rgba(255,255,255,0.09)",
    color: "#e4e4e7",
    fontSize: 13,
    outline: "none",
    fontFamily: "'JetBrains Mono', monospace",
    minWidth: 0,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    color: "#a1a1aa",
    fontWeight: 500,
    marginBottom: 6,
    display: "block",
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: 1.1, ease: easeOutExpo }}
      style={{ marginTop: 16 }}
    >
      <motion.div whileHover={{ y: -3 }} style={panelStyle}>
        <SectionTitle
          title="MCP Tools"
          subtitle="Register external tools (weather API, CRM, order status, etc.) with trigger keywords"
          right={
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => { setShowAdd(!showAdd); setEditingId(null); setForm(emptyForm); }}
              style={ghostBtn}
            >
              {showAdd ? "Close" : "+ Add Tool"}
            </motion.button>
          }
        />

        {/* Add / Edit Form */}
        <AnimatePresence>
          {showAdd && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              style={{ overflow: "hidden" }}
            >
              <div
                style={{
                  marginBottom: 18,
                  padding: 20,
                  background: "rgba(255,255,255,0.02)",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: "#d4d4d8", marginBottom: 16 }}>
                  {editingId ? "Edit Tool" : "New Tool"}
                </div>

                {/* Row 1: Name + Endpoint */}
                <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Tool Name *</label>
                    <input style={inputStyle} value={form.name} onChange={(e) => setVal("name", e.target.value)} placeholder="e.g. get_weather" />
                  </div>
                  <div style={{ flex: 2 }}>
                    <label style={labelStyle}>Endpoint URL *</label>
                    <input style={inputStyle} value={form.endpoint_url} onChange={(e) => setVal("endpoint_url", e.target.value)} placeholder="https://api.example.com/weather" />
                  </div>
                </div>

                {/* Row 2: Description */}
                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>Description</label>
                  <input style={inputStyle} value={form.description} onChange={(e) => setVal("description", e.target.value)} placeholder="What this tool does" />
                </div>

                {/* Row 3: Trigger Keywords */}
                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>Trigger Keywords (comma-separated)</label>
                  <input style={inputStyle} value={form.trigger_keywords} onChange={(e) => setVal("trigger_keywords", e.target.value)} placeholder="weather, temperature, forecast, rain" />
                </div>

                {/* Row 4: Auth */}
                <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 160 }}>
                    <label style={labelStyle}>Auth Type</label>
                    <select
                      value={form.auth_type}
                      onChange={(e) => setVal("auth_type", e.target.value)}
                      style={{
                        ...inputStyle,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      <option value="none">None</option>
                      <option value="api_key">API Key</option>
                      <option value="bearer">Bearer Token</option>
                      <option value="basic">Basic Auth</option>
                    </select>
                  </div>
                  {form.auth_type === "api_key" && (
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>API Key</label>
                      <input style={inputStyle} type="password" value={form.auth_api_key} onChange={(e) => setVal("auth_api_key", e.target.value)} placeholder="sk-..." />
                    </div>
                  )}
                  {form.auth_type === "bearer" && (
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Bearer Token</label>
                      <input style={inputStyle} type="password" value={form.auth_token} onChange={(e) => setVal("auth_token", e.target.value)} placeholder="token..." />
                    </div>
                  )}
                  {form.auth_type === "basic" && (
                    <>
                      <div style={{ flex: 1 }}>
                        <label style={labelStyle}>Username</label>
                        <input style={inputStyle} value={form.auth_username} onChange={(e) => setVal("auth_username", e.target.value)} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={labelStyle}>Password</label>
                        <input style={inputStyle} type="password" value={form.auth_password} onChange={(e) => setVal("auth_password", e.target.value)} />
                      </div>
                    </>
                  )}
                </div>

                {/* Row 5: Parameters Schema */}
                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>Parameters Schema (JSON, optional)</label>
                  <textarea
                    value={form.parameters_schema}
                    onChange={(e) => setVal("parameters_schema", e.target.value)}
                    placeholder='{"type": "object", "properties": {"city": {"type": "string"}}, "required": ["city"]}'
                    rows={3}
                    style={{
                      ...inputStyle,
                      fontFamily: "'JetBrains Mono', monospace",
                      resize: "vertical",
                      width: "100%",
                    }}
                  />
                </div>

                {/* Row 6: Requires Approval + Save */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12.5, color: "#a1a1aa" }}>
                    <input type="checkbox" checked={form.requires_approval} onChange={(e) => setVal("requires_approval", e.target.checked)} />
                    Requires approval before execution
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <motion.button
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => { setShowAdd(false); setEditingId(null); setForm(emptyForm); }}
                      style={{ ...ghostBtn, color: "#71717a" }}
                    >
                      Cancel
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={handleSave}
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
                      {saving ? "Saving…" : editingId ? "Update Tool" : "Create Tool"}
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tools List */}
        {loading ? (
          <div style={{ padding: "20px 0", textAlign: "center", color: "#52525b" }}>Loading…</div>
        ) : tools.length === 0 ? (
          <div style={{ padding: "30px 0", textAlign: "center", color: "#52525b", fontSize: 13 }}>
            No tools registered. Click "+ Add Tool" to register an external API.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {tools.map((tool, i) => (
              <motion.div
                key={tool.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * i, duration: 0.3 }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 16px",
                  background: tool.is_active ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.01)",
                  border: `1px solid ${tool.is_active ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)"}`,
                  borderRadius: 12,
                  opacity: tool.is_active ? 1 : 0.6,
                  gap: 14,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 200 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: "rgba(251,191,36,0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fbbf24",
                      fontSize: 18,
                      flexShrink: 0,
                    }}
                  >
                    🔧
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 700, color: "#e4e4e7", fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>{tool.name}</span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          color: tool.is_active ? "#34d399" : "#71717a",
                          background: tool.is_active ? "rgba(52,211,153,0.1)" : "rgba(255,255,255,0.05)",
                          padding: "2px 8px",
                          borderRadius: 99,
                          border: `1px solid ${tool.is_active ? "rgba(52,211,153,0.2)" : "rgba(255,255,255,0.08)"}`,
                        }}
                      >
                        {tool.is_active ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </div>
                    <div style={{ fontSize: 11.5, color: "#71717a", marginTop: 3, maxWidth: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {tool.description || "No description"} · {tool.endpoint_url}
                    </div>
                    {tool.trigger_keywords && tool.trigger_keywords.length > 0 && (
                      <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                        {tool.trigger_keywords.map((kw) => (
                          <span
                            key={kw}
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              color: "#fbbf24",
                              background: "rgba(251,191,36,0.1)",
                              padding: "2px 8px",
                              borderRadius: 99,
                              border: "1px solid rgba(251,191,36,0.2)",
                            }}
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <motion.button
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => handleToggle(tool)}
                    style={{ ...ghostBtn, padding: "7px 12px", fontSize: 11, color: tool.is_active ? "#fbbf24" : "#71717a" }}
                  >
                    {tool.is_active ? "Disable" : "Enable"}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => handleEdit(tool)}
                    style={{ ...ghostBtn, padding: "7px 12px", fontSize: 11 }}
                  >
                    Edit
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => handleDelete(tool.id, tool.name)}
                    style={{ ...ghostBtn, padding: "7px 12px", fontSize: 11, color: "#f87171", borderColor: "rgba(248,113,113,0.3)" }}
                  >
                    Delete
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.section>
  );
}