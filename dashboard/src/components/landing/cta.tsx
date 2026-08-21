"use client";

import { motion } from "framer-motion";
import { ArrowRight, Github, Sparkles, Terminal } from "lucide-react";

const easeOutExpo = [0.16, 1, 0.3, 1] as const;

export function LandingCta({ onCta }: { onCta: () => void }) {
  return (
    <section
      id="cta"
      style={{
        position: "relative",
        padding: "140px 0",
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "0 28px",
          position: "relative",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.96 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.9, ease: easeOutExpo }}
          style={{
            position: "relative",
            padding: "clamp(40px, 6vw, 80px)",
            borderRadius: 28,
            background:
              "linear-gradient(135deg, rgba(99,102,241,0.10), rgba(168,85,247,0.08) 50%, rgba(236,72,153,0.08))",
            border: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(20px)",
            textAlign: "center",
            overflow: "hidden",
          }}
        >
          {/* Animated grid */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0.4,
              backgroundImage:
                "linear-gradient(rgba(139,92,246,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.10) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
              maskImage:
                "radial-gradient(ellipse 60% 60% at 50% 50%, black, transparent 75%)",
              WebkitMaskImage:
                "radial-gradient(ellipse 60% 60% at 50% 50%, black, transparent 75%)",
            }}
          />
          {/* Glow orbs */}
          <motion.div
            aria-hidden
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.7, 0.5] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            style={{
              position: "absolute",
              top: "-20%",
              left: "10%",
              width: 320,
              height: 320,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(139,92,246,0.45), transparent 70%)",
              filter: "blur(60px)",
            }}
          />
          <motion.div
            aria-hidden
            animate={{ scale: [1.2, 1, 1.2], opacity: [0.5, 0.7, 0.5] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            style={{
              position: "absolute",
              bottom: "-20%",
              right: "10%",
              width: 320,
              height: 320,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(236,72,153,0.4), transparent 70%)",
              filter: "blur(60px)",
            }}
          />

          <div style={{ position: "relative" }}>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 14px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.10)",
                fontSize: 11.5,
                fontWeight: 600,
                color: "#e4e4e7",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: 24,
              }}
            >
              <Sparkles size={11} color="#c4b5fd" />
              Self-hosted. Free. Open-source.
    </motion.div>

            <h2
              style={{
                fontSize: "clamp(36px, 5.5vw, 64px)",
                lineHeight: 1.05,
                fontWeight: 800,
                letterSpacing: "-0.04em",
                color: "#fafafa",
                marginBottom: 20,
              }}
            >
              Stop overpaying
              <br />
              for{" "}
              <span
                style={{
                  backgroundImage:
                    "linear-gradient(120deg, #818cf8, #c084fc, #f0abfc, #fbbf24)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                tokens you'll waste.
    </span>
  </h2>
            <p
              style={{
                maxWidth: 540,
                margin: "0 auto 36px",
                color: "#a1a1aa",
                fontSize: 16,
                lineHeight: 1.7,
              }}
            >
              Clone the repo, run one command, and start routing every prompt through
              Luminal in under five minutes.
  </p>

            <div
              style={{
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
                    "0 20px 40px -16px rgba(168,85,247,0.6), 0 0 0 1px rgba(255,255,255,0.10), inset 0 1px 0 rgba(255,255,255,0.2)",
                  fontFamily: "inherit",
                }}
              >
                <Terminal size={15} />
                Get started now
                <ArrowRight size={15} />
    </motion.button>
              <motion.a
                href="#docs"
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
                  fontFamily: "inherit",
                }}
              >
                <Github size={15} />
                Read the docs
    </motion.a>
  </div>

            <div
              style={{
                marginTop: 40,
                display: "flex",
                gap: 28,
                justifyContent: "center",
                flexWrap: "wrap",
                color: "#71717a",
                fontSize: 12,
              }}
            >
              {[
                "FastAPI + Next.js",
                "SQLite → Postgres",
                "Docker ready",
                "BYO keys",
              ].map((t) => (
                <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: "50%",
                      background: "#71717a",
                    }}
                  />
                  {t}
      </span>
              ))}
    </div>
  </div>
  </motion.div>
  </div>
  </section>
  );
}
