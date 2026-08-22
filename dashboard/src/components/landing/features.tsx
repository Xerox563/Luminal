"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import {
  Brain,
  GitBranch,
  Layers,
  LucideIcon,
  Shield,
  Sparkles,
  Wrench,
} from "lucide-react";

const easeOutExpo = [0.16, 1, 0.3, 1] as const;

const FEATURES = [
  {
    icon: Brain,
    title: "Hybrid complexity scoring",
    body:
      "Heuristic + LLM-as-judge compute a single difficulty score per prompt. The router reuses it so the analysis and the model picked can never disagree.",
    accent: "#a78bfa",
    glow: "rgba(139,92,246,0.35)",
    span: 2,
  },
  {
    icon: Layers,
    title: "Built-in RAG",
    body:
      "Keyword + embedding retrieval over Chroma, Pinecone, or Weaviate — context and citations injected before generation.",
    accent: "#60a5fa",
    glow: "rgba(56,189,248,0.35)",
    span: 1,
  },
  {
    icon: Wrench,
    title: "MCP tool calling",
    body:
      "Register external tools. Luminal decides when to call them — risky actions pause for your approval before they run.",
    accent: "#34d399",
    glow: "rgba(52,211,153,0.35)",
    span: 1,
  },
  {
    icon: GitBranch,
    title: "LangGraph pipeline",
    body:
      "analyze → retrieve → tool → approval → route → generate → critic → error_recovery. Every transition logged.",
    accent: "#f472b6",
    glow: "rgba(236,72,153,0.35)",
    span: 1,
  },
  {
    icon: Shield,
    title: "Budget-aware routing",
    body:
      "At 80% spend Luminal downgrades one tier. At 95% it pins the cheapest model. Go over your monthly budget and requests are rejected until it resets.",
    accent: "#fbbf24",
    glow: "rgba(251,191,36,0.35)",
    span: 1,
  },
  {
    icon: Sparkles,
    title: "Self-healing generation",
    body:
      "A critic model scores cloud replies and regenerates if quality drops (local Ollama responses skip scoring). Errors trigger recovery with adjusted temperature or disabled RAG.",
    accent: "#f0abfc",
    glow: "rgba(217,70,239,0.35)",
    span: 2,
  },
];

export function LandingFeatures() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [80, -80]);

  return (
    <section
      id="features"
      ref={ref}
      style={{
        position: "relative",
        padding: "120px 0",
      }}
    >
      <motion.div style={{ y }} aria-hidden>
        <div
          style={{
            position: "absolute",
            top: "20%",
            right: "-20%",
            width: 500,
            height: 500,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(168,85,247,0.18), transparent 70%)",
            filter: "blur(80px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "10%",
            left: "-15%",
            width: 480,
            height: 480,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(56,189,248,0.16), transparent 70%)",
            filter: "blur(80px)",
          }}
        />
     </motion.div>

      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 28px",
          position: "relative",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: easeOutExpo }}
          style={{ textAlign: "center", marginBottom: 72 }}
        >
          <div
            style={{
              display: "inline-block",
              padding: "5px 14px",
              borderRadius: 999,
              background: "rgba(139,92,246,0.10)",
              border: "1px solid rgba(139,92,246,0.25)",
              fontSize: 11.5,
              fontWeight: 600,
              color: "#c4b5fd",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 20,
            }}
          >
            Features
       </div>
          <h2
            style={{
              fontSize: "clamp(32px, 5vw, 56px)",
              lineHeight: 1.05,
              fontWeight: 800,
              letterSpacing: "-0.035em",
              color: "#fafafa",
              maxWidth: 720,
              margin: "0 auto",
            }}
          >
            One gateway.{" "}
            <span
              style={{
                backgroundImage:
                  "linear-gradient(120deg, #818cf8, #c084fc, #f0abfc)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              Every model.
         </span>
            <br />
            Every cent accounted for.
       </h2>
       </motion.div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 16,
          }}
          className="features-grid"
        >
          {FEATURES.map((f, i) => (
            <FeatureCard key={i} {...f} index={i} />
          ))}
       </div>
     </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 900px) {
          .features-grid { grid-template-columns: 1fr !important; }
        }
        @media (min-width: 901px) and (max-width: 1100px) {
          .features-grid { grid-template-columns: repeat(2, minmax(0,1fr)) !important; }
        }
      `}} />
   </section>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  body,
  accent,
  glow,
  span,
  index,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  accent: string;
  glow: string;
  span: number;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease: easeOutExpo, delay: index * 0.06 }}
      whileHover={{ y: -4 }}
      style={{
        gridColumn: span === 2 ? "span 2" : "span 1",
        position: "relative",
        padding: 28,
        borderRadius: 20,
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
        border: "1px solid rgba(255,255,255,0.06)",
        backdropFilter: "blur(20px)",
        overflow: "hidden",
        cursor: "default",
        transition: "border-color 0.3s ease",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = `${accent}40`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor =
          "rgba(255,255,255,0.06)";
      }}
    >
      {/* Hover glow */}
      <motion.div
        aria-hidden
        style={{
          position: "absolute",
          top: "-40%",
          left: "-20%",
          width: 320,
          height: 320,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${glow}, transparent 70%)`,
          filter: "blur(40px)",
          opacity: 0,
          transition: "opacity 0.5s ease",
          pointerEvents: "none",
        }}
        className="feature-glow"
      />

      {/* Animated corner mark */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: 120,
          height: 120,
          background: `linear-gradient(135deg, transparent 50%, ${accent}15 100%)`,
          opacity: 0.7,
        }}
      />

      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 48,
          height: 48,
          borderRadius: 14,
          background: `linear-gradient(135deg, ${accent}25, ${accent}10)`,
          border: `1px solid ${accent}30`,
          marginBottom: 22,
          position: "relative",
        }}
      >
        <motion.div
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          <Icon size={22} color={accent} />
       </motion.div>
        <motion.div
          aria-hidden
          animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeOut" }}
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 14,
            border: `1px solid ${accent}`,
          }}
        />
     </div>

      <h3
        style={{
          fontSize: span === 2 ? 22 : 18,
          fontWeight: 700,
          color: "#fafafa",
          letterSpacing: "-0.02em",
          marginBottom: 10,
        }}
      >
        {title}
     </h3>
      <p
        style={{
          color: "#a1a1aa",
          fontSize: 14.5,
          lineHeight: 1.7,
        }}
      >
        {body}
     </p>
   </motion.div>
  );
}
