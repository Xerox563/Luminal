"use client";

import { motion, useInView, useMotionValue, useScroll, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef } from "react";
import { Activity, Clock, Coins, Cpu, DollarSign, Zap } from "lucide-react";

const easeOutExpo = [0.16, 1, 0.3, 1] as const;

const METRICS = [
  {
    icon: Zap,
    label: "Avg routing decision",
    value: 182,
    suffix: "ms",
    color: "#fbbf24",
    glow: "rgba(251,191,36,0.35)",
    decimals: 0,
  },
  {
    icon: DollarSign,
    label: "Avg cost per request",
    value: 0.0008,
    prefix: "$",
    color: "#34d399",
    glow: "rgba(52,211,153,0.35)",
    decimals: 4,
  },
  {
    icon: Activity,
    label: "Pipeline success rate",
    value: 99.4,
    suffix: "%",
    color: "#60a5fa",
    glow: "rgba(56,189,248,0.35)",
    decimals: 1,
  },
  {
    icon: Cpu,
    label: "Providers supported",
    value: 5,
    color: "#a78bfa",
    glow: "rgba(139,92,246,0.35)",
    decimals: 0,
  },
  {
    icon: Coins,
    label: "Tokens / sec throughput",
    value: 1280,
    suffix: " tok/s",
    color: "#f472b6",
    glow: "rgba(236,72,153,0.35)",
    decimals: 0,
  },
  {
    icon: Clock,
    label: "Critic regeneration cap",
    value: 2,
    suffix: " retries",
    color: "#22d3ee",
    glow: "rgba(34,211,238,0.35)",
    decimals: 0,
  },
];

export function LandingStats() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const { scrollYProgress } = useScroll();
  const scale = useTransform(scrollYProgress, [0, 0.5], [0.95, 1]);

  return (
    <section
      id="stats"
      ref={ref}
      style={{
        position: "relative",
        padding: "120px 0",
      }}
    >
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
              background: "rgba(251,191,36,0.10)",
              border: "1px solid rgba(251,191,36,0.25)",
              fontSize: 11.5,
              fontWeight: 600,
              color: "#fbbf24",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 20,
            }}
          >
            By the numbers
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
            Built for{" "}
            <span
              style={{
                backgroundImage:
                  "linear-gradient(120deg, #fbbf24, #f472b6, #a78bfa)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              production scale.
  </span>
  </h2>
       </motion.div>

        <motion.div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 16,
            scale,
          }}
          className="stats-grid"
        >
          {METRICS.map((m, i) => (
            <MetricCard key={i} metric={m} index={i} active={inView} />
          ))}
    </motion.div>
  </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 900px) {
          .stats-grid { grid-template-columns: 1fr !important; }
        }
        @media (min-width: 901px) and (max-width: 1100px) {
          .stats-grid { grid-template-columns: repeat(2, minmax(0,1fr)) !important; }
        }
      `}} />
  </section>
  );
}

function MetricCard({
  metric,
  index,
  active,
}: {
  metric: (typeof METRICS)[number];
  index: number;
  active: boolean;
}) {
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { duration: 1800, bounce: 0 });

  useEffect(() => {
    if (active) mv.set(metric.value);
  }, [active, mv, metric.value]);

  const formatted = useTransform(spring, (v) => {
    if (metric.decimals === 0) return Math.round(v).toLocaleString();
    return v.toFixed(metric.decimals);
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease: easeOutExpo, delay: index * 0.06 }}
      whileHover={{ y: -4 }}
      style={{
        position: "relative",
        padding: 28,
        borderRadius: 20,
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
        border: "1px solid rgba(255,255,255,0.06)",
        backdropFilter: "blur(16px)",
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: "-50%",
          right: "-30%",
          width: 280,
          height: 280,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${metric.glow}, transparent 70%)`,
          filter: "blur(40px)",
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 18,
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 11,
            background: `linear-gradient(135deg, ${metric.color}25, ${metric.color}08)`,
            border: `1px solid ${metric.color}35`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <metric.icon size={18} color={metric.color} />
      </div>
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            color: "#a1a1aa",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          {metric.label}
    </span>
    </div>

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 4,
        }}
      >
        {metric.prefix && (
          <span style={{ fontSize: 22, color: metric.color, fontWeight: 600 }}>
            {metric.prefix}
    </span>
        )}
        <motion.span
          style={{
            fontSize: "clamp(36px, 4vw, 48px)",
            fontWeight: 800,
            color: "#fafafa",
            letterSpacing: "-0.035em",
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatted}
    </motion.span>
        {metric.suffix && (
          <span style={{ fontSize: 16, color: "#a1a1aa", fontWeight: 500, marginLeft: 4 }}>
            {metric.suffix}
    </span>
        )}
    </div>

      {/* Bar */}
      <div
        style={{
          marginTop: 18,
          height: 4,
          borderRadius: 999,
          background: "rgba(255,255,255,0.05)",
          overflow: "hidden",
        }}
      >
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: "100%" }}
          viewport={{ once: true }}
          transition={{ duration: 1.6, ease: easeOutExpo, delay: index * 0.06 }}
          style={{
            height: "100%",
            background: `linear-gradient(90deg, ${metric.color}, ${metric.color}60)`,
            boxShadow: `0 0 12px ${metric.color}`,
          }}
        />
    </div>
  </motion.div>
  );
}
