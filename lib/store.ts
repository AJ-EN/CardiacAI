"use client";

export interface BasicMarkers {
  age: number;
  sex: "male" | "female";
  systolic: number;
  diastolic: number;
  totalCholesterol: number;
  ldl: number;
  hdl: number;
  bmi: number;
  smoker: boolean;
  onBpMeds: boolean;
  diabetic: boolean;
}

export interface Vitals {
  heartRate: number;
  hrv: number; // rMSSD ms
}

export interface LifestyleData {
  familyHistoryBefore55: boolean;
  avgSleepHours: number;
  sittingHoursPerDay: number;
  stressLevel: number; // 1-5
  redMeatFrequency: "never" | "rarely" | "weekly" | "daily";
}

export interface AssessmentData {
  basicMarkers: BasicMarkers | null;
  vitals: Vitals | null;
  voiceScore: number;
  variants: string[]; // rsIDs flagged as pathogenic
  lifestyle: LifestyleData | null;
}

export interface AnalysisResult {
  cardiacai_score: number;
  framingham_score: number;
  risk_tier: "low" | "moderate" | "high" | "very_high";
  gap_explanation: string;
  top_findings: Array<{
    signal: string;
    severity: "low" | "medium" | "high";
    plain_explanation: string;
    uniprot_id: string;
    residue_position: number;
    action: string;
  }>;
  action_plan: string[];
  family_recommendations: string[];
  citations: string[];
}

const STORAGE_KEY = "cardiacai_assessment";
const RESULT_KEY = "cardiacai_result";

export function saveAssessment(data: Partial<AssessmentData>): void {
  if (typeof window === "undefined") return;
  const existing = loadAssessment();
  const merged = { ...existing, ...data };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
}

export function loadAssessment(): AssessmentData {
  if (typeof window === "undefined") return emptyAssessment();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : emptyAssessment();
  } catch {
    return emptyAssessment();
  }
}

export function saveResult(result: AnalysisResult): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(RESULT_KEY, JSON.stringify(result));
}

export function loadResult(): AnalysisResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(RESULT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearAssessment(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(RESULT_KEY);
}

function emptyAssessment(): AssessmentData {
  return {
    basicMarkers: null,
    vitals: null,
    voiceScore: 0,
    variants: [],
    lifestyle: null,
  };
}

export const RAMESH_DEFAULTS: BasicMarkers = {
  age: 38,
  sex: "male",
  systolic: 128,
  diastolic: 82,
  totalCholesterol: 195,
  ldl: 110,
  hdl: 48,
  bmi: 24,
  smoker: false,
  onBpMeds: false,
  diabetic: false,
};
