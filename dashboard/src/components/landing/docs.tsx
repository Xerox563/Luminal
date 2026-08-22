"use client";

import { motion } from "framer-motion";
import { ArrowRight, BookOpen, Code2, Server, Webhook } from "lucide-react";

const easeOutExpo = [0.16, 1, 0.3, 1] as const;

const DOC_CARDS = [
  {
    icon: Server,
    title: "POST /route",
    body: "Send a prompt. Get a model-routed, budget-checked, RAG-augmented response. JSON in, JSON out.",
    color: "#a78bfa",
    code: `{
  "prompt": "Explain quantum entanglement",
  "session_id": null
}`,
  },
  {
    icon: Webhook,
    title: "GET /route/trace/{session_id}",
    body: "Server-sent events stream every LangGraph node decision live — same view as the dashboard terminal.",
    color: "#60a5fa",
    code: `data: {"node":"retrieve","action":"complete",
  "data":{"used_rag":true,"chunks":4}}

data: {"node":"route","action":"complete",
  "data":{"model":"...","provider":"..."}}`,
  },
  {
    icon: Code2,
    title: "Plain HTTP, no SDK required",
    body: "Auth via lum_ API keys created from the dashboard. Call it from anywhere with a Bearer token — curl, Python, JS, whatever.",
    color: "#34d399",
    code: `curl -X POST http://localhost:8000/route \\
  -H "Authorization: Bearer lum_..." \\
  -H "Content-Type: application/json" \\
  -d '{"prompt": "Why is JWT sub a string?"}'`,
  },
];

export function LandingDocs() {
  return (
    <section
      id="docs"
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
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginBottom: 56,
            flexWrap: "wrap",
            gap: 24,
          }}
        >
          <div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 14px",
                borderRadius: 999,
                background: "rgba(244,114,182,0.10)",
                border: "1px solid rgba(244,114,182,0.25)",
                fontSize: 11.5,
                fontWeight: 600,
                color: "#f9a8d4",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: 20,
              }}
            >
              <BookOpen size={11} /> Developer-first
      </div>
            <h2
              style={{
                fontSize: "clamp(28px, 4.5vw, 52px)",
                lineHeight: 1.08,
                fontWeight: 800,
                letterSpacing: "-0.035em",
                color: "#fafafa",
                maxWidth: 640,
              }}
            >
              Three endpoints.
              <br />
              <span
                style={{
                  backgroundImage:
                    "linear-gradient(120deg, #f472b6, #c084fc)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                Zero surprises.
        </span>
      </h2>
      </div>
          <p
            style={{
              color: "#a1a1aa",
              fontSize: 15,
              lineHeight: 1.7,
              maxWidth: 360,
            }}
          >
            Luminal speaks JSON over HTTP. Every response carries the model used, the
            cost, the tokens, and the trace.
    </p>
  </motion.div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 16,
          }}
          className="docs-grid"
        >
          {DOC_CARDS.map((card, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, ease: easeOutExpo, delay: i * 0.08 }}
              whileHover={{ y: -4 }}
              style={{
                position: "relative",
                padding: 24,
                borderRadius: 20,
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
                border: "1px solid rgba(255,255,255,0.06)",
                backdropFilter: "blur(20px)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: `linear-gradient(135deg, ${card.color}25, ${card.color}08)`,
                    border: `1px solid ${card.color}35`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <card.icon size={17} color={card.color} />
           </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: card.color,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  {card.title}
        </span>
      </div>

              <p
                style={{
                  color: "#a1a1aa",
                  fontSize: 14,
                  lineHeight: 1.65,
                  marginBottom: 18,
                }}
              >
                {card.body}
        </p>

              <pre
                style={{
                  margin: 0,
                  padding: 14,
                  borderRadius: 10,
                  background: "rgba(0,0,0,0.4)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: 11.5,
                  lineHeight: 1.55,
                  color: "#d4d4d8",
                  overflow: "auto",
                  whiteSpace: "pre",
                }}
              >
                {card.code}
        </pre>

              <div
                style={{
                  marginTop: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12.5,
                  color: card.color,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Read in docs <ArrowRight size={12} />
      </div>
    </motion.div>
          ))}
  </div>
    </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 900px) {
          .docs-grid { grid-template-columns: 1fr !important; }
        }
        @media (min-width: 901px) and (max-width: 1100px) {
          .docs-grid { grid-template-columns: 1fr !important; }
        }
      `}} />
 </section>
  );
}
