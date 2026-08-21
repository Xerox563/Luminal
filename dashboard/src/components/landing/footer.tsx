"use client";

import { motion } from "framer-motion";
import { Github, Heart, MessageSquare, Star, Twitter } from "lucide-react";

const easeOutExpo = [0.16, 1, 0.3, 1] as const;

const FOOTER_LINKS = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "Pipeline", href: "#pipeline" },
      { label: "RAG", href: "#rag" },
      { label: "Dashboard", href: "/dashboard" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Docs", href: "#docs" },
      { label: "API reference", href: "#docs" },
      { label: "LangGraph state", href: "#pipeline" },
      { label: "Changelog", href: "#" },
    ],
  },
  {
    title: "Stack",
    links: [
      { label: "FastAPI", href: "#" },
      { label: "Next.js 14", href: "#" },
      { label: "SQLAlchemy", href: "#" },
      { label: "Framer Motion", href: "#" },
    ],
  },
];

export function LandingFooter({ onCta }: { onCta: () => void }) {
  return (
    <footer
      style={{
        position: "relative",
        padding: "80px 0 40px",
        borderTop: "1px solid rgba(255,255,255,0.05)",
        background: "linear-gradient(180deg, transparent, rgba(0,0,0,0.4))",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 28px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.4fr) repeat(3, minmax(0, 1fr))",
            gap: 48,
            marginBottom: 56,
          }}
          className="footer-grid"
        >
          {/* Brand column */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: easeOutExpo }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background:
                    "linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  fontWeight: 800,
                  color: "white",
                  boxShadow:
                    "0 0 18px rgba(139,92,246,0.45), inset 0 0 12px rgba(255,255,255,0.18)",
                }}
              >
                L
    </div>
              <div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: "#fafafa",
                    letterSpacing: "-0.02em",
                  }}
                >
                  Luminal
      </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "#71717a",
                  }}
                >
                  LLM Routing Gateway
      </div>
      </div>
    </div>
            <p
              style={{
                color: "#a1a1aa",
                fontSize: 13.5,
                lineHeight: 1.7,
                marginBottom: 22,
                maxWidth: 320,
              }}
            >
              Self-hosted AI gateway. Analyzes every prompt, picks the cheapest model
              that can answer, logs everything.
    </p>
            <div
              style={{
                display: "flex",
                gap: 8,
              }}
            >
              {[
                { icon: Github, label: "GitHub" },
                { icon: Twitter, label: "Twitter" },
                { icon: MessageSquare, label: "Discord" },
                { icon: Star, label: "Star" },
              ].map((s, i) => (
                <motion.a
                  key={i}
                  href="#"
                  whileHover={{ y: -2, scale: 1.05 }}
                  aria-label={s.label}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#a1a1aa",
                    textDecoration: "none",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "#f4f4f5";
                    e.currentTarget.style.borderColor = "rgba(139,92,246,0.4)";
                    e.currentTarget.style.background = "rgba(139,92,246,0.10)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "#a1a1aa";
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                    e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                  }}
                >
                  <s.icon size={15} />
      </motion.a>
              ))}
      </div>
      </motion.div>

          {/* Link columns */}
          {FOOTER_LINKS.map((col, i) => (
            <motion.div
              key={col.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: easeOutExpo, delay: 0.1 + i * 0.06 }}
            >
              <h4
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: "#a1a1aa",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginBottom: 16,
                }}
              >
                {col.title}
    </h4>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      style={{
                        color: "#71717a",
                        fontSize: 13.5,
                        textDecoration: "none",
                        transition: "color 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = "#e4e4e7";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = "#71717a";
                      }}
                    >
                      {link.label}
          </a>
                 </li>
                ))}
      </ul>
      </motion.div>
          ))}
      </div>

        {/* Bottom row */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: 28,
            borderTop: "1px solid rgba(255,255,255,0.05)",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div
            style={{
              fontSize: 12.5,
              color: "#52525b",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            © 2026 Luminal. Built with{" "}
            <Heart size={11} color="#f472b6" fill="#f472b6" /> for the LLM-curious.
  </div>
          <button
            onClick={onCta}
            style={{
              padding: "8px 16px",
              borderRadius: 10,
              background: "rgba(139,92,246,0.08)",
              border: "1px solid rgba(139,92,246,0.20)",
              color: "#c4b5fd",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 12.5,
              fontFamily: "inherit",
            }}
          >
            Try the dashboard →
  </button>
       </motion.div>
     </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 900px) {
          .footer-grid { grid-template-columns: 1fr 1fr !important; gap: 32px !important; }
        }
      `}} />
   </footer>
  );
}
