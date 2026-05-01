"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import StepLayout from "@/components/StepLayout";
import { saveAssessment, RAMESH_DEFAULTS, type BasicMarkers } from "@/lib/store";

export default function VitalsPage() {
  const router = useRouter();
  const [form, setForm] = useState<BasicMarkers>(RAMESH_DEFAULTS);

  const set = (key: keyof BasicMarkers, value: string | boolean | number) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveAssessment({ basicMarkers: form });
    router.push("/assess/camera");
  };

  return (
    <StepLayout
      step={1}
      total={5}
      title="Your health markers"
      subtitle="Pre-filled with normal values — change anything that differs for you."
    >
      <form onSubmit={handleSubmit} className="w-full space-y-5">
        {/* Age & Sex */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Age">
            <input
              type="number"
              value={form.age}
              onChange={(e) => set("age", Number(e.target.value))}
              min={18}
              max={100}
              required
              className={inputClass}
            />
          </Field>
          <Field label="Sex">
            <select
              value={form.sex}
              onChange={(e) => set("sex", e.target.value as "male" | "female")}
              className={inputClass}
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </Field>
        </div>

        {/* Blood pressure */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Systolic BP (mmHg)">
            <input type="number" value={form.systolic}
              onChange={(e) => set("systolic", Number(e.target.value))}
              min={80} max={220} required className={inputClass} />
          </Field>
          <Field label="Diastolic BP (mmHg)">
            <input type="number" value={form.diastolic}
              onChange={(e) => set("diastolic", Number(e.target.value))}
              min={50} max={140} required className={inputClass} />
          </Field>
        </div>

        {/* Cholesterol */}
        <div className="grid grid-cols-3 gap-4">
          <Field label="Total Chol (mg/dL)">
            <input type="number" value={form.totalCholesterol}
              onChange={(e) => set("totalCholesterol", Number(e.target.value))}
              min={100} max={400} required className={inputClass} />
          </Field>
          <Field label="LDL (mg/dL)">
            <input type="number" value={form.ldl}
              onChange={(e) => set("ldl", Number(e.target.value))}
              min={30} max={300} required className={inputClass} />
          </Field>
          <Field label="HDL (mg/dL)">
            <input type="number" value={form.hdl}
              onChange={(e) => set("hdl", Number(e.target.value))}
              min={20} max={120} required className={inputClass} />
          </Field>
        </div>

        {/* BMI */}
        <Field label="BMI">
          <input type="number" value={form.bmi} step="0.1"
            onChange={(e) => set("bmi", parseFloat(e.target.value))}
            min={14} max={60} required className={inputClass} />
        </Field>

        {/* Checkboxes */}
        <div className="flex flex-col gap-3">
          {[
            { key: "smoker" as const, label: "Current smoker" },
            { key: "onBpMeds" as const, label: "On blood pressure medication" },
            { key: "diabetic" as const, label: "Diabetic" },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => set(key, !form[key])}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  form[key] ? "bg-[var(--risk)] border-[var(--risk)]" : "border-[var(--border2)]"
                }`}
              >
                {form[key] && <span className="text-white text-xs">✓</span>}
              </div>
              <span className="text-[var(--foreground)] text-sm">{label}</span>
            </label>
          ))}
        </div>

        <div className="pt-2">
          <p className="text-[var(--muted-foreground)] text-xs mb-4 font-(family-name:--font-jetbrains)">
            All values stay on your device. Nothing is stored or transmitted.
          </p>
          <button
            type="submit"
            className="w-full py-3 bg-[var(--risk)] text-white rounded-lg font-semibold hover:bg-[var(--risk-dim)] transition-colors"
          >
            Continue to biometrics →
          </button>
        </div>
      </form>
    </StepLayout>
  );
}

const inputClass =
  "w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-white text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--risk)] focus:border-transparent";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-(family-name:--font-jetbrains) uppercase tracking-wider text-[var(--muted-foreground)] mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
