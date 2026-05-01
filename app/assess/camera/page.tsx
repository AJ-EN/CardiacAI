"use client";

import { useRouter } from "next/navigation";
import StepLayout from "@/components/StepLayout";
import RPPGCamera from "@/components/RPPGCamera";
import { saveAssessment } from "@/lib/store";

export default function CameraPage() {
  const router = useRouter();

  const handleComplete = (vitals: { heartRate: number; hrv: number }) => {
    saveAssessment({ vitals });
    setTimeout(() => router.push("/assess/genome"), 800);
  };

  return (
    <StepLayout
      step={2}
      total={5}
      title="30-second face scan"
      subtitle="We read your heart rate and HRV from subtle colour changes in your skin — no wearable needed."
    >
      <div className="w-full flex flex-col items-center gap-6">
        <RPPGCamera onComplete={handleComplete} />

        <div className="w-full border border-[var(--border)] rounded-lg p-4 bg-[var(--navy-light)]">
          <p className="text-xs font-(family-name:--font-jetbrains) uppercase tracking-wider text-[var(--navy)] mb-2">
            How it works
          </p>
          <p className="text-[var(--muted-foreground)] text-sm leading-relaxed">
            Remote photoplethysmography (rPPG) detects the green-channel pulse signal from your facial skin. HRV under 30ms rMSSD reflects autonomic cardiac stress — a risk signal that appears years before symptoms.
          </p>
        </div>
      </div>
    </StepLayout>
  );
}
