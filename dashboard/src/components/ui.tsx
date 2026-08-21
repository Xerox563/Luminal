"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";
import { fmtMoney } from "@/lib/api";

export const ghostBtn: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 10,
  cursor: "pointer",
  background: "rgba(255,255,255,0.03)",
  color: "#a1a1aa",
  border: "1px solid rgba(255,255,255,0.09)",
  fontSize: 12.5,
  fontWeight: 600,
  display: "flex",
  alignItems: "center",
  gap: 6,
};

export const panelStyle: React.CSSProperties = {
  background: "rgba(17,17,24,0.72)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 18,
  padding: "20px 22px",
};

export const badgeStyle = (color: string, bg: string): React.CSSProperties => ({
  fontSize: 11,
  fontWeight: 600,
  color,
  background: bg,
  border: `1px solid ${color}33`,
  padding: "4px 10px",
  borderRadius: 99,
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  whiteSpace: "nowrap",
});

export const easeOutExpo = [0.22, 1, 0.36, 1] as const;

export function useCountUp(target: number, duration = 1.1) {
  const mv = useMotionValue(0);
  useEffect(() => {
    const controls = animate(mv, target, { duration, ease: "easeOut" });
    return () => controls.stop();
  }, [target, duration, mv]);
  return mv;
}

export const cardVariants = {
  hidden: { opacity: 0, y: 18, scale: 0.98 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.45, delay: i * 0.06, ease: easeOutExpo },
  }),
};

export const springHover = {
  scale: 1.015,
  y: -3,
  transition: { type: "spring" as const, stiffness: 300, damping: 20 },
};

// ─── Stat Card ────────────────────────────────────────────────────────────
export function StatCard({
  i,
  label,
  value,
  fmt,
  icon,
  accent,
}: {
  i: number;
  label: string;
  value: number;
  fmt: (v: number) => string;
  icon: string;
  accent: string;
}) {
  const mv = useCountUp(value);
  const formatted = useTransform(mv, (v) => fmt(v));

  return (
    <motion.div
      custom={i}
      variants={cardVariants}
      initial="hidden"
      animate="show"
      whileHover={springHover}
      style={{
        position: "relative",
        overflow: "hidden",
        background: "rgba(17,17,24,0.72)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 18,
        padding: "18px 20px",
        cursor: "default",
      }}
    >
      <motion.div
        style={{
          position: "absolute",
          top: -40,
          right: -40,
          width: 130,
          height: 130,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${accent}26, transparent 70%)`,
        }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 9,
            background: `${accent}1f`,
            border: `1px solid ${accent}3a`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke={accent}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d={icon} />
          </svg>
        </div>
        <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 500, letterSpacing: "0.02em" }}>
          {label}
        </span>
      </div>
      <motion.div
        style={{
          fontSize: 25,
          fontWeight: 800,
          letterSpacing: "-0.03em",
          color: "#f4f4f5",
        }}
      >
        {formatted}
      </motion.div>
    </motion.div>
  );
}

// ─── Section Title ────────────────────────────────────────────────────────
export function SectionTitle({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 18,
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <div>
        <h2 style={{ fontSize: 15.5, fontWeight: 700, letterSpacing: "-0.01em", color: "#f4f4f5" }}>
          {title}
        </h2>
        {subtitle && (
          <p style={{ fontSize: 11.5, color: "#71717a", marginTop: 3 }}>{subtitle}</p>
        )}
      </div>
      {right}
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────
export function Toast({ toast }: { toast: string | null }) {
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 350, damping: 26 }}
          style={{
            position: "fixed",
            bottom: 28,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 999,
            padding: "12px 22px",
            borderRadius: 12,
            background: "rgba(24,24,32,0.95)",
            backdropFilter: "blur(14px)",
            border: "1px solid rgba(139,92,246,0.35)",
            boxShadow: "0 12px 40px rgba(0,0,0,0.5), 0 0 24px rgba(139,92,246,0.15)",
            color: "#e4e4e7",
            fontSize: 13,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 9,
            whiteSpace: "nowrap",
          }}
        >
          <motion.span
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 15, delay: 0.05 }}
            style={{ color: "#34d399", fontSize: 15, display: "flex" }}
          >
            ✓
          </motion.span>
          {toast}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Boot Loader ──────────────────────────────────────────────────────────
export function BootLoader() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 16 }}
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: "linear-gradient(135deg, #6366f1, #a855f7)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 26,
          fontWeight: 800,
          color: "white",
          boxShadow: "0 0 40px rgba(139,92,246,0.5)",
        }}
      >
        L
      </motion.div>
      <motion.div
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{ duration: 1.6, repeat: Infinity }}
        style={{ fontSize: 13, color: "#71717a", letterSpacing: "0.08em", textTransform: "uppercase" }}
      >
        Booting Luminal
      </motion.div>
      <div style={{ display: "flex", gap: 6 }}>
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
            style={{ width: 6, height: 6, borderRadius: "50%", background: "#a855f7" }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Login Screen ─────────────────────────────────────────────────────────
export function LoginScreen({ onLogin }: { onLogin: (token: string) => void }) {
  const [email, setEmail] = useState("admin@admin.com");
  const [password, setPassword] = useState("admin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ username: email, password }),
      });
      if (!res.ok) {
        setError("Invalid credentials. Try admin@admin.com / admin");
        return;
      }
      const data = await res.json();
      onLogin(data.access_token);
    } catch {
      setError("Cannot reach API server on port 8000");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div className="bg-glow top" />
      <div className="bg-glow right" />
      <div className="bg-grid" />

      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: easeOutExpo }}
        style={{
          width: 400,
          maxWidth: "calc(100vw - 40px)",
          background: "rgba(17,17,24,0.8)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderRadius: 24,
          padding: 38,
          border: "1px solid rgba(255,255,255,0.07)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.55), 0 0 60px rgba(99,102,241,0.1)",
        }}
      >
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.15, type: "spring", stiffness: 220, damping: 15 }}
          style={{
            width: 62,
            height: 62,
            borderRadius: 18,
            margin: "0 auto 26px",
            background: "linear-gradient(135deg, #6366f1, #a855f7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 30,
            fontWeight: 800,
            color: "white",
            boxShadow: "0 0 36px rgba(139,92,246,0.55)",
          }}
        >
          L
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          style={{ fontSize: 23, fontWeight: 800, textAlign: "center", letterSpacing: "-0.02em" }}
        >
          Welcome to <span className="gradient-text">Luminal</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.32 }}
          style={{ fontSize: 13.5, color: "#71717a", textAlign: "center", margin: "6px 0 30px" }}
        >
          Intelligent LLM Routing Gateway
        </motion.p>

        <form onSubmit={handleSubmit}>
          <motion.div
            initial={{ opacity: 0, x: -14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.38 }}
            style={{ marginBottom: 16 }}
          >
            <label style={{ display: "block", fontSize: 12, color: "#a1a1aa", marginBottom: 7, fontWeight: 500 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "12px 15px",
                borderRadius: 11,
                background: "#0c0c12",
                border: "1px solid rgba(255,255,255,0.09)",
                color: "#e4e4e7",
                fontSize: 14,
                outline: "none",
                fontFamily: "inherit",
                transition: "border-color 0.2s, box-shadow 0.2s",
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
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: -14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.44 }}
            style={{ marginBottom: 22 }}
          >
            <label style={{ display: "block", fontSize: 12, color: "#a1a1aa", marginBottom: 7, fontWeight: 500 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "12px 15px",
                borderRadius: 11,
                background: "#0c0c12",
                border: "1px solid rgba(255,255,255,0.09)",
                color: "#e4e4e7",
                fontSize: 14,
                outline: "none",
                fontFamily: "inherit",
                transition: "border-color 0.2s, box-shadow 0.2s",
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
          </motion.div>

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
                    marginBottom: 14,
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: "rgba(248,113,113,0.08)",
                    border: "1px solid rgba(248,113,113,0.25)",
                    fontSize: 12.5,
                    color: "#fca5a5",
                  }}
                >
                  {error}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            whileHover={{ scale: 1.02, boxShadow: "0 6px 30px rgba(139,92,246,0.4)" }}
            whileTap={{ scale: 0.97 }}
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: 14,
              borderRadius: 12,
              cursor: "pointer",
              background: "linear-gradient(135deg, #6366f1, #a855f7)",
              color: "white",
              border: "none",
              fontSize: 14.5,
              fontWeight: 700,
              opacity: loading ? 0.6 : 1,
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 9,
            }}
          >
            {loading ? (
              <>
                <motion.span
                  style={{
                    width: 13,
                    height: 13,
                    borderRadius: "50%",
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTopColor: "white",
                  }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                />
                Signing in…
              </>
            ) : (
              <>Sign In →</>
            )}
          </motion.button>
        </form>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          style={{ fontSize: 11.5, color: "#52525b", textAlign: "center", marginTop: 22 }}
        >
          Default: <code style={{ color: "#71717a" }}>admin@admin.com / admin</code>
        </motion.div>
      </motion.div>
    </div>
  );
}

// ─── Mini Stat ────────────────────────────────────────────────────────────
export function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.05)",
        borderRadius: 10,
        padding: "10px 12px",
      }}
    >
      <div style={{ fontSize: 10.5, color: "#71717a", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#e4e4e7" }}>{value}</div>
    </div>
  );
}

export function BudgetBadge({ budget }: { budget: number }) {
  return (
    <span style={badgeStyle("#818cf8", "rgba(99,102,241,0.1)")}>{fmtMoney(budget, 2)}</span>
  );
}