"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef } from "react";
import {
  ArrowRight,
  Cpu,
  Gauge,
  GitBranch,
  Play,
  Sparkles,
  Zap,
} from "lucide-react";

const easeOutExpo = [0.16, 1, 0.3, 1] as const;

export function LandingHero({ onCta }: { onCta: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [10, -10]), {
    stiffness: 80,
    damping: 18,
  });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-12, 12]), {
    stiffness: 80,
    damping: 18,
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      mx.set(x);
      my.set(y);
    };
    const onLeave = () => {
      mx.set(0);
      my.set(0);
    };
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, [mx, my]);

  return (
    <section
      ref={ref}
      style={{
        position: "relative",
        paddingTop: 150,
        paddingBottom: 100,
        overflow: "hidden",
      }}
    >
      <motion.div
        style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "0 28px",
            textAlign: "center",
            position: "relative",
          }}
        >
          {/* Eyebrow pill */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: easeOutExpo, delay: 0.1 }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 14px 6px 6px",
              borderRadius: 999,
              background:
                "linear-gradient(90deg, rgba(99,102,241,0.12), rgba(168,85,247,0.12))",
              border: "1px solid rgba(168,85,247,0.25)",
              marginBottom: 32,
              fontSize: 12.5,
              fontWeight: 500,
              color: "#d4d4d8",
            }}
          >
            <span
              style={{
                padding: "3px 9px",
                borderRadius: 999,
                background:
                  "linear-gradient(135deg, #6366f1, #a855f7)",
                fontSize: 10.5,
                fontWeight: 700,
                color: "white",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              NEW
          </span>
            <span>
              Luminal now routes across <b style={{ color: "#c4b5fd" }}>5 providers</b> with budget-aware fallbacks
          </span>
            <Sparkles size={13} color="#c4b5fd" />
        </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: easeOutExpo, delay: 0.18 }}
            style={{
              fontSize: "clamp(40px, 7.6vw, 96px)",
              lineHeight: 1.02,
              fontWeight: 800,
              letterSpacing: "-0.045em",
              color: "#fafafa",
              margin: 0,
              transform: "translateZ(40px)",
            }}
          >
            The cheapest model
            <br />
            that can{" "}
            <span
              style={{
                backgroundImage:
                  "linear-gradient(110deg, #818cf8 0%, #c084fc 30%, #f0abfc 55%, #60a5fa 80%)",
                backgroundSize: "200% 100%",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                animation: "gradient-x 8s ease infinite",
              }}
            >
              actually answer
          </span>
            <br />
            your prompt.
        </motion.h1>

          {/* Subhead */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: easeOutExpo, delay: 0.42 }}
            style={{
              maxWidth: 660,
              margin: "28px auto 0",
              fontSize: "clamp(15px, 1.4vw, 18px)",
              lineHeight: 1.65,
              color: "#a1a1aa",
              transform: "translateZ(30px)",
            }}
          >
            Luminal is a self-hosted LLM gateway. It scores every prompt, optionally pulls
            context from your docs, calls your tools, picks the right model for the job —
            and logs everything for cost & quality analytics.
        </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: easeOutExpo, delay: 0.6 }}
            style={{
              marginTop: 44,
              display: "flex",
              gap: 14,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <motion.button
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={onCta}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                padding: "15px 28px",
                borderRadius: 14,
                background:
                  "linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)",
                color: "white",
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 15,
                boxShadow:
                  "0 20px 40px -16px rgba(168,85,247,0.6), 0 0 0 1px rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.2)",
                fontFamily: "inherit",
              }}
            >
              <Play size={15} fill="white" />
              Launch dashboard
              <ArrowRight size={15} />
          </motion.button>
            <motion.a
              href="#pipeline"
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.97 }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "15px 24px",
                borderRadius: 14,
                background: "rgba(255,255,255,0.04)",
                color: "#e4e4e7",
                border: "1px solid rgba(255,255,255,0.10)",
                cursor: "pointer",
                fontWeight: 500,
                fontSize: 15,
                textDecoration: "none",
                backdropFilter: "blur(10px)",
              }}
            >
              See how it works
          </motion.a>
        </motion.div>

          {/* Trust strip */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.9 }}
            style={{
              marginTop: 64,
              display: "flex",
              justifyContent: "center",
              gap: 36,
              flexWrap: "wrap",
              color: "#71717a",
              fontSize: 12,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            {[
              { icon: <Zap size={12} />, label: "Sub-200ms routing" },
              { icon: <Cpu size={12} />, label: "5 live providers" },
              { icon: <GitBranch size={12} />, label: "LangGraph pipeline" },
              { icon: <Gauge size={12} />, label: "Budget-aware" },
            ].map((t, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.0 + i * 0.08 }}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <span style={{ color: "#a78bfa" }}>{t.icon}</span>
                {t.label}
            </motion.span>
            ))}
        </motion.div>

          {/* Hero visual: live terminal mock */}
          <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 1.0, ease: easeOutExpo, delay: 0.8 }}
            style={{
              marginTop: 80,
              perspective: 2000,
            }}
          >
            <HeroTerminal />
        </motion.div>
      </div>
    </motion.div>
  </section>
  );
}

function HeroTerminal() {
  const lines = [
    { tag: "→", color: "#a78bfa", text: "POST /route  {\"prompt\":\"Explain quantum entanglement to a 10yo\"}" },
    { tag: "·", color: "#60a5fa", text: "analyze   ·  complexity=0.62  (heuristic + llm-judge)" },
    { tag: "·", color: "#34d399", text: "retrieve  ·  4 chunks matched (chroma)" },
    { tag: "·", color: "#fbbf24", text: "tool      ·  none required" },
    { tag: "·", color: "#f472b6", text: "route     ·  tier=medium  →  mistral-7b (openrouter)" },
    { tag: "·", color: "#60a5fa", text: "generate  ·  312 tok in / 184 tok out  ·  $0.00018" },
    { tag: "·", color: "#34d399", text: "critic    ·  score=0.91  ✓ no regeneration" },
    { tag: "✓", color: "#22c55e", text: "200 OK in 423ms   budget left: $87.42 / $100" },
  ];

  return (
    <div
      style={{
        maxWidth: 980,
        margin: "0 auto",
        position: "relative",
      }}
    >
      {/* Glow under */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          top: "20%",
          background:
            "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(139,92,246,0.35), transparent 70%)",
          filter: "blur(60px)",
          zIndex: -1,
        }}
      />
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        style={{
          borderRadius: 18,
          background: "rgba(10,10,16,0.85)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow:
            "0 60px 120px -40px rgba(0,0,0,0.8), 0 0 0 1px rgba(139,92,246,0.10), inset 0 1px 0 rgba(255,255,255,0.05)",
          backdropFilter: "blur(20px)",
          overflow: "hidden",
          transform: "rotateX(8deg)",
        }}
      >
        {/* Title bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#ef4444" }} />
          <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#fbbf24" }} />
          <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#22c55e" }} />
          <span
            style={{
              marginLeft: 10,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 12,
              color: "#71717a",
            }}
          >
            luminal · live trace
        </span>
          <span
            style={{
              marginLeft: "auto",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "3px 10px",
              borderRadius: 999,
              background: "rgba(34,197,94,0.10)",
              border: "1px solid rgba(34,197,94,0.25)",
              fontSize: 10.5,
              fontWeight: 600,
              color: "#4ade80",
              letterSpacing: "0.06em",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#4ade80",
                boxShadow: "0 0 8px #4ade80",
                animation: "pulse-dot 1.6s infinite",
              }}
            />
            STREAMING
        </span>
      </div>

        {/* Body */}
        <div
          style={{
            padding: "20px 22px",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 13.5,
            lineHeight: 1.85,
          }}
        >
          {lines.map((l, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.4 + i * 0.18, duration: 0.4 }}
              style={{ display: "flex", gap: 10, alignItems: "baseline" }}
            >
              <span style={{ color: l.color, fontWeight: 700, width: 14 }}>{l.tag}</span>
              <span style={{ color: "#d4d4d8" }}>{l.text}</span>
          </motion.div>
          ))}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 3.4 }}
            style={{
              marginTop: 14,
              paddingTop: 14,
              borderTop: "1px dashed rgba(255,255,255,0.08)",
              color: "#a1a1aa",
              fontSize: 13,
            }}
          >
            <span style={{ color: "#a78bfa" }}>↳</span> Quantum entanglement is when two tiny
            particles become{" "}
            <span style={{ color: "#60a5fa" }}>best friends</span>: whatever happens to one
            instantly affects the other, even if they're on opposite sides of the universe…
        </motion.div>
      </div>
    </motion.div>
  </div>
  );
}
