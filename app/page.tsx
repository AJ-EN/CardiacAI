"use client";

import Link from "next/link";
import { clearAssessment } from "@/lib/store";
import { useEffect } from "react";

const STATS = [
  { num: "10–15", label: "years earlier", sub: "South Asians get heart attacks before any other ethnicity" },
  { num: "50%", label: "under-predicted", sub: "Framingham misses half your risk if you're South Asian" },
  { num: "60M", label: "Indians with CAD", sub: "Highest absolute cardiac death toll of any country" },
  { num: "0", label: "tools calibrated for you", sub: "Not one consumer tool built for South Asian biology — until now" },
];

export default function LandingPage() {
  useEffect(() => {
    clearAssessment();
  }, []);

  return (
    <main className="min-h-screen bg-[var(--navy-bg)] text-white flex flex-col">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center max-w-2xl mx-auto">
        <p className="font-(family-name:--font-jetbrains) text-xs text-[#3d5a78] uppercase tracking-[4px] mb-8">
          DevSummit 2026 · Bio Tech Track
        </p>

        <h1 className="font-(family-name:--font-playfair) text-[clamp(48px,10vw,80px)] font-black leading-[1.02] tracking-tight mb-6 text-white">
          Cardiac<em className="italic text-[var(--risk-mid)]">AI</em>
        </h1>

        <blockquote className="border-l-4 border-[var(--risk)] pl-5 text-left mb-8 max-w-md">
          <p className="font-(family-name:--font-playfair) italic text-xl text-[#c8d8e8] leading-tight">
            "How many more lives before we finally listen?"
          </p>
          <cite className="text-xs text-[#3d5a78] font-(family-name:--font-jetbrains) not-italic mt-2 block">
            — The Brown Heart, JioHotstar 2025
          </cite>
        </blockquote>

        <p className="text-[#8da4bb] text-base leading-relaxed mb-10 max-w-lg">
          Your doctor is reading you with the wrong instrument. Every cardiac risk calculator in your hospital was built on white people's biology. We built CardiacAI.
        </p>

        <Link
          href="/assess/vitals"
          className="inline-block px-10 py-4 bg-[var(--risk)] text-white font-semibold text-lg rounded-lg hover:bg-[var(--risk-dim)] transition-colors shadow-lg shadow-[var(--risk)]/20"
        >
          Begin my assessment
        </Link>

        <p className="text-[#3d5a78] text-xs mt-4 font-(family-name:--font-jetbrains)">
          No login · No download · 5 minutes
        </p>
      </div>

      {/* Stats bar */}
      <div className="border-t border-white/10 grid grid-cols-2 md:grid-cols-4 divide-x divide-white/10">
        {STATS.map((s) => (
          <div key={s.num} className="px-6 py-6 text-center">
            <div className="font-(family-name:--font-playfair) text-3xl font-black text-[var(--risk-mid)] mb-1">
              {s.num}
            </div>
            <div className="font-(family-name:--font-jetbrains) text-xs uppercase tracking-wider text-white/60 mb-1">
              {s.label}
            </div>
            <div className="text-[#3d5a78] text-xs leading-snug hidden md:block">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Footer line */}
      <div className="text-center py-4 font-(family-name:--font-jetbrains) text-xs text-[#3d5a78] border-t border-white/5">
        Screening signal · Not a diagnosis · Same category as Apple Watch ECG
      </div>
    </main>
  );
}
