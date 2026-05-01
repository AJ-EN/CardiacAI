"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { parse23andMe, extractRsIds } from "@/lib/genome-parser";
import { initAlphaMissense, lookupVariants, getRameshVariants } from "@/lib/alphamissense";
import type { AlphaMissenseEntry } from "@/lib/alphamissense";

interface Props {
  onComplete: (data: { rsids: string[]; flagged: AlphaMissenseEntry[]; variantPoints: number; screened: number }) => void;
}

type GeneStatus = "pending" | "scanning" | "clear" | "match";

// Display order in the 4×2 grid (visual layout)
const GENE_GRID = ["LPA", "LDLR", "PCSK9", "MYBPC3", "APOB", "MYH7", "SCN5A", "TTN"];

// Order genes are scanned in (engineered for dramatic timing — matches at positions 4 and 8)
const SCAN_ORDER = ["LDLR", "PCSK9", "APOB", "LPA", "MYH7", "SCN5A", "TTN", "MYBPC3"];

interface StreamItem {
  id: number;
  rsid: string;
  isMatch?: boolean;
  matchGene?: string;
}

interface MatchAlert {
  gene: string;
  rsid: string;
}

const initialGeneStates = (): Record<string, GeneStatus> =>
  Object.fromEntries(GENE_GRID.map((g) => [g, "pending" as GeneStatus]));

export default function GenomeUpload({ onComplete }: Props) {
  const [phase, setPhase] = useState<"idle" | "loading" | "scanning" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [screened, setScreened] = useState(0);
  const [flaggedCount, setFlaggedCount] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);

  // Theater state
  const [stream, setStream] = useState<StreamItem[]>([]);
  const [geneStates, setGeneStates] = useState<Record<string, GeneStatus>>(initialGeneStates);
  const [matchAlert, setMatchAlert] = useState<MatchAlert | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const idCounter = useRef(0);
  const timersRef = useRef<NodeJS.Timeout[]>([]);
  const intervalsRef = useRef<NodeJS.Timeout[]>([]);

  // Cleanup all timers/intervals on unmount
  useEffect(() => {
    const timers = timersRef.current;
    const intervals = intervalsRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      intervals.forEach((i) => clearInterval(i));
    };
  }, []);

  const addTimer = (fn: () => void, delay: number) => {
    const t = setTimeout(fn, delay);
    timersRef.current.push(t);
  };

  const fakeRsid = () => `rs${100000 + Math.floor(Math.random() * 9000000)}`;

  const playScanTheater = useCallback(
    async (flagged: AlphaMissenseEntry[], totalScreened: number): Promise<void> => {
      // Reset theater state
      setStream([]);
      setGeneStates(initialGeneStates());
      setMatchAlert(null);
      setScreened(0);

      const flaggedMap = new Map(flagged.map((f) => [f.gene, f.rsid]));
      const TOTAL_DURATION = 3000;
      const PER_GENE = TOTAL_DURATION / SCAN_ORDER.length;

      // Stream of fake rsIDs scrolling past
      const streamInterval = setInterval(() => {
        setStream((prev) => [
          { id: idCounter.current++, rsid: fakeRsid() },
          ...prev.slice(0, 11),
        ]);
      }, 80);
      intervalsRef.current.push(streamInterval);

      // Counter climbs in step with the scan
      const startTime = Date.now();
      const counterInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const t = Math.min(elapsed / TOTAL_DURATION, 1);
        const eased = 1 - Math.pow(1 - t, 2);
        setScreened(Math.round(totalScreened * eased));
      }, 40);
      intervalsRef.current.push(counterInterval);

      // Schedule each gene scan event
      SCAN_ORDER.forEach((gene, i) => {
        const startT = i * PER_GENE;
        const resolveT = startT + PER_GENE * 0.7;

        addTimer(() => {
          setGeneStates((prev) => ({ ...prev, [gene]: "scanning" }));
        }, startT);

        addTimer(() => {
          const matchedRsid = flaggedMap.get(gene);
          if (matchedRsid) {
            setGeneStates((prev) => ({ ...prev, [gene]: "match" }));
            setMatchAlert({ gene, rsid: matchedRsid });
            setStream((prev) => [
              { id: idCounter.current++, rsid: matchedRsid, isMatch: true, matchGene: gene },
              ...prev.slice(0, 11),
            ]);
            addTimer(() => {
              setMatchAlert((curr) => (curr?.gene === gene ? null : curr));
            }, 1800);
          } else {
            setGeneStates((prev) => ({ ...prev, [gene]: "clear" }));
          }
        }, resolveT);
      });

      // Resolve when theater finishes
      await new Promise<void>((resolve) => {
        addTimer(() => {
          clearInterval(streamInterval);
          clearInterval(counterInterval);
          setScreened(totalScreened);
          resolve();
        }, TOTAL_DURATION + 300);
      });
    },
    []
  );

  const processFile = useCallback(
    async (text: string) => {
      setPhase("loading");
      setProgress(0);
      await initAlphaMissense((pct) => setProgress(pct));

      setPhase("scanning");
      const variants = parse23andMe(text);
      const rsids = extractRsIds(variants);

      const result = await lookupVariants(rsids);
      await playScanTheater(result.flagged, rsids.length);

      setFlaggedCount(result.flagged.length);
      setPhase("done");

      onComplete({
        rsids,
        flagged: result.flagged,
        variantPoints: result.totalPoints,
        screened: result.screened,
      });
    },
    [onComplete, playScanTheater]
  );

  const useDemoGenome = useCallback(async () => {
    setPhase("loading");
    await initAlphaMissense((pct) => setProgress(pct));
    setPhase("scanning");

    const rsids = getRameshVariants();
    const result = await lookupVariants(rsids);
    const DISPLAY_TOTAL = 11406;

    await playScanTheater(result.flagged, DISPLAY_TOTAL);

    setFlaggedCount(result.flagged.length);
    setPhase("done");

    onComplete({
      rsids,
      flagged: result.flagged,
      variantPoints: result.totalPoints,
      screened: DISPLAY_TOTAL,
    });
  }, [onComplete, playScanTheater]);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (!file) return;
      const text = await file.text();
      processFile(text);
    },
    [processFile]
  );

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      processFile(text);
    },
    [processFile]
  );

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-md">
      {phase === "idle" && (
        <>
          <div
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onClick={() => fileRef.current?.click()}
            className={`w-full border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
              isDragOver
                ? "border-[var(--risk)] bg-[var(--risk-light)]"
                : "border-[var(--border2)] hover:border-[var(--risk)] hover:bg-[var(--risk-light)]/30"
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
        </>
      )}

      {phase === "loading" && (
        <div className="text-center w-full">
          <div className="text-4xl mb-4">🔬</div>
          <p className="font-semibold mb-3">Loading variant database...</p>
          <div className="w-full bg-[var(--border)] rounded-full h-2">
            <div
              className="h-2 bg-[var(--risk)] rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[var(--muted-foreground)] text-sm mt-2">{progress}%</p>
        </div>
      )}

      {phase === "scanning" && (
        <div className="w-full">
          {/* Header */}
          <div className="text-center mb-5">
            <p className="font-(family-name:--font-jetbrains) text-[10px] uppercase tracking-[3px] text-[var(--muted-foreground)] mb-1">
              AlphaMissense · scan in progress
            </p>
            <p className="font-(family-name:--font-playfair) text-5xl font-black text-[var(--foreground)] tabular-nums leading-none">
              {screened.toLocaleString()}
            </p>
            <p className="text-[var(--muted-foreground)] text-xs mt-1 font-(family-name:--font-jetbrains) uppercase tracking-wider">
              variants screened
            </p>
          </div>

          {/* Match alert — floats in dramatically */}
          <div className="h-14 mb-3 flex items-center justify-center">
            {matchAlert && (
              <div
                key={matchAlert.gene}
                className="w-full px-4 py-2.5 rounded-lg bg-[var(--risk)] text-white shadow-lg shadow-[var(--risk)]/40 flex items-center gap-3"
                style={{ animation: "matchPop 400ms ease-out" }}
              >
                <span className="text-xl leading-none">⚠</span>
                <div className="flex-1 min-w-0">
                  <p className="font-(family-name:--font-jetbrains) text-[9px] uppercase tracking-[2px] opacity-80">
                    pathogenic match
                  </p>
                  <p className="font-bold text-sm truncate">
                    {matchAlert.gene} variant <span className="font-mono opacity-90">({matchAlert.rsid})</span>
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* rsID stream */}
          <div className="relative mb-4 h-32 bg-[#0a1422] rounded-lg overflow-hidden border border-white/5">
            <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-[#0a1422] to-transparent z-10 pointer-events-none" />
            <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-[#0a1422] to-transparent z-10 pointer-events-none" />
            <div className="p-3 font-(family-name:--font-jetbrains) text-[11px] leading-[1.6]">
              {stream.map((item, i) => (
                <div
                  key={item.id}
                  className={
                    item.isMatch
                      ? "text-[#ff8a82] font-bold tracking-wide"
                      : "text-white/35"
                  }
                  style={{ opacity: Math.max(0.15, 1 - i * 0.07) }}
                >
                  {item.isMatch
                    ? `⚠ MATCH · ${item.matchGene} · ${item.rsid}`
                    : item.rsid}
                </div>
              ))}
              {stream.length === 0 && (
                <div className="text-white/20 italic">initialising scan...</div>
              )}
            </div>
          </div>

          {/* Gene panel grid */}
          <div className="grid grid-cols-4 gap-2">
            {GENE_GRID.map((gene) => {
              const status = geneStates[gene];
              const isMatch = status === "match";
              const isScanning = status === "scanning";
              const isClear = status === "clear";
              const isPending = status === "pending";
              return (
                <div
                  key={gene}
                  className={`relative rounded-lg border p-2.5 text-center transition-all duration-300 ${
                    isMatch
                      ? "bg-[var(--risk-light)] border-[var(--risk)] shadow-[0_0_16px_rgba(192,57,43,0.35)] scale-[1.04]"
                      : isScanning
                      ? "bg-[var(--amber-light)] border-[var(--amber)]"
                      : isClear
                      ? "bg-[var(--safe-light)] border-[var(--safe)]/50 opacity-70"
                      : "bg-white border-[var(--border)] opacity-50"
                  }`}
                  style={
                    isScanning
                      ? { animation: "scanPulse 600ms ease-in-out infinite" }
                      : undefined
                  }
                >
                  <p
                    className={`font-(family-name:--font-jetbrains) text-xs font-bold tracking-tight ${
                      isMatch
                        ? "text-[var(--risk)]"
                        : isScanning
                        ? "text-[var(--amber)]"
                        : isClear
                        ? "text-[var(--safe)]"
                        : "text-[var(--muted-foreground)]"
                    }`}
                  >
                    {gene}
                  </p>
                  <p
                    className={`font-(family-name:--font-jetbrains) text-[8px] uppercase tracking-[1px] mt-0.5 ${
                      isMatch
                        ? "text-[var(--risk)]"
                        : isScanning
                        ? "text-[var(--amber)]"
                        : isClear
                        ? "text-[var(--safe)]"
                        : "text-[var(--muted-foreground)]"
                    }`}
                  >
                    {isMatch ? "⚠ match" : isScanning ? "scanning" : isClear ? "✓ clear" : "—"}
                  </p>
                  {isMatch && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[var(--risk)] animate-ping" />
                  )}
                </div>
              );
            })}
          </div>
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
