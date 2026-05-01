"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loadResult, type AnalysisResult } from "@/lib/store";
import { RAMESH_FALLBACK, RAMESH_TTS_HINDI } from "@/lib/ramesh-fallback";
import { speakHindi } from "@/lib/tts";
import dynamic from "next/dynamic";

const ProteinViewer = dynamic(() => import("@/components/ProteinViewer"), { ssr: false });

const RISK_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  low:       { label: "LOW RISK",      color: "var(--safe)",  bg: "var(--safe-light)" },
  moderate:  { label: "MODERATE RISK", color: "var(--amber)", bg: "var(--amber-light)" },
  high:      { label: "HIGH RISK",     color: "var(--risk)",  bg: "var(--risk-light)" },
  very_high: { label: "VERY HIGH",     color: "var(--risk)",  bg: "var(--risk-light)" },
};

const SEVERITY_COLOR: Record<string, string> = {
  high:   "var(--risk)",
  medium: "var(--amber)",
  low:    "var(--safe)",
};

export default function ResultsPage() {
  const router = useRouter();
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [ttsPlayed, setTtsPlayed] = useState(false);
  const [showShare, setShowShare] = useState(false);

  useEffect(() => {
    const r = loadResult();
    if (!r) {
      router.push("/");
      return;
    }
    setResult(r);
  }, [router]);

  useEffect(() => {
    if (result && !ttsPlayed) {
      setTtsPlayed(true);
      setTimeout(() => {
        speakHindi(RAMESH_TTS_HINDI);
      }, 1200);
    }
  }, [result, ttsPlayed]);

  if (!result) return null;

  const framing = RISK_LABELS[result.risk_tier] ?? RISK_LABELS.high;
  const primaryFinding = result.top_findings[0];

  return (
    <main className="min-h-screen bg-[var(--background)]">
      {/* Top bar */}
      <div className="bg-[var(--navy-bg)] px-6 py-3 flex items-center justify-between">
        <Link href="/" className="font-(family-name:--font-playfair) font-black text-white text-lg">
          Cardiac<em className="italic text-[var(--risk-mid)]">AI</em>
        </Link>
        <button
          type="button"
          onClick={() => speakHindi(RAMESH_TTS_HINDI)}
          className="text-xs font-(family-name:--font-jetbrains) text-[var(--navy-mid)] hover:text-white transition-colors uppercase tracking-wider"
        >
          ▶ Listen in Hindi
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">

        {/* ── KILL SHOT: Score comparison ── */}
        <section>
          <p className="font-(family-name:--font-jetbrains) text-xs uppercase tracking-[3px] text-[var(--muted-foreground)] mb-4">
            Same patient · Two instruments
          </p>
          <div className="grid grid-cols-2 gap-4">
            {/* Framingham */}
            <div className="rounded-xl border border-[#a7d9bd] bg-[var(--safe-light)] p-6 text-center">
              <p className="font-(family-name:--font-jetbrains) text-xs uppercase tracking-wider text-[var(--muted-foreground)] mb-3">
                Framingham says
              </p>
              <p className="font-(family-name:--font-playfair) text-6xl font-black text-[var(--safe)] leading-none mb-2">
                {result.framingham_score}
                <span className="text-2xl">%</span>
              </p>
              <p className="font-(family-name:--font-jetbrains) text-sm font-bold text-[var(--safe)] uppercase tracking-wider">
                LOW RISK
              </p>
              <p className="text-[var(--muted-foreground)] text-xs mt-2">
                Built on Western cohorts. SA data: minimal.
              </p>
            </div>

            {/* CardiacAI */}
            <div
              className="rounded-xl border p-6 text-center"
              style={{ borderColor: "var(--risk-mid)", background: framing.bg }}
            >
              <p className="font-(family-name:--font-jetbrains) text-xs uppercase tracking-wider text-[var(--muted-foreground)] mb-3">
                CardiacAI says
              </p>
              <p
                className="font-(family-name:--font-playfair) text-6xl font-black leading-none mb-2"
                style={{ color: framing.color }}
              >
                {result.cardiacai_score}
              </p>
              <p
                className="font-(family-name:--font-jetbrains) text-sm font-bold uppercase tracking-wider"
                style={{ color: framing.color }}
              >
                {framing.label}
              </p>
              <p className="text-[var(--muted-foreground)] text-xs mt-2">
                SA-calibrated · genomics · biometrics
              </p>
            </div>
          </div>

          {/* Gap explanation */}
          <div className="mt-4 p-4 rounded-lg border border-[var(--risk-mid)] bg-[var(--risk-light)]">
            <p className="text-[var(--risk-dim)] text-sm leading-relaxed">
              <strong className="text-[var(--risk)]">&quot;Same patient. Two scores. One of them is true.&quot;</strong>
              {" "}{result.gap_explanation}
            </p>
          </div>
        </section>

        {/* ── 3D Protein viewer ── */}
        {primaryFinding?.uniprot_id && (
          <section>
            <h3 className="font-(family-name:--font-jetbrains) text-xs uppercase tracking-wider text-[var(--muted-foreground)] mb-3">
              AlphaFold · 3D structure · mutation in red
            </h3>
            <ProteinViewer
              uniprotId={primaryFinding.uniprot_id}
              residuePosition={primaryFinding.residue_position}
              label={primaryFinding.signal}
            />
          </section>
        )}

        {/* ── Top findings ── */}
        <section>
          <h3 className="font-(family-name:--font-jetbrains) text-xs uppercase tracking-wider text-[var(--muted-foreground)] mb-3">
            What CardiacAI found
          </h3>
          <div className="space-y-3">
            {result.top_findings.map((f, i) => (
              <div
                key={i}
                className="rounded-lg border bg-white p-4"
                style={{ borderLeftWidth: "4px", borderLeftColor: SEVERITY_COLOR[f.severity] }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-(family-name:--font-jetbrains) text-xs font-semibold uppercase tracking-wider"
                    style={{ color: SEVERITY_COLOR[f.severity] }}>
                    {f.signal}
                  </span>
                  <span
                    className="font-(family-name:--font-jetbrains) text-xs uppercase px-2 py-0.5 rounded"
                    style={{
                      color: SEVERITY_COLOR[f.severity],
                      background: f.severity === "high" ? "var(--risk-light)" : f.severity === "medium" ? "var(--amber-light)" : "var(--safe-light)",
                    }}
                  >
                    {f.severity}
                  </span>
                </div>
                <p className="text-[var(--foreground)] text-sm mb-2">{f.plain_explanation}</p>
                <p className="text-xs font-(family-name:--font-jetbrains) text-[var(--navy)] bg-[var(--navy-light)] rounded px-3 py-2">
                  → {f.action}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Action plan ── */}
        <section>
          <h3 className="font-(family-name:--font-jetbrains) text-xs uppercase tracking-wider text-[var(--muted-foreground)] mb-3">
            Your action plan
          </h3>
          <div className="rounded-lg border border-[var(--border)] bg-white overflow-hidden">
            {result.action_plan.map((step, i) => (
              <div key={i} className="flex gap-3 px-4 py-3 border-b border-[var(--border)] last:border-b-0">
                <span className="font-(family-name:--font-playfair) text-xl font-black text-[var(--risk-mid)] w-6 shrink-0 leading-tight">
                  {i + 1}
                </span>
                <p className="text-[var(--foreground)] text-sm leading-relaxed">{step}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Family share ── */}
        <section>
          <h3 className="font-(family-name:--font-jetbrains) text-xs uppercase tracking-wider text-[var(--muted-foreground)] mb-3">
            Share with your family
          </h3>
          <button
            type="button"
            onClick={() => setShowShare(true)}
            className="w-full py-3 bg-[#25D366] text-white rounded-lg font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            <span>📲</span> Share via WhatsApp
          </button>

          {showShare && (
            <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--navy-light)] p-4">
              <p className="font-(family-name:--font-jetbrains) text-xs uppercase tracking-wider text-[var(--navy)] mb-2">
                Mock family cascade
              </p>
              {result.family_recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-2 mt-2">
                  <span className="text-[#25D366]">✓</span>
                  <p className="text-[var(--foreground)] text-sm">{rec}</p>
                </div>
              ))}
              <p className="text-[var(--muted-foreground)] text-xs mt-3 italic">
                One person screens. A whole family is reached.
              </p>
            </div>
          )}
        </section>

        {/* ── Hindi summary ── */}
        <section className="rounded-xl border border-[var(--border)] bg-[var(--navy-bg)] px-6 py-5 text-center">
          <p className="font-(family-name:--font-playfair) italic text-[#c8d8e8] text-lg leading-relaxed">
            CardiacAI — सुनो, इस बार सही सुनो।
          </p>
          <p className="text-[#3d5a78] text-xs mt-2 font-(family-name:--font-jetbrains)">
            "CardiacAI — Listen. This time, hear it right."
          </p>
        </section>

        {/* ── Citations ── */}
        <section>
          <h3 className="font-(family-name:--font-jetbrains) text-xs uppercase tracking-wider text-[var(--muted-foreground)] mb-3">
            Scientific basis
          </h3>
          <div className="space-y-1">
            {result.citations.map((c, i) => (
              <p key={i} className="font-(family-name:--font-jetbrains) text-xs text-[var(--muted-foreground)] leading-relaxed">
                · {c}
              </p>
            ))}
          </div>
        </section>

        {/* ── Disclaimer + restart ── */}
        <div className="text-center pb-8">
          <p className="text-[var(--muted-foreground)] text-xs mb-6 max-w-md mx-auto leading-relaxed">
            CardiacAI is a screening signal, not a diagnosis. It is in the same category as Apple Watch ECG — it tells you to show this to a doctor, not that you have a condition.
          </p>
          <Link
            href="/"
            className="text-[var(--muted-foreground)] text-sm underline hover:text-[var(--foreground)]"
          >
            Start a new assessment
          </Link>
        </div>
      </div>
    </main>
  );
}
