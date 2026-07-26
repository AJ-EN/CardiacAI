"use client";

import type { AnalysisResult, AssessmentData, StoredVariantCall } from "./store";
import { CARDIAC_PANEL, NOT_ARRAY_DETECTABLE } from "./cardiac-panel";

/**
 * Build a complete result from the patient's actual data.
 *
 * This runs whenever local inference is unavailable. It exists so that a
 * failed model call degrades to *this patient's real numbers and real variant
 * calls* rather than to a pre-written example — a cached example would report
 * findings the person does not have.
 */

type Finding = AnalysisResult["top_findings"][number];

// Only variants with a confidently mapped residue get a 3D structure. An
// intronic variant has no residue to point at, and guessing one would be
// fabrication dressed up as visualisation.
const STRUCTURE: Record<string, { uniprot: string; residue: number }> = {
  rs121908030: { uniprot: "P01130", residue: 303 },
};

function freqNote(rsid: string): string {
  const v = CARDIAC_PANEL[rsid];
  if (!v) return "";
  const { sas, nfe } = v.freq;
  if (sas === 0 && nfe === 0) return "";
  return `gnomAD v4 allele frequency: South Asian ${sas.toFixed(2)}%, European ${nfe.toFixed(2)}%.`;
}

function copyText(n: number): string {
  return n === 2 ? "two copies" : "one copy";
}

function variantFinding(call: StoredVariantCall): Finding | null {
  const v = CARDIAC_PANEL[call.rsid];
  if (!v || call.riskAlleleCount === 0) return null;

  const struct = STRUCTURE[call.rsid];
  const base = {
    genotype: call.genotype ?? undefined,
    zygosity: call.zygosity,
    clinvar: v.clinvar,
    frequency_note: freqNote(call.rsid),
    uniprot_id: struct?.uniprot ?? "",
    residue_position: struct?.residue ?? 0,
  };

  if (v.class === "pathogenic") {
    const isApob = v.gene === "APOB";
    return {
      ...base,
      signal: `${v.gene} ${v.proteinChange} (${call.rsid})`,
      severity: "high",
      plain_explanation: isApob
        ? `You carry ${copyText(call.riskAlleleCount)} of a change in the APOB gene (${v.proteinChange}). This is a recognised cause of inherited high cholesterol: the LDL particle binds less well to the receptor that clears it, so cholesterol lingers in the blood from an early age. ClinVar classifies it as ${v.clinvar.toLowerCase()}.`
        : `You carry ${copyText(call.riskAlleleCount)} of a change in the LDL receptor gene (${v.proteinChange}). The receptor that clears LDL from your blood works less efficiently, which raises LDL from birth rather than from lifestyle. ClinVar classifies it as ${v.clinvar.toLowerCase()}.`,
      action: `Ask your doctor for a referral to a lipid clinic and a full lipid profile including ApoB. Name the variant: ${v.gene} ${v.proteinChange} (${call.rsid}). First-degree relatives have a 50% chance of carrying it and should be offered cascade testing.`,
    };
  }

  return {
    ...base,
    signal: `${v.gene} raised Lp(a) variant (${call.rsid})`,
    severity: call.riskAlleleCount === 2 ? "high" : "medium",
    plain_explanation: `You carry ${copyText(
      call.riskAlleleCount
    )} of a common variant associated with higher lipoprotein(a). Lp(a) is a cholesterol-carrying particle that is set largely by genetics and is not measured on a standard lipid panel. This is a risk-associated common variant, not a disease-causing mutation — ClinVar classifies it as benign in the Mendelian sense.`,
    action: `Ask for a one-off Lp(a) blood test — it is not part of a standard lipid panel and has to be requested by name. If it is raised, that changes how aggressively your other risk factors should be treated.`,
  };
}

function hrvFinding(hrv: number): Finding | null {
  if (!hrv || hrv >= 30) return null;
  return {
    signal: `Low heart-rate variability (${Math.round(hrv)}ms rMSSD)`,
    severity: "medium",
    plain_explanation: `Your heart-rate variability estimate is in the lower range, which is associated with autonomic strain. Note this figure comes from a camera-based estimate, not an ECG, and should be treated as indicative rather than diagnostic.`,
    uniprot_id: "",
    residue_position: 0,
    action:
      "Confirm with a wearable or an ECG before acting on it. If it is genuinely low, daily slow breathing (4s in, 6s out) and sleep consistency are the interventions with the best evidence.",
  };
}

function tierFor(score: number, hasPathogenic: boolean): AnalysisResult["risk_tier"] {
  const byScore: AnalysisResult["risk_tier"] =
    score >= 75 ? "very_high" : score >= 50 ? "high" : score >= 25 ? "moderate" : "low";

  // A confirmed monogenic finding is categorical, not incremental. Carrying a
  // pathogenic FH variant warrants specialist referral whatever the composite
  // says — letting a summed score dilute it would reproduce exactly the failure
  // this tool exists to point at.
  if (hasPathogenic && (byScore === "low" || byScore === "moderate")) return "high";
  return byScore;
}

export function buildLocalResult(
  assessment: AssessmentData,
  framingham: number,
  cardiacai: number
): AnalysisResult {
  const calls = assessment.variantCalls ?? [];
  const carriers = calls.filter((c) => c.riskAlleleCount > 0);
  const notAssayed = calls.filter((c) => c.zygosity === "not_assayed");
  const hrv = assessment.vitals?.hrv ?? 0;

  const findings: Finding[] = [];
  // Pathogenic first, then risk-associated, then non-genomic signals.
  for (const c of carriers.filter((c) => CARDIAC_PANEL[c.rsid]?.class === "pathogenic")) {
    const f = variantFinding(c);
    if (f) findings.push(f);
  }
  for (const c of carriers.filter((c) => CARDIAC_PANEL[c.rsid]?.class === "risk_associated")) {
    const f = variantFinding(c);
    if (f) findings.push(f);
  }
  const hrvF = hrvFinding(hrv);
  if (hrvF) findings.push(hrvF);

  const gap = cardiacai - framingham;
  const gap_explanation =
    carriers.length > 0
      ? `Framingham estimates a 10-year probability from blood pressure, cholesterol, smoking and age alone. It does not look at the ${carriers.length} variant call${
          carriers.length === 1 ? "" : "s"
        } found here, at South Asian risk adjustment, or at your vitals. The two numbers are on different scales and are not competing estimates of the same quantity.`
      : `No risk alleles were found in the screened panel. The ${gap}-point difference here comes from the South Asian risk adjustment and your vitals, not from genetics.`;

  const action_plan: string[] = [];
  for (const c of carriers) {
    const v = CARDIAC_PANEL[c.rsid];
    if (!v) continue;
    action_plan.push(
      v.class === "pathogenic"
        ? `Lipid clinic referral — name ${v.gene} ${v.proteinChange} (${c.rsid}). Ask about cascade testing for relatives.`
        : `Request an Lp(a) blood test by name. It is not on a standard lipid panel.`
    );
  }
  action_plan.push(
    "Ask for ApoB rather than LDL-C alone at your next lipid test — it is the better predictor and is under-used in Indian practice."
  );
  if (notAssayed.length > 0) {
    action_plan.push(
      `${notAssayed.length} of the ${calls.length} panel variants were not present on this array, so they were not ruled out. A negative screen here is not a negative result for them.`
    );
  }
  action_plan.push(
    `This screen cannot detect ${NOT_ARRAY_DETECTABLE.map((n) => n.label).join(" or ")}. If there is a family history of unexplained cardiac death, ask about sequencing rather than an array.`
  );

  const family_recommendations =
    carriers.some((c) => CARDIAC_PANEL[c.rsid]?.class === "pathogenic")
      ? [
          "First-degree relatives (parents, siblings, children) have a 50% chance of carrying the same variant and should be offered cascade testing through a lipid or genetics clinic.",
          "Children of carriers can be screened from around age 10 for inherited high cholesterol.",
        ]
      : [
          "Share your Lp(a) result with siblings — Lp(a) is largely inherited, so a raised level in you makes theirs worth checking.",
        ];

  const citations = [
    "AHA 2018 — Circulation 138:e1 — South Asian cardiovascular disease scientific statement",
    "MASALA Study — UCSF / Northwestern",
    ...[...new Set(carriers.map((c) => CARDIAC_PANEL[c.rsid]?.citation).filter(Boolean))],
    "Variant classifications: NCBI ClinVar. Allele frequencies: gnomAD v4.",
  ] as string[];

  const tts_hindi =
    carriers.length > 0
      ? `आपकी जांच में ${carriers.length} आनुवंशिक संकेत मिले हैं। कृपया अपने डॉक्टर से लिपिड प्रोफाइल और Lp(a) टेस्ट के बारे में बात करें। यह जानकारी आपके परिवार के लिए भी उपयोगी है। यह निदान नहीं है, केवल एक संकेत है।`
      : `आपकी जांच में कोई जोखिम वाला आनुवंशिक बदलाव नहीं मिला। फिर भी अपने दिल की नियमित जांच कराते रहें। यह निदान नहीं है, केवल एक संकेत है।`;

  return {
    cardiacai_score: cardiacai,
    framingham_score: framingham,
    risk_tier: tierFor(
      cardiacai,
      carriers.some((c) => CARDIAC_PANEL[c.rsid]?.class === "pathogenic")
    ),
    gap_explanation,
    tts_hindi,
    top_findings: findings,
    action_plan,
    family_recommendations,
    citations,
  };
}
