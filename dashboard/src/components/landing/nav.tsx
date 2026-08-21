"use client";

import { motion, useScroll, useMotionValueEvent, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Menu, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Features", href: "#features" },
  { label: "Pipeline", href: "#pipeline" },
  { label: "RAG", href: "#rag" },
  { label: "Stats", href: "#stats" },
  { label: "Docs", href: "#docs" },
];

export function LandingNav({ onSignIn }: { onSignIn: () => void }) {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useMotionValueEvent(scrollY, "change", (v) => {
    setScrolled(v > 24);
  });

  return (
    <>
      <motion.header
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: "fixed",
          top: 14,
          left: "50%",
          x: "-50%",
          zIndex: 100,
          width: "calc(100% - 32px)",
          maxWidth: 1200,
        }}
      >
        <motion.div
          animate={{
            paddingTop: scrolled ? 8 : 12,
            paddingBottom: scrolled ? 8 : 12,
            backgroundColor: scrolled
              ? "rgba(8,8,12,0.78)"
              : "rgba(8,8,12,0.35)",
            borderColor: scrolled
              ? "rgba(255,255,255,0.10)"
              : "rgba(255,255,255,0.05)",
          }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            padding: "12px 18px",
            borderRadius: 18,
            border: "1px solid rgba(255,255,255,0.05)",
            backdropFilter: "blur(20px) saturate(1.4)",
            WebkitBackdropFilter: "blur(20px) saturate(1.4)",
            boxShadow: scrolled
              ? "0 18px 50px -22px rgba(0,0,0,0.7), 0 0 0 1px rgba(139,92,246,0.06)"
              : "0 8px 24px -16px rgba(0,0,0,0.5)",
          }}
        >
          <Link
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              textDecoration: "none",
              color: "#f4f4f5",
            }}
          >
            <motion.div
              whileHover={{ rotate: [0, -10, 10, 0] }}
              transition={{ duration: 0.6 }}
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
           </motion.div>
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
              <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.02em" }}>
                Luminal
             </span>
              <span style={{ fontSize: 10.5, color: "#71717a", fontWeight: 500 }}>
                LLM Routing Gateway
             </span>
           </div>
         </Link>

          <nav
            className="hidden md:flex"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: 4,
              borderRadius: 14,
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            {NAV_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                style={{
                  padding: "7px 14px",
                  borderRadius: 10,
                  fontSize: 13,
                  color: "#a1a1aa",
                  fontWeight: 500,
                  textDecoration: "none",
                  transition: "all 0.2s ease",
                  position: "relative",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "#f4f4f5";
                  e.currentTarget.style.background = "rgba(139,92,246,0.10)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "#a1a1aa";
                  e.currentTarget.style.background = "transparent";
                }}
              >
                {item.label}
             </a>
            ))}
         </nav>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={onSignIn}
              className="hidden md:flex"
              style={{
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 10,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#d4d4d8",
                cursor: "pointer",
                fontWeight: 500,
                fontSize: 13,
                fontFamily: "inherit",
              }}
            >
              Sign in
           </button>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={onSignIn}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "9px 16px",
                borderRadius: 10,
                background:
                  "linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)",
                color: "white",
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 13,
                boxShadow:
                  "0 8px 24px -8px rgba(168,85,247,0.6), inset 0 1px 0 rgba(255,255,255,0.2)",
                fontFamily: "inherit",
              }}
            >
              <Sparkles size={14} />
              Open Dashboard
              <ArrowUpRight size={14} />
           </motion.button>
            <button
              onClick={() => setMobileOpen((s) => !s)}
              className="md:hidden"
              aria-label="Toggle menu"
              style={{
                display: "none",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#d4d4d8",
                cursor: "pointer",
                borderRadius: 10,
                padding: 8,
              }}
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
           </button>
         </div>
       </motion.div>
     </motion.header>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            style={{
              position: "fixed",
              top: 92,
              left: 16,
              right: 16,
              zIndex: 99,
              padding: 12,
              borderRadius: 16,
              background: "rgba(8,8,12,0.95)",
              border: "1px solid rgba(255,255,255,0.08)",
              backdropFilter: "blur(20px)",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            {NAV_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  fontSize: 14,
                  color: "#d4d4d8",
                  textDecoration: "none",
                }}
              >
                {item.label}
             </a>
            ))}
         </motion.div>
        )}
     </AnimatePresence>
    </>
  );
}
