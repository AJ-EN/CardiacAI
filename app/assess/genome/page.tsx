"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import StepLayout from "@/components/StepLayout";
import GenomeUpload from "@/components/GenomeUpload";
import { saveAssessment } from "@/lib/store";
import type { VariantCall } from "@/lib/cardiac-panel";

export default function GenomePage() {
  const router = useRouter();
  const [scanned, setScanned] = useState(false);

  const handleComplete = (data: {
    calls: VariantCall[];
    carriers: VariantCall[];
    variantPoints: number;
    screened: number;
  }) => {
    saveAssessment({
      variantCalls: data.calls.map((c) => ({
        rsid: c.rsid,
        gene: c.gene,
        genotype: c.genotype,
        zygosity: c.zygosity,
        riskAlleleCount: c.riskAlleleCount,
        points: c.points,
      })),
      variantPoints: data.variantPoints,
      variantsScreened: data.screened,
    });
    setScanned(true);
  };

  return (
    <StepLayout
      step={3}
      total={5}
      title="Genetic variants"
      subtitle="Upload a 23andMe file to check a small, ClinVar-verified panel of cardiac variants. Your genotype is matched allele by allele — not just checked for the presence of a marker."
    >
      <div className="w-full flex flex-col items-center gap-6">
        <GenomeUpload onComplete={handleComplete} />

        {scanned && (
          <button
            type="button"
            onClick={() => router.push("/assess/lifestyle")}
            className="w-full py-3 bg-[var(--risk)] text-white rounded-lg font-semibold hover:bg-[var(--risk-dim)] transition-colors"
          >
            Continue →
          </button>
        )}

        <div className="w-full border border-[var(--border)] rounded-lg p-4 bg-[var(--risk-light)]">
          <p className="text-xs font-(family-name:--font-jetbrains) uppercase tracking-wider text-[var(--risk)] mb-2">
            Privacy guarantee
          </p>
          <p className="text-[var(--muted-foreground)] text-sm leading-relaxed">
            Your genome file never leaves your device. Parsing and variant matching happen in your
            browser — no server, no upload, no storage. Only the resulting calls are passed to the
            local AI engine.
          </p>
        </div>
      </div>
    </StepLayout>
  );
}
