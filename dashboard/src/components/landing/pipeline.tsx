"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import {
  Brain,
  CheckCircle2,
  Database,
  Gauge,
  GitBranch,
  Layers,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";

const easeOutExpo = [0.16, 1, 0.3, 1] as const;

const NODES = [
  {
    id: "analyze",
    icon: Brain,
    label: "analyze",
    desc: "Hybrid complexity scoring",
    color: "#a78bfa",
    side: "right" as const,
  },
  {
    id: "retrieve",
    icon: Database,
    label: "retrieve",
    desc: "RAG over vector store",
    color: "#60a5fa",
    side: "left" as const,
  },
  {
    id: "tool",
    icon: Wrench,
    label: "tool",
    desc: "MCP decision",
    color: "#34d399",
    side: "right" as const,
  },
  {
    id: "approval",
    icon: ShieldCheck,
    label: "approval",
    desc: "Human-in-the-loop pause",
    color: "#fbbf24",
    side: "left" as const,
  },
  {
    id: "route",
    icon: GitBranch,
    label: "route",
    desc: "Pick tier + provider",
    color: "#f472b6",
    side: "right" as const,
  },
  {
    id: "generate",
    icon: MessageSquare,
    label: "generate",
    desc: "Cache + retry + fallback",
    color: "#22d3ee",
    side: "left" as const,
  },
  {
    id: "critic",
    icon: Sparkles,
    label: "critic",
    desc: "Score & regenerate",
    color: "#f0abfc",
    side: "right" as const,
  },
  {
    id: "recovery",
    icon: RefreshCw,
    label: "error_recovery",
    desc: "Adjusted retry",
    color: "#fb7185",
    side: "left" as const,
  },
];

export function LandingPipeline() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const lineHeight = useTransform(scrollYProgress, [0.1, 0.85], ["0%", "100%"]);
  const glowY = useTransform(scrollYProgress, [0, 1], [80, -120]);

  return (
    <section
      id="pipeline"
      ref={ref}
      style={{
        position: "relative",
        padding: "140px 0",
      }}
    >
      <motion.div
        style={{
          position: "absolute",
          top: "10%",
          left: "50%",
          x: "-50%",
          y: glowY,
          width: 700,
          height: 700,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(168,85,247,0.12), transparent 70%)",
          filter: "blur(100px)",
        }}
        aria-hidden
      />

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
          style={{ textAlign: "center", marginBottom: 88 }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 14px",
              borderRadius: 999,
              background: "rgba(56,189,248,0.10)",
              border: "1px solid rgba(56,189,248,0.25)",
              fontSize: 11.5,
              fontWeight: 600,
              color: "#7dd3fc",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 20,
            }}
          >
            <Layers size={11} /> Pipeline
      </div>
          <h2
            style={{
              fontSize: "clamp(32px, 5vw, 56px)",
              lineHeight: 1.05,
              fontWeight: 800,
              letterSpacing: "-0.035em",
              color: "#fafafa",
              maxWidth: 740,
              margin: "0 auto",
            }}
          >
            Every prompt walks a{" "}
            <span
              style={{
                backgroundImage:
                  "linear-gradient(120deg, #60a5fa, #a78bfa, #f0abfc)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              state machine.
        </span>
      </h2>
          <p
            style={{
              marginTop: 18,
              maxWidth: 600,
              margin: "18px auto 0",
              color: "#a1a1aa",
              fontSize: 16,
              lineHeight: 1.7,
            }}
          >
            Eight LangGraph nodes handle a single request. Each one logs its decision
            and hands off to the next — visible live in your dashboard.
      </p>
    </motion.div>

        {/* Pipeline timeline */}
        <div
          style={{
            position: "relative",
            maxWidth: 880,
            margin: "0 auto",
          }}
        >
          {/* Center vertical track */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: "50%",
              transform: "translateX(-50%)",
              width: 2,
              background:
                "linear-gradient(180deg, transparent, rgba(139,92,246,0.4), rgba(56,189,248,0.4), transparent)",
            }}
          />
          <motion.div
            aria-hidden
            style={{
              position: "absolute",
              top: 0,
              left: "50%",
              transform: "translateX(-50%)",
              width: 2,
              height: lineHeight,
              background:
                "linear-gradient(180deg, #a78bfa, #60a5fa, #22d3ee)",
              boxShadow: "0 0 18px rgba(139,92,246,0.6)",
            }}
          />

          {/* Head dot */}
          <motion.div
            aria-hidden
            style={{
              position: "absolute",
              left: "50%",
              top: "useTransform",
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: "#fafafa",
              boxShadow: "0 0 18px #a78bfa",
              transform: "translate(-50%, 0)",
            }}
          />

          {NODES.map((node, i) => (
            <PipelineNode key={node.id} node={node} index={i} />
          ))}
       </div>
    </div>
  </section>
  );
}

function PipelineNode({
  node,
  index,
}: {
  node: (typeof NODES)[number];
  index: number;
}) {
  const isRight = node.side === "right";
  return (
    <motion.div
      initial={{ opacity: 0, x: isRight ? 40 : -40 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{
        duration: 0.6,
        ease: easeOutExpo,
        delay: index * 0.05,
      }}
      style={{
        position: "relative",
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
        gap: 24,
        marginBottom: 56,
      }}
    >
      {/* Left slot */}
      {!isRight ? (
        <NodeCard node={node} />
      ) : (
        <div aria-hidden style={{ height: 1 }} />
      )}

      {/* Center node circle */}
      <motion.div
        whileHover={{ scale: 1.15, rotate: 12 }}
        transition={{ type: "spring", stiffness: 280, damping: 16 }}
        style={{
          position: "relative",
          width: 60,
          height: 60,
          borderRadius: 18,
          background: `linear-gradient(135deg, ${node.color}30, ${node.color}10)`,
          border: `1px solid ${node.color}50`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2,
          boxShadow: `0 0 28px ${node.color}40, inset 0 0 14px ${node.color}20`,
        }}
      >
        <node.icon size={22} color={node.color} />
        {/* Pulse */}
        <motion.span
          aria-hidden
          animate={{ scale: [1, 2], opacity: [0.5, 0] }}
          transition={{
            duration: 2.4,
            repeat: Infinity,
            ease: "easeOut",
            delay: index * 0.3,
          }}
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 18,
            border: `1px solid ${node.color}`,
          }}
        />
    </motion.div>

      {/* Right slot */}
      {isRight ? (
        <NodeCard node={node} />
      ) : (
        <div aria-hidden style={{ height: 1 }} />
      )}
  </motion.div>
  );
}

function NodeCard({ node }: { node: (typeof NODES)[number] }) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      style={{
        padding: "16px 20px",
        borderRadius: 16,
        background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
        border: "1px solid rgba(255,255,255,0.06)",
        backdropFilter: "blur(16px)",
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 13.5,
            fontWeight: 700,
            color: node.color,
          }}
        >
          {node.label}
    </span>
        <CheckCircle2 size={11} color="#52525b" />
  </div>
      <div
        style={{
          color: "#a1a1aa",
          fontSize: 13.5,
          lineHeight: 1.55,
        }}
      >
        {node.desc}
  </div>
   <motion.div
        aria-hidden
        animate={{ opacity: [0.3, 0.7, 0.3] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          background: `linear-gradient(90deg, transparent, ${node.color}, transparent)`,
        }}
      />
  </motion.div>
  );
}
