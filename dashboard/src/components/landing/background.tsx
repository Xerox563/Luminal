"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

export function LandingBackground() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const orb1Y = useTransform(scrollYProgress, [0, 1], [0, -240]);
  const orb2Y = useTransform(scrollYProgress, [0, 1], [0, -160]);
  const orb3Y = useTransform(scrollYProgress, [0, 1], [0, -320]);
  const gridOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0.2]);
  const noiseOpacity = useTransform(scrollYProgress, [0, 1], [0.45, 0]);

  return (
    <div
      ref={ref}
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: -1,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      {/* Base radial wash */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 90% 60% at 50% -10%, rgba(99,102,241,0.18), transparent 60%), radial-gradient(ellipse 60% 50% at 85% 30%, rgba(168,85,247,0.12), transparent 65%), radial-gradient(ellipse 70% 50% at 15% 60%, rgba(56,189,248,0.10), transparent 70%)",
        }}
      />

      {/* Grid */}
      <motion.div
        style={{
          position: "absolute",
          inset: 0,
          opacity: gridOpacity,
          backgroundImage:
            "linear-gradient(rgba(139,92,246,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.07) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage:
            "radial-gradient(ellipse 80% 60% at 50% 30%, black 35%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 60% at 50% 30%, black 35%, transparent 75%)",
        }}
      />

      {/* Aurora orbs (parallax) */}
      <motion.div
        style={{
          position: "absolute",
          top: "-12%",
          left: "50%",
          x: "-50%",
          y: orb1Y,
          width: 760,
          height: 460,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(139,92,246,0.55), rgba(99,102,241,0.18) 45%, transparent 70%)",
          filter: "blur(70px)",
        }}
      />
      <motion.div
        style={{
          position: "absolute",
          top: "20%",
          right: "-8%",
          y: orb2Y,
          width: 520,
          height: 520,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(236,72,153,0.42), rgba(168,85,247,0.18) 50%, transparent 75%)",
          filter: "blur(80px)",
        }}
      />
      <motion.div
        style={{
          position: "absolute",
          top: "55%",
          left: "-10%",
          y: orb3Y,
          width: 620,
          height: 620,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(56,189,248,0.35), rgba(34,211,238,0.15) 50%, transparent 75%)",
          filter: "blur(90px)",
        }}
      />

      {/* Floating particles */}
      <ParticleField />

      {/* Noise overlay */}
      <motion.div
        style={{
          position: "absolute",
          inset: 0,
          opacity: noiseOpacity,
          mixBlendMode: "overlay",
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.6 0 0 0 0 0.55 0 0 0 0 0.9 0 0 0 0.18 0'/</filter><rect width='100%' height='100%' filter='url(%23n)'/</svg>\")",
        }}
      />

      {/* Top fade so nav reads cleanly */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 120,
          background:
            "linear-gradient(to bottom, rgba(6,6,9,0.85), transparent)",
        }}
      />
      {/* Bottom fade */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 200,
          background:
            "linear-gradient(to top, rgba(6,6,9,1), transparent)",
        }}
      />
   </div>
  );
}

function ParticleField() {
  // Pre-computed deterministic particle layout (avoids hydration drift)
  const particles = Array.from({ length: 38 }).map((_, i) => {
    const seed = (i + 1) * 9301;
    const rand = (n: number) => {
      const x = Math.sin(seed * n) * 10000;
      return x - Math.floor(x);
    };
    return {
      left: rand(1) * 100,
      top: rand(2) * 100,
      size: 1.5 + rand(3) * 3,
      delay: rand(4) * 6,
      duration: 6 + rand(5) * 8,
      hue: i % 3 === 0 ? "#a78bfa" : i % 3 === 1 ? "#60a5fa" : "#f472b6",
    };
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
      }}
    >
      {particles.map((p, i) => (
        <motion.span
          key={i}
          initial={{
            opacity: 0,
            y: 0,
          }}
          animate={{
            opacity: [0, 0.9, 0.6, 0],
            y: [-20, -120, -200],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "easeOut",
          }}
          style={{
            position: "absolute",
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            background: p.hue,
            boxShadow: `0 0 ${p.size * 4}px ${p.hue}`,
          }}
        />
      ))}
   </div>
  );
}
