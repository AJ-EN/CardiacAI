"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import StepLayout from "@/components/StepLayout";
import { saveAssessment, type LifestyleData } from "@/lib/store";

type RedMeat = "never" | "rarely" | "weekly" | "daily";

const SLEEP_OPTIONS = [
  { value: 8, label: "8+ hrs" },
  { value: 7, label: "7 hrs" },
  { value: 6, label: "6 hrs" },
  { value: 5, label: "< 6 hrs" },
];

const SITTING_OPTIONS = [
  { value: 4, label: "< 4 hrs" },
  { value: 6, label: "4–6 hrs" },
  { value: 8, label: "6–10 hrs" },
  { value: 12, label: "> 10 hrs" },
];

const RED_MEAT_OPTIONS: { value: RedMeat; label: string }[] = [
  { value: "never", label: "Never" },
  { value: "rarely", label: "Rarely" },
  { value: "weekly", label: "Weekly" },
  { value: "daily", label: "Daily" },
];

export default function LifestylePage() {
  const router = useRouter();
  const [familyHistory, setFamilyHistory] = useState<boolean | null>(null);
  const [sleep, setSleep] = useState<number | null>(null);
  const [sitting, setSitting] = useState<number | null>(null);
  const [stress, setStress] = useState<number | null>(null);
  const [redMeat, setRedMeat] = useState<RedMeat | null>(null);

  const canContinue = familyHistory !== null && sleep !== null && sitting !== null && stress !== null && redMeat !== null;

  const handleContinue = () => {
    const data: LifestyleData = {
      familyHistoryBefore55: familyHistory!,
      avgSleepHours: sleep!,
      sittingHoursPerDay: sitting!,
      stressLevel: stress!,
      redMeatFrequency: redMeat!,
    };
    saveAssessment({ lifestyle: data });
    router.push("/assess/analysing");
  };

  return (
    <StepLayout
      step={4}
      total={5}
      title="Lifestyle factors"
      subtitle="Tap to select — takes about 30 seconds."
    >
      <div className="w-full space-y-7">
        <Question label="Family history of heart attack before age 55?">
          <div className="grid grid-cols-2 gap-3">
            {[{ v: true, label: "Yes" }, { v: false, label: "No" }].map(({ v, label }) => (
              <TapCard
                key={label}
                active={familyHistory === v}
                onClick={() => setFamilyHistory(v)}
                highlight={v === true}
              >
                {label}
              </TapCard>
            ))}
          </div>
        </Question>

        <Question label="Average sleep per night?">
          <div className="grid grid-cols-4 gap-2">
            {SLEEP_OPTIONS.map(({ value, label }) => (
              <TapCard key={value} active={sleep === value} onClick={() => setSleep(value)} highlight={value <= 6}>
                {label}
              </TapCard>
            ))}
          </div>
        </Question>

        <Question label="Sitting hours per day (desk, commute, TV)?">
          <div className="grid grid-cols-4 gap-2">
            {SITTING_OPTIONS.map(({ value, label }) => (
              <TapCard key={value} active={sitting === value} onClick={() => setSitting(value)} highlight={value >= 10}>
                {label}
              </TapCard>
            ))}
          </div>
        </Question>

        <Question label="Stress level (1 = none, 5 = severe)?">
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((v) => (
              <TapCard key={v} active={stress === v} onClick={() => setStress(v)} highlight={v >= 4}>
                {v}
              </TapCard>
            ))}
          </div>
        </Question>

        <Question label="Red meat frequency?">
          <div className="grid grid-cols-4 gap-2">
            {RED_MEAT_OPTIONS.map(({ value, label }) => (
              <TapCard key={value} active={redMeat === value} onClick={() => setRedMeat(value)} highlight={value === "daily"}>
                {label}
              </TapCard>
            ))}
          </div>
        </Question>

        <button
          type="button"
          onClick={handleContinue}
          disabled={!canContinue}
          className="w-full py-3 bg-[var(--risk)] text-white rounded-lg font-semibold hover:bg-[var(--risk-dim)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Analyse my cardiac risk →
        </button>
      </div>
    </StepLayout>
  );
}

function Question({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[var(--foreground)] font-semibold text-sm mb-3">{label}</p>
      {children}
    </div>
  );
}

function TapCard({
  children,
  active,
  onClick,
  highlight,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`py-2 px-1 rounded-lg text-sm font-medium border transition-all text-center ${
        active
          ? highlight
            ? "bg-[var(--risk)] border-[var(--risk)] text-white"
            : "bg-[var(--navy-bg)] border-[var(--navy)] text-white"
          : "bg-white border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--border2)]"
      }`}
    >
      {children}
    </button>
  );
}
