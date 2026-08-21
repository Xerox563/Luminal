"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { LandingBackground } from "@/components/landing/background";
import { LandingNav } from "@/components/landing/nav";
import { LandingHero } from "@/components/landing/hero";
import { LandingFeatures } from "@/components/landing/features";
import { LandingPipeline } from "@/components/landing/pipeline";
import { LandingRag } from "@/components/landing/rag";
import { LandingStats } from "@/components/landing/stats";
import { LandingDocs } from "@/components/landing/docs";
import { LandingCta } from "@/components/landing/cta";

export default function LandingPage() {
  const router = useRouter();

  const goToDashboard = useCallback(() => {
    router.push("/dashboard");
  }, [router]);

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        color: "#e4e4e7",
        overflow: "hidden",
      }}
    >
      <LandingBackground />
      <LandingNav onSignIn={goToDashboard} />

      <main style={{ position: "relative", zIndex: 1 }}>
        <LandingHero onCta={goToDashboard} />
        <LandingFeatures />
        <LandingPipeline />
        <LandingRag />
        <LandingStats />
        <LandingDocs />
        <LandingCta onCta={goToDashboard} />
     </main>
   </div>
  );
}
