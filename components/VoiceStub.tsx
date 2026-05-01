"use client";

import { useState, useEffect, useRef } from "react";

interface Props {
  onComplete: (voiceScore: number) => void;
}

export default function VoiceStub({ onComplete }: Props) {
  const [phase, setPhase] = useState<"waiting" | "recording" | "done">("waiting");
  const [countdown, setCountdown] = useState(40);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = async () => {
    try {
      // Request mic permission (we never actually process the audio)
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      // Permission denied — stub still runs
    }

    setPhase("recording");
    let count = 40;
    setCountdown(count);

    intervalRef.current = setInterval(() => {
      count--;
      setCountdown(count);
      if (count <= 0) {
        clearInterval(intervalRef.current!);
        setPhase("done");
        // Hardcoded neutral voice score — real Meyda.js extraction is cut
        onComplete(0);
      }
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

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

      {phase === "waiting" && (
        <div className="text-center">
          <p className="text-[var(--muted-foreground)] text-sm mb-4">
            Speak naturally for 40 seconds. Describe how you've been feeling lately.
          </p>
          <button
            onClick={startRecording}
            className="px-8 py-3 bg-[var(--risk)] text-white rounded-lg font-semibold hover:bg-[var(--risk-dim)] transition-colors flex items-center gap-2"
          >
            <span className="w-3 h-3 bg-white rounded-full" />
            Start recording
          </button>
        </div>
      )}

      {phase === "recording" && (
        <div className="text-center">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 bg-[var(--risk)] rounded-full animate-pulse" />
            <span className="text-[var(--risk)] font-(family-name:--font-jetbrains) text-sm uppercase tracking-wider">
              Recording
            </span>
          </div>
          <p className="text-[var(--muted-foreground)] text-sm">{countdown}s remaining</p>
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
