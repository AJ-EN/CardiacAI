import type { BasicMarkers } from "./store";

export function computeFraminghamScore(m: BasicMarkers): number {
  // Simplified Framingham 10-year CVD risk (points system)
  let points = 0;

  // Age
  if (m.sex === "male") {
    if (m.age < 35) points += -9;
    else if (m.age <= 39) points += -4;
    else if (m.age <= 44) points += 0;
    else if (m.age <= 49) points += 3;
    else if (m.age <= 54) points += 6;
    else if (m.age <= 59) points += 8;
    else if (m.age <= 64) points += 10;
    else if (m.age <= 69) points += 11;
    else if (m.age <= 74) points += 12;
    else points += 13;
  } else {
    if (m.age < 35) points += -7;
    else if (m.age <= 39) points += -3;
    else if (m.age <= 44) points += 0;
    else if (m.age <= 49) points += 3;
    else if (m.age <= 54) points += 6;
    else if (m.age <= 59) points += 8;
    else if (m.age <= 64) points += 10;
    else if (m.age <= 69) points += 12;
    else if (m.age <= 74) points += 14;
    else points += 16;
  }

  // Total cholesterol
  if (m.totalCholesterol < 160) points += 0;
  else if (m.totalCholesterol <= 199) points += 4;
  else if (m.totalCholesterol <= 239) points += 7;
  else if (m.totalCholesterol <= 279) points += 9;
  else points += 11;

  // HDL
  if (m.hdl >= 60) points += -1;
  else if (m.hdl >= 50) points += 0;
  else if (m.hdl >= 40) points += 1;
  else points += 2;

  // Systolic BP
  if (!m.onBpMeds) {
    if (m.systolic < 120) points += 0;
    else if (m.systolic <= 129) points += 0;
    else if (m.systolic <= 139) points += 1;
    else if (m.systolic <= 159) points += 1;
    else points += 2;
  } else {
    if (m.systolic < 120) points += 0;
    else if (m.systolic <= 129) points += 3;
    else if (m.systolic <= 139) points += 4;
    else if (m.systolic <= 159) points += 5;
    else points += 6;
  }

  // Smoking
  if (m.smoker) points += (m.sex === "male" ? 8 : 9);

  // Diabetes
  if (m.diabetic) points += (m.sex === "male" ? 11 : 7);

  // Convert points to 10-year risk percentage (male table approximation)
  const riskMap: Record<number, number> = {
    [-3]: 1, [-2]: 1, [-1]: 2, 0: 3, 1: 4, 2: 4, 3: 6, 4: 7, 5: 9,
    6: 11, 7: 14, 8: 18, 9: 22, 10: 27, 11: 33, 12: 40, 13: 47,
  };

  const clamped = Math.max(-3, Math.min(13, points));
  return riskMap[clamped] ?? (points > 13 ? 55 : 1);
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

  // Step 2: AHA 2018 SA multiplier × 1.5
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
