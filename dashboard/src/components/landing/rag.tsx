"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { ArrowRight, FileText, Network, Search, Sparkles } from "lucide-react";

const easeOutExpo = [0.16, 1, 0.3, 1] as const;

const DOCS = [
  { name: "Auth & sessions.md", size: "4.2 kb", tokens: "1.1k", glow: "#60a5fa" },
  { name: "MCP spec v2.md", size: "12.7 kb", tokens: "3.2k", glow: "#a78bfa" },
  { name: "Routing rules.md", size: "2.1 kb", tokens: "540", glow: "#34d399" },
  { name: "Q3 roadmap.pdf", size: "89 kb", tokens: "22.4k", glow: "#f472b6" },
  { name: "Onboarding guide.md", size: "6.8 kb", tokens: "1.7k", glow: "#fbbf24" },
];

const CHUNKS = [
  {
    score: 0.94,
    text: "JWT sessions are stored with `sub` claim as a string. An integer subject is rejected and breaks dashboard loading.",
    source: "Auth & sessions.md",
    color: "#60a5fa",
  },
  {
    score: 0.87,
    text: "Tools with `requires_approval=True` pause the run before executing. Resume via `POST /route/approve {session_id, approved}`.",
    source: "MCP spec v2.md",
    color: "#a78bfa",
  },
  {
    score: 0.71,
    text: "At 80% spend, the router downgrades one tier; at 95% it pins the cheapest model until reset.",
    source: "Routing rules.md",
    color: "#34d399",
  },
];

export function LandingRag() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [60, -80]);

  return (
    <section
      id="rag"
      ref={ref}
      style={{
        position: "relative",
        padding: "120px 0",
      }}
    >
      <motion.div
        style={{
          position: "absolute",
          inset: 0,
          y,
          background:
            "radial-gradient(ellipse 60% 40% at 30% 30%, rgba(56,189,248,0.10), transparent), radial-gradient(ellipse 50% 40% at 80% 70%, rgba(168,85,247,0.10), transparent)",
          pointerEvents: "none",
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
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.3fr)",
            gap: 60,
            alignItems: "center",
          }}
          className="rag-grid"
        >
          {/* Left: copy */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease: easeOutExpo }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 14px",
                borderRadius: 999,
                background: "rgba(52,211,153,0.10)",
                border: "1px solid rgba(52,211,153,0.25)",
                fontSize: 11.5,
                fontWeight: 600,
                color: "#6ee7b7",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: 20,
              }}
            >
              <Sparkles size={11} /> Retrieval
       </div>
            <h2
              style={{
                fontSize: "clamp(28px, 4vw, 48px)",
                lineHeight: 1.08,
                fontWeight: 800,
                letterSpacing: "-0.03em",
                color: "#fafafa",
                marginBottom: 20,
              }}
            >
              Your docs become{" "}
              <span
                style={{
                  backgroundImage:
                    "linear-gradient(120deg, #34d399, #60a5fa)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                instant context.
         </span>
       </h2>
            <p
              style={{
                color: "#a1a1aa",
                fontSize: 16,
                lineHeight: 1.7,
                marginBottom: 28,
              }}
            >
              Drop PDFs, Markdown, or text. Luminal chunks, embeds, and indexes them
              into Chroma, Pinecone, or Weaviate. Top-k chunks are injected into the
              prompt with inline citations, so answers are grounded in your own docs.
       </p>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {[
                "Keyword + embedding hybrid search",
                "Live ingestion from the dashboard",
                "Citations included whenever RAG is triggered",
                "Pluggable vector stores",
              ].map((t, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.07 }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    color: "#d4d4d8",
                    fontSize: 14.5,
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "#34d399",
                      boxShadow: "0 0 10px #34d399",
                    }}
                  />
                  {t}
           </motion.li>
              ))}
         </ul>
       </motion.div>

          {/* Right: visualization */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.8, ease: easeOutExpo }}
            style={{
              position: "relative",
              padding: 24,
              borderRadius: 22,
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
              border: "1px solid rgba(255,255,255,0.07)",
              backdropFilter: "blur(20px)",
              boxShadow:
                "0 30px 80px -30px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          >
            {/* Query bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 14px",
                borderRadius: 12,
                background: "rgba(0,0,0,0.4)",
                border: "1px solid rgba(255,255,255,0.06)",
                marginBottom: 18,
              }}
            >
              <Search size={14} color="#a78bfa" />
              <span
                style={{
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: 13,
                  color: "#d4d4d8",
                  flex: 1,
                }}
              >
                "Why are my dashboard sessions breaking on refresh?"
           </span>
              <motion.span
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.6, repeat: Infinity }}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#a78bfa",
                }}
              />
         </div>

            {/* Document scatter */}
            <div
              style={{
                position: "relative",
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 8,
                marginBottom: 18,
              }}
            >
              {DOCS.map((doc, i) => (
                <motion.div
                  key={doc.name}
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 + i * 0.07 }}
                  whileHover={{ y: -2, scale: 1.02 }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "rgba(0,0,0,0.35)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    cursor: "default",
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: `linear-gradient(135deg, ${doc.glow}40, ${doc.glow}10)`,
                      border: `1px solid ${doc.glow}40`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <FileText size={13} color={doc.glow} />
                 </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#e4e4e7",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {doc.name}
               </div>
                    <div
                      style={{
                        fontSize: 10.5,
                        color: "#71717a",
                        marginTop: 2,
                      }}
                    >
                      {doc.size} · {doc.tokens} tok
               </div>
             </div>
           </motion.div>
              ))}
           </div>

            {/* Divider */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                margin: "16px 0",
              }}
            >
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
              <Network size={12} color="#71717a" />
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: "#71717a",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                top-k chunks
             </span>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
           </div>

            {/* Chunks */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {CHUNKS.map((c, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.4 + i * 0.1 }}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 12,
                    background: `linear-gradient(180deg, ${c.color}10, transparent)`,
                    border: `1px solid ${c.color}30`,
                    position: "relative",
                    overflow: "hidden",
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
                        fontSize: 11,
                        fontWeight: 700,
                        color: c.color,
                        padding: "2px 8px",
                        borderRadius: 999,
                        background: `${c.color}18`,
                        border: `1px solid ${c.color}40`,
                      }}
                    >
                      {c.score.toFixed(2)}
                   </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: "#71717a",
                      }}
                    >
                      {c.source}
                   </span>
                 </div>
                  <div
                    style={{
                      fontSize: 13,
                      lineHeight: 1.55,
                      color: "#d4d4d8",
                    }}
                  >
                    {c.text}
                 </div>
               </motion.div>
              ))}
           </div>

            {/* Bottom CTA */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.9 }}
              style={{
                marginTop: 18,
                paddingTop: 14,
                borderTop: "1px dashed rgba(255,255,255,0.08)",
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12.5,
                color: "#a1a1aa",
              }}
            >
              <Sparkles size={12} color="#c4b5fd" />
              injected into prompt with{" "}
              <code
                style={{
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  padding: "1px 6px",
                  borderRadius: 4,
                  background: "rgba(139,92,246,0.12)",
                  color: "#c4b5fd",
                  fontSize: 11.5,
                }}
              >
                [1] [2] [3]
             </code>{" "}
              citations
              <ArrowRight size={12} style={{ marginLeft: "auto" }} color="#71717a" />
           </motion.div>
         </motion.div>
       </div>
     </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 900px) {
          .rag-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
        }
      `}} />
   </section>
  );
}
