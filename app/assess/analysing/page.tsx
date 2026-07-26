"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { loadAssessment, saveResult } from "@/lib/store";
import { computeFraminghamScore, computeCardiacAIScore } from "@/lib/risk-calculator";
import { lookupVariants } from "@/lib/alphamissense";
import { RAMESH_FALLBACK } from "@/lib/ramesh-fallback";

const MESSAGES = [
  "Reading your biology...",
  "Applying South Asian calibration...",
  "Screening cardiac variants...",
  "Computing risk delta...",
  "Generating action plan...",
];

export default function AnalysingPage() {
  const router = useRouter();
  const [msgIndex, setMsgIndex] = useState(0);
  const [variantCount, setVariantCount] = useState(0);
  const [screenedTotal, setScreenedTotal] = useState(0);
  const [done, setDone] = useState(false);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const msgTimer = setInterval(() => {
      setMsgIndex((i) => Math.min(i + 1, MESSAGES.length - 1));
    }, 1200);

    // Animate the counter up to however many variants the genome step actually read.
    // Zero means no genome was uploaded — the counter is hidden entirely in that case.
    const total = loadAssessment().variantsScreened ?? 0;
    setScreenedTotal(total);

    let countTimer: ReturnType<typeof setInterval> | undefined;
    if (total > 0) {
      const step = Math.max(1, Math.ceil(total / 25));
      let count = 0;
      countTimer = setInterval(() => {
        count += step;
        setVariantCount(Math.min(count, total));
        if (count >= total) clearInterval(countTimer);
      }, 80);
    }

    runAnalysis().then(() => {
      clearInterval(msgTimer);
      clearInterval(countTimer);
      setVariantCount(total);
      setDone(true);
      setTimeout(() => router.push("/results"), 600);
    });

    return () => {
      clearInterval(msgTimer);
      clearInterval(countTimer);
    };
  }, [router]);

  const runAnalysis = async () => {
    const assessment = loadAssessment();

    if (!assessment.basicMarkers) {
      saveResult(RAMESH_FALLBACK);
      return;
    }

    // Pre-compute scores on client so API call is optional.
    // A genome with no flagged variants must score 0 — never a default.
    let variantPoints = 0;
    try {
      const lookup = await lookupVariants(assessment.variants ?? []);
      variantPoints = lookup.totalPoints;
    } catch {
      variantPoints = 0;
    }

    const framingham = computeFraminghamScore(assessment.basicMarkers);
    const cardiacai = computeCardiacAIScore({
      basicMarkers: assessment.basicMarkers,
      variantPoints,
      hrvMs: assessment.vitals?.hrv ?? 35,
      voiceScore: assessment.voiceScore ?? 0,
      familyHistoryBefore55: assessment.lifestyle?.familyHistoryBefore55 ?? false,
      avgSleepHours: assessment.lifestyle?.avgSleepHours ?? 7,
      sittingHoursPerDay: assessment.lifestyle?.sittingHoursPerDay ?? 6,
    });

    // Call Gemma 4 (Ollama) API with pre-computed scores
    try {
      const payload = {
        basic_markers: {
          age: assessment.basicMarkers.age,
          sex: assessment.basicMarkers.sex,
          systolic: assessment.basicMarkers.systolic,
          diastolic: assessment.basicMarkers.diastolic,
          total_cholesterol: assessment.basicMarkers.totalCholesterol,
          ldl: assessment.basicMarkers.ldl,
          hdl: assessment.basicMarkers.hdl,
          bmi: assessment.basicMarkers.bmi,
          smoker: assessment.basicMarkers.smoker,
          on_bp_meds: assessment.basicMarkers.onBpMeds,
          diabetic: assessment.basicMarkers.diabetic,
        },
        variants: assessment.variants ?? [],
        vitals: {
          heart_rate: assessment.vitals?.heartRate ?? 74,
          hrv_rmssd: assessment.vitals?.hrv ?? 28,
        },
        voice_score: assessment.voiceScore ?? 0,
        lifestyle: assessment.lifestyle ?? {},
        pre_computed: {
          framingham_score: framingham,
          cardiacai_score: cardiacai,
          variant_points: variantPoints,
        },
        language: "en",
      };

      const res = await fetch("/api/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000), // Local Ollama inference needs more time than cloud APIs
      });

      const result = await res.json();
      saveResult(result);
    } catch {
      // API timed out or failed — use Ramesh fallback
      saveResult(RAMESH_FALLBACK);
    }
  };

  return (
    <main className="min-h-screen bg-[var(--navy-bg)] flex flex-col items-center justify-center px-6">
      <div className="text-center max-w-md">
        {/* ECG animation */}
        <div className="w-64 h-16 mx-auto mb-8 overflow-hidden">
          <svg viewBox="0 0 256 60" className="w-full">
            <polyline
              className="ecg-path"
              fill="none"
              stroke="#c0392b"
              strokeWidth="2.5"
              points="0,30 20,30 30,30 40,8 50,52 60,8 70,30 90,30 110,30 120,8 130,52 140,8 150,30 170,30 190,30 200,8 210,52 220,8 230,30 256,30"
            />
          </svg>
        </div>

        {/* Variant counter — only shown when a genome was actually screened */}
        {screenedTotal > 0 && (
          <div className="mb-6">
            <p className="font-(family-name:--font-jetbrains) text-5xl font-bold text-[var(--risk-mid)] tabular-nums">
              {variantCount.toLocaleString()}
            </p>
            <p className="text-white/40 text-sm mt-1 font-(family-name:--font-jetbrains) uppercase tracking-wider">
              variants screened
            </p>
          </div>
        )}

        {/* Status message */}
        <p className="text-white/70 text-base min-h-[1.5rem] transition-all duration-500">
          {MESSAGES[msgIndex]}
        </p>

        {done && (
          <p className="text-[var(--safe)] mt-4 font-semibold">Analysis complete ✓</p>
        )}

        {/* Dots */}
        {!done && (
          <div className="flex justify-center gap-2 mt-6">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 bg-[var(--risk)] rounded-full animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
