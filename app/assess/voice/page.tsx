"use client";

import { useRouter } from "next/navigation";
import StepLayout from "@/components/StepLayout";
import VoiceStub from "@/components/VoiceStub";
import { saveAssessment } from "@/lib/store";

export default function VoicePage() {
  const router = useRouter();

  const handleComplete = (voiceScore: number) => {
    saveAssessment({ voiceScore });
    setTimeout(() => router.push("/assess/genome"), 800);
  };

  return (
    <StepLayout
      step={3}
      total={6}
      title="Voice sample"
      subtitle="Vocal biomarkers reflect autonomic nervous system stress — a known early cardiac signal."
    >
      <div className="w-full flex flex-col items-center gap-6">
        <VoiceStub onComplete={handleComplete} />

        <div className="w-full border border-[var(--border)] rounded-lg p-4 bg-[var(--amber-light)]">
          <p className="text-xs font-(family-name:--font-jetbrains) uppercase tracking-wider text-[var(--amber)] mb-2">
            Published science
          </p>
          <p className="text-[var(--muted-foreground)] text-sm leading-relaxed">
            Multiple 2023–2025 studies in <em>Nature Digital Medicine</em> validate acoustic features (jitter, shimmer, HNR) as cardiovascular stress markers. CardiacAI uses these as one signal among many.
          </p>
        </div>
      </div>
    </StepLayout>
  );
}
