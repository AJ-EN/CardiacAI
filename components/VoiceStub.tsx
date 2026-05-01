"use client";

import { useState, useEffect, useRef } from "react";

interface Props {
  onComplete: (voiceScore: number) => void;
}

export default function VoiceStub({ onComplete }: Props) {
  const [phase, setPhase] = useState<"recording" | "done">("recording");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Auto-complete after 3s — voice extraction is stubbed, score is hardcoded neutral
    timeoutRef.current = setTimeout(() => {
      setPhase("done");
      setTimeout(() => onComplete(0), 800);
    }, 3000);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [onComplete]);

  const bars = Array.from({ length: 20 });

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Waveform visualizer */}
      <div className="flex items-end gap-1 h-16 px-4">
        {bars.map((_, i) => (
          <div
            key={i}
            className={`w-2 rounded-full transition-all ${
              phase === "recording" ? "bg-[var(--risk)]" : "bg-[var(--border2)]"
            }`}
            style={{
              height: phase === "recording" ? `${12 + Math.random() * 40}px` : "4px",
              animationDelay: `${i * 50}ms`,
              ...(phase === "recording"
                ? { animation: `waveform ${0.4 + Math.random() * 0.4}s ease-in-out infinite`, "--delay": `${i * 60}ms` as string }
                : {}),
            }}
          />
        ))}
      </div>

      {phase === "recording" && (
        <div className="text-center">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 bg-[var(--risk)] rounded-full animate-pulse" />
            <span className="text-[var(--risk)] font-(family-name:--font-jetbrains) text-sm uppercase tracking-wider">
              Analysing vocal biomarkers
            </span>
          </div>
          <p className="text-[var(--muted-foreground)] text-sm">Detecting jitter, shimmer, HNR patterns…</p>
        </div>
      )}

      {phase === "done" && (
        <div className="flex flex-col items-center gap-2">
          <div className="text-[var(--safe)] text-4xl">✓</div>
          <p className="font-(family-name:--font-jetbrains) text-sm text-[var(--safe)] uppercase tracking-wider">
            Voice analysis complete
          </p>
        </div>
      )}
    </div>
  );
}
