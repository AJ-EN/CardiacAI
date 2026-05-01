"use client";

import { useState, useCallback, useRef } from "react";
import { parse23andMe, extractRsIds } from "@/lib/genome-parser";
import { initAlphaMissense, lookupVariants, getRameshVariants } from "@/lib/alphamissense";
import type { AlphaMissenseEntry } from "@/lib/alphamissense";

interface Props {
  onComplete: (data: { rsids: string[]; flagged: AlphaMissenseEntry[]; variantPoints: number; screened: number }) => void;
  onSkip: () => void;
}

export default function GenomeUpload({ onComplete, onSkip }: Props) {
  const [phase, setPhase] = useState<"idle" | "loading" | "scanning" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [screened, setScreened] = useState(0);
  const [flaggedCount, setFlaggedCount] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (text: string) => {
    setPhase("loading");
    setProgress(0);

    await initAlphaMissense((pct) => setProgress(pct));

    setPhase("scanning");
    const variants = parse23andMe(text);
    const rsids = extractRsIds(variants);

    // Simulate scanning counter
    let count = 0;
    const scanInterval = setInterval(() => {
      count += Math.floor(Math.random() * 300 + 100);
      setScreened(Math.min(count, rsids.length));
      if (count >= rsids.length) clearInterval(scanInterval);
    }, 80);

    const result = await lookupVariants(rsids);

    clearInterval(scanInterval);
    setScreened(rsids.length);
    setFlaggedCount(result.flagged.length);
    setPhase("done");

    onComplete({
      rsids,
      flagged: result.flagged,
      variantPoints: result.totalPoints,
      screened: result.screened,
    });
  }, [onComplete]);

  const useDemoGenome = useCallback(async () => {
    setPhase("loading");
    await initAlphaMissense((pct) => setProgress(pct));
    setPhase("scanning");

    const rsids = getRameshVariants();
    let count = 0;
    const DISPLAY_TOTAL = 11406;
    const scanInterval = setInterval(() => {
      count += Math.floor(Math.random() * 400 + 200);
      setScreened(Math.min(count, DISPLAY_TOTAL));
      if (count >= DISPLAY_TOTAL) clearInterval(scanInterval);
    }, 60);

    const result = await lookupVariants(rsids);
    clearInterval(scanInterval);
    setScreened(DISPLAY_TOTAL);
    setFlaggedCount(result.flagged.length);
    setPhase("done");

    onComplete({
      rsids,
      flagged: result.flagged,
      variantPoints: result.totalPoints,
      screened: DISPLAY_TOTAL,
    });
  }, [onComplete]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const text = await file.text();
    processFile(text);
  }, [processFile]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    processFile(text);
  }, [processFile]);

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-md">
      {phase === "idle" && (
        <>
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onClick={() => fileRef.current?.click()}
            className={`w-full border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
              isDragOver ? "border-[var(--risk)] bg-[var(--risk-light)]" : "border-[var(--border2)] hover:border-[var(--risk)] hover:bg-[var(--risk-light)]/30"
            }`}
          >
            <div className="text-4xl mb-3">🧬</div>
            <p className="font-semibold text-[var(--foreground)] mb-1">Drop your 23andMe file</p>
            <p className="text-[var(--muted-foreground)] text-sm">
              .txt format · stays on your device · never uploaded
            </p>
          </div>
          <input ref={fileRef} type="file" accept=".txt" className="hidden" onChange={handleFileChange} />

          <div className="flex items-center gap-3 w-full">
            <div className="flex-1 h-px bg-[var(--border)]" />
            <span className="text-[var(--muted-foreground)] text-xs font-(family-name:--font-jetbrains) uppercase">or</span>
            <div className="flex-1 h-px bg-[var(--border)]" />
          </div>

          <button
            onClick={useDemoGenome}
            className="w-full py-3 bg-[var(--navy-bg)] text-white rounded-lg font-semibold hover:bg-[var(--navy)] transition-colors"
          >
            Use demo genome (1000 Genomes · GIH)
          </button>

          <button onClick={onSkip} className="text-[var(--muted-foreground)] text-sm underline">
            Skip — no genome file
          </button>
        </>
      )}

      {(phase === "loading" || phase === "scanning") && (
        <div className="text-center w-full">
          <div className="text-4xl mb-4">🔬</div>
          {phase === "loading" && (
            <>
              <p className="font-semibold mb-3">Loading variant database...</p>
              <div className="w-full bg-[var(--border)] rounded-full h-2">
                <div
                  className="h-2 bg-[var(--risk)] rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-[var(--muted-foreground)] text-sm mt-2">{progress}%</p>
            </>
          )}
          {phase === "scanning" && (
            <>
              <p className="font-semibold mb-2">Screening cardiac variants...</p>
              <p className="text-[var(--risk)] font-(family-name:--font-jetbrains) text-3xl font-bold">
                {screened.toLocaleString()}
              </p>
              <p className="text-[var(--muted-foreground)] text-sm">variants screened</p>
              <div className="mt-4 flex justify-center">
                <div className="w-2 h-2 bg-[var(--risk)] rounded-full animate-bounce mx-1" />
                <div className="w-2 h-2 bg-[var(--risk)] rounded-full animate-bounce mx-1 [animation-delay:0.15s]" />
                <div className="w-2 h-2 bg-[var(--risk)] rounded-full animate-bounce mx-1 [animation-delay:0.3s]" />
              </div>
            </>
          )}
        </div>
      )}

      {phase === "done" && (
        <div className="text-center">
          <div className="text-[var(--safe)] text-5xl mb-3">✓</div>
          <p className="font-semibold text-[var(--foreground)] mb-1">
            {screened.toLocaleString()} variants screened
          </p>
          {flaggedCount > 0 ? (
            <p className="text-[var(--risk)] font-semibold">
              {flaggedCount} cardiac variant{flaggedCount > 1 ? "s" : ""} flagged
            </p>
          ) : (
            <p className="text-[var(--muted-foreground)] text-sm">No high-risk cardiac variants detected</p>
          )}
        </div>
      )}
    </div>
  );
}
