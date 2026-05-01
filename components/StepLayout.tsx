"use client";

import Link from "next/link";

interface Props {
  step: number;
  total: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

const STEPS = ["Vitals", "Camera", "Voice", "Genome", "Lifestyle", "Analysis"];

export default function StepLayout({ step, total, title, subtitle, children }: Props) {
  return (
    <main className="min-h-screen bg-[var(--background)] flex flex-col">
      {/* Top bar */}
      <div className="bg-[var(--navy-bg)] px-6 py-3 flex items-center justify-between">
        <Link href="/" className="font-(family-name:--font-playfair) font-black text-white text-lg">
          Cardiac<em className="italic text-[var(--risk-mid)]">AI</em>
        </Link>
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`w-2 h-2 rounded-full transition-colors ${
                i + 1 < step
                  ? "bg-[var(--safe)]"
                  : i + 1 === step
                  ? "bg-[var(--risk)]"
                  : "bg-white/20"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-[var(--border)]">
        <div
          className="h-1 bg-[var(--risk)] transition-all duration-500"
          style={{ width: `${(step / total) * 100}%` }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center px-6 py-10 max-w-xl mx-auto w-full">
        <div className="w-full mb-8">
          <p className="font-(family-name:--font-jetbrains) text-xs text-[var(--muted-foreground)] uppercase tracking-wider mb-2">
            Step {step} of {total}
          </p>
          <h2 className="font-(family-name:--font-playfair) text-3xl font-bold text-[var(--foreground)]">
            {title}
          </h2>
          {subtitle && (
            <p className="text-[var(--muted-foreground)] text-sm mt-2">{subtitle}</p>
          )}
        </div>
        {children}
      </div>
    </main>
  );
}
