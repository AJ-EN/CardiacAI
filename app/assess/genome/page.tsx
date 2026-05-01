"use client";

import { useRouter } from "next/navigation";
import StepLayout from "@/components/StepLayout";
import GenomeUpload from "@/components/GenomeUpload";
import { saveAssessment } from "@/lib/store";
import type { AlphaMissenseEntry } from "@/lib/alphamissense";

export default function GenomePage() {
  const router = useRouter();

  const handleComplete = (data: {
    rsids: string[];
    flagged: AlphaMissenseEntry[];
    variantPoints: number;
    screened: number;
  }) => {
    saveAssessment({ variants: data.flagged.map((f) => f.rsid) });
    setTimeout(() => router.push("/assess/lifestyle"), 1000);
  };

  const handleSkip = () => {
    saveAssessment({ variants: [] });
    router.push("/assess/lifestyle");
  };

  return (
    <StepLayout
      step={3}
      total={5}
      title="Genetic variants"
      subtitle="Upload a 23andMe file to screen for South-Asian-specific cardiac variants via AlphaMissense (DeepMind, 71M predictions)."
    >
      <div className="w-full flex flex-col items-center gap-6">
        <GenomeUpload onComplete={handleComplete} onSkip={handleSkip} />

        <div className="w-full border border-[var(--border)] rounded-lg p-4 bg-[var(--risk-light)]">
          <p className="text-xs font-(family-name:--font-jetbrains) uppercase tracking-wider text-[var(--risk)] mb-2">
            Privacy guarantee
          </p>
          <p className="text-[var(--muted-foreground)] text-sm leading-relaxed">
            Your genome file never leaves your device. All variant lookup happens in your browser's IndexedDB — no server, no upload, no storage. Only flagged rsIDs are passed to the AI engine.
          </p>
        </div>
      </div>
    </StepLayout>
  );
}
