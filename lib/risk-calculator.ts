import type { BasicMarkers } from "./store";

// ─────────────────────────────────────────────────────────────────────────────
// Framingham 10-year hard CHD risk, NCEP ATP III point tables.
//
// Source: Third Report of the NCEP Expert Panel (ATP III), Circulation
// 2002;106:3143 — Tables assigning points by age, total cholesterol, smoking,
// HDL and systolic BP, then converting a point total to 10-year risk.
//
// Note the cholesterol and smoking point values are BOTH age- and sex-
// dependent, and the point-to-risk conversion is entirely sex-specific.
// Applying one column to everybody is the single easiest way to get this
// badly wrong.
// ─────────────────────────────────────────────────────────────────────────────

type Sex = "male" | "female";

/** ATP III age bands used by the cholesterol and smoking tables. */
function ageBand(age: number): 0 | 1 | 2 | 3 | 4 {
  if (age < 40) return 0; // 20-39
  if (age < 50) return 1;
  if (age < 60) return 2;
  if (age < 70) return 3;
  return 4; // 70-79
}

const AGE_POINTS: Record<Sex, Array<[number, number]>> = {
  // [maxAgeInclusive, points]
  male: [[34, -9], [39, -4], [44, 0], [49, 3], [54, 6], [59, 8], [64, 10], [69, 11], [74, 12], [Infinity, 13]],
  female: [[34, -7], [39, -3], [44, 0], [49, 3], [54, 6], [59, 8], [64, 10], [69, 12], [74, 14], [Infinity, 16]],
};

/** Rows: <160, 160-199, 200-239, 240-279, >=280. Columns: age band. */
const CHOL_POINTS: Record<Sex, number[][]> = {
  male: [
    [0, 0, 0, 0, 0],
    [4, 3, 2, 1, 0],
    [7, 5, 3, 1, 0],
    [9, 6, 4, 2, 1],
    [11, 8, 5, 3, 1],
  ],
  female: [
    [0, 0, 0, 0, 0],
    [4, 3, 2, 1, 1],
    [8, 6, 4, 2, 1],
    [11, 8, 5, 3, 2],
    [13, 10, 7, 4, 2],
  ],
};

/** Smoking points by age band. */
const SMOKER_POINTS: Record<Sex, number[]> = {
  male: [8, 5, 3, 1, 1],
  female: [9, 7, 4, 2, 1],
};

/** Rows: <120, 120-129, 130-139, 140-159, >=160. Columns: [untreated, treated]. */
const SBP_POINTS: Record<Sex, Array<[number, number]>> = {
  male: [[0, 0], [0, 1], [1, 2], [1, 2], [2, 3]],
  female: [[0, 0], [1, 3], [2, 4], [3, 5], [4, 6]],
};

/** Point total → 10-year hard CHD risk (%). Index is offset by the base below. */
const RISK_MALE: Record<number, number> = {
  0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 2, 6: 2, 7: 3, 8: 4, 9: 5,
  10: 6, 11: 8, 12: 10, 13: 12, 14: 16, 15: 20, 16: 25,
};
const RISK_FEMALE: Record<number, number> = {
  9: 1, 10: 1, 11: 1, 12: 1, 13: 2, 14: 2, 15: 3, 16: 4, 17: 5,
  18: 6, 19: 8, 20: 11, 21: 14, 22: 17, 23: 22, 24: 27,
};

function cholBand(tc: number): number {
  if (tc < 160) return 0;
  if (tc < 200) return 1;
  if (tc < 240) return 2;
  if (tc < 280) return 3;
  return 4;
}

function sbpBand(sbp: number): number {
  if (sbp < 120) return 0;
  if (sbp < 130) return 1;
  if (sbp < 140) return 2;
  if (sbp < 160) return 3;
  return 4;
}

export function computeFraminghamScore(m: BasicMarkers): number {
  const sex: Sex = m.sex === "female" ? "female" : "male";
  // ATP III is derived and validated for ages 20-79.
  const age = Math.max(20, Math.min(79, m.age));
  const band = ageBand(age);

  let points = 0;

  for (const [maxAge, pts] of AGE_POINTS[sex]) {
    if (age <= maxAge) {
      points += pts;
      break;
    }
  }

  points += CHOL_POINTS[sex][cholBand(m.totalCholesterol)][band];
  if (m.smoker) points += SMOKER_POINTS[sex][band];

  if (m.hdl >= 60) points += -1;
  else if (m.hdl >= 50) points += 0;
  else if (m.hdl >= 40) points += 1;
  else points += 2;

  points += SBP_POINTS[sex][sbpBand(m.systolic)][m.onBpMeds ? 1 : 0];

  const table = sex === "male" ? RISK_MALE : RISK_FEMALE;
  const keys = Object.keys(table).map(Number);
  const min = Math.min(...keys);
  const max = Math.max(...keys);

  let risk: number;
  if (points < min) risk = 1; // ATP III reports "<1%"; we floor at 1 for display
  else if (points > max) risk = 30; // ATP III reports ">=30%"
  else risk = table[points];

  // ATP III does not score diabetes. It classifies diabetes as a CHD risk
  // equivalent — a 10-year risk of >=20% by definition — so the point total is
  // not the right instrument for a diabetic patient.
  if (m.diabetic) risk = Math.max(risk, 20);

  return risk;
}

export interface RiskInputs {
  basicMarkers: BasicMarkers;
  variantPoints: number;
  hrvMs: number;
  voiceScore: number;
  familyHistoryBefore55: boolean;
  avgSleepHours: number;
  sittingHoursPerDay: number;
}

export function computeCardiacAIScore(inputs: RiskInputs): number {
  const { basicMarkers: m } = inputs;

  // Step 1: ASCVD baseline from Framingham
  let score = computeFraminghamScore(m);

  // Step 2: South Asian adjustment.
  // HEURISTIC. The 2018 ACC/AHA guidance treats South Asian ancestry as a
  // qualitative risk-enhancing factor; it does not specify a 1.5 multiplier.
  // This factor is a triage choice, not a value derived from that statement,
  // and must not be cited as such.
  score = score * 1.5;

  // Step 3: Variant points (passed in from AlphaMissense lookup)
  score += inputs.variantPoints;

  // Step 4: Biometric modifiers
  if (inputs.hrvMs > 0 && inputs.hrvMs < 30) score += 10; // HRV lowest tertile
  if (inputs.voiceScore > 2) score += 5;

  // Step 5: Lifestyle modifiers
  if (inputs.familyHistoryBefore55) score += 12;
  if (inputs.avgSleepHours > 0 && inputs.avgSleepHours < 6) score += 5;
  if (inputs.sittingHoursPerDay > 10) score += 5;

  // Cap at 95
  return Math.min(95, Math.round(score));
}
