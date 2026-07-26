"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { parse23andMe, buildGenotypeMap } from "@/lib/genome-parser";
import {
  initPanel,
  callVariants,
  getDemoGenotypes,
  CARDIAC_PANEL,
  NOT_ARRAY_DETECTABLE,
} from "@/lib/cardiac-panel";
import type { VariantCall } from "@/lib/cardiac-panel";

interface Props {
  onComplete: (data: {
    calls: VariantCall[];
    carriers: VariantCall[];
    variantPoints: number;
    screened: number;
  }) => void;
}

type GeneStatus =
  | "pending"
  | "scanning"
  | "clear"
  | "carrier"
  | "not_assayed"
  | "undetectable";

// Genes with at least one verified variant in the panel, plus MYBPC3 which is
// shown deliberately as undetectable rather than silently omitted.
const PANEL_GENES = [...new Set(Object.values(CARDIAC_PANEL).map((v) => v.gene))];
const UNDETECTABLE_GENES = [...new Set(NOT_ARRAY_DETECTABLE.map((n) => n.gene))].filter(
  (g) => !PANEL_GENES.includes(g)
);
const GENE_GRID = [...PANEL_GENES, ...UNDETECTABLE_GENES];

interface StreamItem {
  id: number;
  rsid: string;
  isMatch?: boolean;
  matchGene?: string;
}

interface MatchAlert {
  gene: string;
  rsid: string;
  genotype: string;
}

const initialGeneStates = (): Record<string, GeneStatus> =>
  Object.fromEntries(
    GENE_GRID.map((g) => [
      g,
      (UNDETECTABLE_GENES.includes(g) ? "undetectable" : "pending") as GeneStatus,
    ])
  );

export default function GenomeUpload({ onComplete }: Props) {
  const [phase, setPhase] = useState<"idle" | "loading" | "scanning" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [screened, setScreened] = useState(0);
  const [result, setResult] = useState<{
    calls: VariantCall[];
    carriers: VariantCall[];
    assayed: number;
    screened: number;
  } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const [stream, setStream] = useState<StreamItem[]>([]);
  const [geneStates, setGeneStates] = useState<Record<string, GeneStatus>>(initialGeneStates);
  const [matchAlert, setMatchAlert] = useState<MatchAlert | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const idCounter = useRef(0);
  const timersRef = useRef<NodeJS.Timeout[]>([]);
  const intervalsRef = useRef<NodeJS.Timeout[]>([]);
  // Real rsIDs from the uploaded file — the scan stream shows actual data.
  const streamPool = useRef<string[]>([]);

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

  const playScanTheater = useCallback(
    async (calls: VariantCall[], totalScreened: number): Promise<void> => {
      setStream([]);
      setGeneStates(initialGeneStates());
      setMatchAlert(null);
      setScreened(0);

      const TOTAL_DURATION = 3000;
      const order = PANEL_GENES;
      const PER_GENE = TOTAL_DURATION / order.length;

      const pool = streamPool.current;
      let poolIdx = 0;
      const streamInterval = setInterval(() => {
        if (pool.length === 0) return;
        const rsid = pool[poolIdx % pool.length];
        poolIdx++;
        setStream((prev) => [{ id: idCounter.current++, rsid }, ...prev.slice(0, 11)]);
      }, 80);
      intervalsRef.current.push(streamInterval);

      const startTime = Date.now();
      const counterInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const t = Math.min(elapsed / TOTAL_DURATION, 1);
        const eased = 1 - Math.pow(1 - t, 2);
        setScreened(Math.round(totalScreened * eased));
      }, 40);
      intervalsRef.current.push(counterInterval);

      order.forEach((gene, i) => {
        const startT = i * PER_GENE;
        const resolveT = startT + PER_GENE * 0.7;
        const geneCalls = calls.filter((c) => c.gene === gene);

        addTimer(() => {
          setGeneStates((prev) => ({ ...prev, [gene]: "scanning" }));
        }, startT);

        addTimer(() => {
          const carrier = geneCalls.find((c) => c.riskAlleleCount > 0);
          const assayedCall = geneCalls.find((c) => c.zygosity !== "not_assayed");

          if (carrier) {
            setGeneStates((prev) => ({ ...prev, [gene]: "carrier" }));
            setMatchAlert({
              gene,
              rsid: carrier.rsid,
              genotype: carrier.genotype ?? "",
            });
            setStream((prev) => [
              { id: idCounter.current++, rsid: carrier.rsid, isMatch: true, matchGene: gene },
              ...prev.slice(0, 11),
            ]);
            addTimer(() => {
              setMatchAlert((curr) => (curr?.gene === gene ? null : curr));
            }, 1800);
          } else {
            setGeneStates((prev) => ({
              ...prev,
              [gene]: assayedCall ? "clear" : "not_assayed",
            }));
          }
        }, resolveT);
      });

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

  const runScan = useCallback(
    async (genotypes: Map<string, string>, poolRsids: string[]) => {
      setPhase("loading");
      setProgress(0);
      await initPanel((pct) => setProgress(pct));

      setPhase("scanning");
      streamPool.current = poolRsids;

      const called = callVariants(genotypes);
      await playScanTheater(called.calls, called.screened);

      setResult({
        calls: called.calls,
        carriers: called.carriers,
        assayed: called.assayed,
        screened: called.screened,
      });
      setPhase("done");

      onComplete({
        calls: called.calls,
        carriers: called.carriers,
        variantPoints: called.totalPoints,
        screened: called.screened,
      });
    },
    [onComplete, playScanTheater]
  );

  const processFile = useCallback(
    async (text: string) => {
      const variants = parse23andMe(text);
      const genotypes = buildGenotypeMap(variants);
      await runScan(
        genotypes,
        variants.map((v) => v.rsid)
      );
    },
    [runScan]
  );

  const useDemoGenome = useCallback(async () => {
    const genotypes = getDemoGenotypes();
    await runScan(genotypes, [...genotypes.keys()]);
  }, [runScan]);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (!file) return;
      processFile(await file.text());
    },
    [processFile]
  );

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      processFile(await file.text());
    },
    [processFile]
  );

  const panelSize = Object.keys(CARDIAC_PANEL).length;

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
            Use illustrative demo genotypes
          </button>
          <p className="text-[var(--muted-foreground)] text-xs -mt-3 text-center">
            Example calls at {panelSize} verified panel positions. Not a real individual&apos;s genome.
          </p>
        </>
      )}

      {phase === "loading" && (
        <div className="text-center w-full">
          <div className="text-4xl mb-4">🔬</div>
          <p className="font-semibold mb-3">Loading variant panel...</p>
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
          <div className="text-center mb-5">
            <p className="font-(family-name:--font-jetbrains) text-[10px] uppercase tracking-[3px] text-[var(--muted-foreground)] mb-1">
              ClinVar-verified panel · genotype matching
            </p>
            <p className="font-(family-name:--font-playfair) text-5xl font-black text-[var(--foreground)] tabular-nums leading-none">
              {screened.toLocaleString()}
            </p>
            <p className="text-[var(--muted-foreground)] text-xs mt-1 font-(family-name:--font-jetbrains) uppercase tracking-wider">
              SNPs read from your file
            </p>
          </div>

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
                    risk allele present
                  </p>
                  <p className="font-bold text-sm truncate">
                    {matchAlert.gene}{" "}
                    <span className="font-mono opacity-90">
                      ({matchAlert.rsid} · {matchAlert.genotype})
                    </span>
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="relative mb-4 h-32 bg-[#0a1422] rounded-lg overflow-hidden border border-white/5">
            <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-[#0a1422] to-transparent z-10 pointer-events-none" />
            <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-[#0a1422] to-transparent z-10 pointer-events-none" />
            <div className="p-3 font-(family-name:--font-jetbrains) text-[11px] leading-[1.6]">
              {stream.map((item, i) => (
                <div
                  key={item.id}
                  className={item.isMatch ? "text-[#ff8a82] font-bold tracking-wide" : "text-white/35"}
                  style={{ opacity: Math.max(0.15, 1 - i * 0.07) }}
                >
                  {item.isMatch ? `⚠ RISK ALLELE · ${item.matchGene} · ${item.rsid}` : item.rsid}
                </div>
              ))}
              {stream.length === 0 && <div className="text-white/20 italic">reading file...</div>}
            </div>
          </div>

          <div className={`grid gap-2 grid-cols-4`}>
            {GENE_GRID.map((gene) => {
              const status = geneStates[gene];
              const isCarrier = status === "carrier";
              const isScanning = status === "scanning";
              const isClear = status === "clear";
              const isNotAssayed = status === "not_assayed";
              const isUndetectable = status === "undetectable";
              return (
                <div
                  key={gene}
                  className={`relative rounded-lg border p-2.5 text-center transition-all duration-300 ${
                    isCarrier
                      ? "bg-[var(--risk-light)] border-[var(--risk)] shadow-[0_0_16px_rgba(192,57,43,0.35)] scale-[1.04]"
                      : isScanning
                      ? "bg-[var(--amber-light)] border-[var(--amber)]"
                      : isClear
                      ? "bg-[var(--safe-light)] border-[var(--safe)]/50 opacity-70"
                      : isNotAssayed || isUndetectable
                      ? "bg-white border-[var(--border2)] border-dashed"
                      : "bg-white border-[var(--border)] opacity-50"
                  }`}
                  style={isScanning ? { animation: "scanPulse 600ms ease-in-out infinite" } : undefined}
                >
                  <p
                    className={`font-(family-name:--font-jetbrains) text-xs font-bold tracking-tight ${
                      isCarrier
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
                      isCarrier
                        ? "text-[var(--risk)]"
                        : isScanning
                        ? "text-[var(--amber)]"
                        : isClear
                        ? "text-[var(--safe)]"
                        : "text-[var(--muted-foreground)]"
                    }`}
                  >
                    {isCarrier
                      ? "⚠ carrier"
                      : isScanning
                      ? "reading"
                      : isClear
                      ? "✓ no risk allele"
                      : isNotAssayed
                      ? "not on array"
                      : isUndetectable
                      ? "not detectable"
                      : "—"}
                  </p>
                  {isCarrier && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[var(--risk)] animate-ping" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {phase === "done" && result && (
        <div className="w-full">
          <div className="text-center mb-4">
            <div className="text-[var(--safe)] text-5xl mb-2">✓</div>
            <p className="font-semibold text-[var(--foreground)]">
              {result.screened.toLocaleString()} SNP{result.screened === 1 ? "" : "s"} read
            </p>
            <p className="text-[var(--muted-foreground)] text-sm">
              {result.assayed} of {panelSize} panel variants present on this array
            </p>
          </div>

          <div className="space-y-1.5">
            {result.calls.map((c) => {
              const carrier = c.riskAlleleCount > 0;
              const unknown = c.zygosity === "not_assayed" || c.zygosity === "no_call";
              return (
                <div
                  key={c.rsid}
                  className="flex items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-white px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="font-(family-name:--font-jetbrains) text-xs font-semibold text-[var(--foreground)]">
                      {c.gene} <span className="font-normal text-[var(--muted-foreground)]">{c.rsid}</span>
                    </p>
                    <p className="text-[10px] text-[var(--muted-foreground)] truncate">
                      {c.variant.plainName}
                    </p>
                  </div>
                  <span
                    className="font-(family-name:--font-jetbrains) text-[10px] uppercase tracking-wider px-2 py-1 rounded shrink-0"
                    style={{
                      color: carrier ? "var(--risk)" : unknown ? "var(--muted-foreground)" : "var(--safe)",
                      background: carrier
                        ? "var(--risk-light)"
                        : unknown
                        ? "var(--border)"
                        : "var(--safe-light)",
                    }}
                  >
                    {c.genotype ? `${c.genotype} · ` : ""}
                    {c.zygosity === "not_assayed"
                      ? "not on array"
                      : c.zygosity === "no_call"
                      ? "no call"
                      : c.zygosity === "non_carrier"
                      ? "no risk allele"
                      : c.zygosity === "heterozygous"
                      ? "1 copy"
                      : "2 copies"}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-4 rounded-lg border border-[var(--border2)] border-dashed bg-[var(--navy-light)] p-3">
            <p className="font-(family-name:--font-jetbrains) text-[10px] uppercase tracking-[2px] text-[var(--navy)] mb-2">
              What this screen cannot see
            </p>
            {NOT_ARRAY_DETECTABLE.map((n) => (
              <p key={n.label} className="text-[var(--muted-foreground)] text-xs leading-relaxed mb-1.5 last:mb-0">
                <span className="font-semibold text-[var(--foreground)]">{n.label}</span> — {n.why}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
