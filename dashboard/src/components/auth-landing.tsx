"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { API_URL } from "@/lib/api";
import { easeOutExpo } from "@/components/ui";

const FEATURE_ITEMS = [
  "JWT sessions for simple email and password auth",
  "Live routing, logs, MCP tools, and provider settings",
  "Minimal motion with a quiet glassy interface",
];

const PREVIEW_METRICS = [
  { label: "Latency", value: "~182ms" },
  { label: "Success", value: "99.4%" },
  { label: "Providers", value: "5 live" },
];

type AuthMode = "login" | "register";

type SessionResponse = {
  access_token: string;
  token_type: string;
  user: {
    id: number;
    email: string;
  };
};

export function AuthLanding({ onAuthenticated }: { onAuthenticated: (token: string) => void }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backendDown, setBackendDown] = useState(false);

  const endpoint = useMemo(
    () => (mode === "login" ? "/auth/session/login" : "/auth/session/register"),
    [mode]
  );

  const buttonLabel = mode === "login" ? "Sign In" : "Create Account";
  const title = mode === "login" ? "Sign in to Luminal" : "Create your Luminal workspace";
  const subtitle =
    mode === "login"
      ? "Use your email and password to enter the dashboard."
      : "Register once and start with an instant JWT session.";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setBackendDown(false);

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(
          typeof payload.detail === "string"
            ? payload.detail
            : mode === "login"
            ? "Unable to sign in with that email and password."
            : "Unable to create your account right now."
        );
        return;
      }

      const payload = (await response.json()) as SessionResponse;
      onAuthenticated(payload.access_token);
    } catch {
      setBackendDown(true);
      setError("Cannot reach the backend API right now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        position: "relative",
        overflow: "hidden",
        padding: "40px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div className="bg-glow top" />
      <div className="bg-glow right" />
      <div className="bg-grid" />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(circle at 20% 20%, rgba(99,102,241,0.08), transparent 24%), radial-gradient(circle at 80% 30%, rgba(168,85,247,0.08), transparent 20%)",
        }}
      />

      <div
        style={{
          width: "100%",
          maxWidth: 1180,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.1fr) minmax(360px, 420px)",
          gap: 24,
          alignItems: "stretch",
        }}
      >
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: easeOutExpo }}
          style={{
            position: "relative",
            borderRadius: 28,
            padding: "34px 34px 28px",
            background: "rgba(12,12,18,0.64)",
            border: "1px solid rgba(255,255,255,0.06)",
            backdropFilter: "blur(22px)",
            WebkitBackdropFilter: "blur(22px)",
            overflow: "hidden",
          }}
        >
          <motion.div
            animate={{ x: [0, 18, 0], y: [0, -10, 0] }}
            transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
            style={{
              position: "absolute",
              top: -70,
              right: -40,
              width: 220,
              height: 220,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(99,102,241,0.2), transparent 68%)",
            }}
          />

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.6 }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 12px",
              borderRadius: 999,
              border: "1px solid rgba(129,140,248,0.2)",
              background: "rgba(99,102,241,0.08)",
              color: "#c7d2fe",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#818cf8",
                boxShadow: "0 0 12px rgba(129,140,248,0.7)",
              }}
            />
            Minimal AI gateway control center
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16, duration: 0.65 }}
            style={{
              maxWidth: 560,
              marginTop: 22,
              fontSize: "clamp(2.6rem, 5vw, 4.6rem)",
              lineHeight: 1,
              letterSpacing: "-0.05em",
              fontWeight: 800,
            }}
          >
            Route every prompt with a calm, fast workspace.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24, duration: 0.65 }}
            style={{
              maxWidth: 560,
              marginTop: 18,
              fontSize: 16,
              lineHeight: 1.75,
              color: "#a1a1aa",
            }}
          >
            Luminal keeps your routing dashboard, provider controls, logs, and RAG tools in one
            place. Sign in or register with simple email and password auth, then continue with the
            same dashboard flow already in place.
          </motion.p>

          <div
            style={{
              marginTop: 26,
              display: "grid",
              gap: 12,
              maxWidth: 520,
            }}
          >
            {FEATURE_ITEMS.map((item, index) => (
              <motion.div
                key={item}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.34 + index * 0.08, duration: 0.45 }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "13px 14px",
                  borderRadius: 16,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 10,
                    background: "rgba(129,140,248,0.12)",
                    border: "1px solid rgba(129,140,248,0.16)",
                    color: "#c7d2fe",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 13,
                  }}
                >
                  {index + 1}
                </div>
                <span style={{ color: "#d4d4d8", fontSize: 14.5 }}>{item}</span>
              </motion.div>
            ))}
          </div>

          <div
            style={{
              marginTop: 30,
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            {PREVIEW_METRICS.map((metric, index) => (
              <motion.div
                key={metric.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.56 + index * 0.08, duration: 0.45 }}
                style={{
                  padding: "16px 14px",
                  borderRadius: 18,
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div style={{ fontSize: 12, color: "#71717a" }}>{metric.label}</div>
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 22,
                    fontWeight: 700,
                    letterSpacing: "-0.03em",
                    color: "#f4f4f5",
                  }}
                >
                  {metric.value}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: easeOutExpo, delay: 0.12 }}
          style={{
            borderRadius: 28,
            padding: 28,
            background: "rgba(17,17,24,0.82)",
            border: "1px solid rgba(255,255,255,0.07)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            boxShadow: "0 28px 80px rgba(0,0,0,0.42)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 16,
                    background: "linear-gradient(135deg, #6366f1, #a855f7)",
                    boxShadow: "0 0 32px rgba(139,92,246,0.32)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 24,
                    fontWeight: 800,
                  }}
                >
                  L
                </div>
              </div>

              <div
                style={{
                  display: "inline-flex",
                  padding: 4,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  gap: 4,
                }}
              >
                {(["login", "register"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setMode(value);
                      setError(null);
                    }}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 999,
                      border: "none",
                      cursor: "pointer",
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: mode === value ? "#ffffff" : "#a1a1aa",
                      background:
                        mode === value
                          ? "linear-gradient(135deg, rgba(99,102,241,0.9), rgba(168,85,247,0.9))"
                          : "transparent",
                    }}
                  >
                    {value === "login" ? "Login" : "Register"}
                  </button>
                ))}
              </div>
            </div>

            <motion.h2
              key={mode}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28 }}
              style={{ marginTop: 22, fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em" }}
            >
              {title}
            </motion.h2>
            <motion.p
              key={`${mode}-subtitle`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: 0.03 }}
              style={{ marginTop: 8, color: "#8b8b97", fontSize: 14, lineHeight: 1.7 }}
            >
              {subtitle}
            </motion.p>

            <form onSubmit={handleSubmit} style={{ marginTop: 24 }}>
              <div style={{ display: "grid", gap: 14 }}>
                <Field
                  label="Email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="you@example.com"
                  autoComplete={mode === "login" ? "email" : "username"}
                />
                <Field
                  label="Password"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  placeholder={mode === "login" ? "Enter your password" : "At least 8 characters"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  minLength={mode === "register" ? 8 : undefined}
                />
              </div>

              <AnimatePresence mode="wait">
                {error ? (
                  <motion.div
                    key={error}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.25 }}
                    style={{
                      marginTop: 14,
                      padding: "12px 14px",
                      borderRadius: 14,
                      background: "rgba(248,113,113,0.08)",
                      border: "1px solid rgba(248,113,113,0.2)",
                      color: "#fca5a5",
                      fontSize: 12.5,
                      lineHeight: 1.6,
                    }}
                  >
                    {error}
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.99 }}
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  marginTop: 18,
                  padding: "14px 16px",
                  borderRadius: 16,
                  border: "none",
                  cursor: loading ? "wait" : "pointer",
                  background: "linear-gradient(135deg, #6366f1, #a855f7)",
                  color: "#fff",
                  fontSize: 14.5,
                  fontWeight: 700,
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? `${buttonLabel}...` : buttonLabel}
              </motion.button>
            </form>
          </div>

          <div style={{ marginTop: 22, display: "grid", gap: 12 }}>
            <div
              style={{
                padding: "14px 16px",
                borderRadius: 18,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                color: "#a1a1aa",
                fontSize: 12.5,
                lineHeight: 1.7,
              }}
            >
              {mode === "register"
                ? "A fresh account gets default model routing presets and an instant bearer token."
                : "Existing sessions still work the same way after login, including dashboard refresh and protected API calls."}
            </div>

            {backendDown ? (
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: 18,
                  background: "rgba(248,113,113,0.08)",
                  border: "1px solid rgba(248,113,113,0.16)",
                  color: "#fda4af",
                  fontSize: 12.5,
                  lineHeight: 1.7,
                }}
              >
                Backend looks offline at <code>{API_URL}</code>. Start FastAPI first, then retry.
              </div>
            ) : null}
          </div>
        </motion.section>
      </div>
    </div>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  minLength,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete: string;
  minLength?: number;
}) {
  return (
    <label style={{ display: "grid", gap: 8 }}>
      <span style={{ fontSize: 12, color: "#a1a1aa", fontWeight: 500 }}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        minLength={minLength}
        style={{
          width: "100%",
          padding: "13px 14px",
          borderRadius: 14,
          background: "rgba(12,12,18,0.88)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: "#f4f4f5",
          fontSize: 14,
          outline: "none",
          fontFamily: "inherit",
        }}
      />
    </label>
  );
}
