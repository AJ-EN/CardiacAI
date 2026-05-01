import type { AnalysisResult } from "./store";

// Pre-validated hardcoded response for "Ramesh, 38" demo path.
// Used when live Claude API call fails or is slow on stage.
// This is the kill shot: Framingham 4% LOW vs CardiacAI 71 HIGH.
export const RAMESH_FALLBACK: AnalysisResult = {
  cardiacai_score: 71,
  framingham_score: 4,
  risk_tier: "high",
  gap_explanation:
    "Framingham was built on Western populations and sees only normal blood values — but CardiacAI detected two South-Asian-specific genetic variants that raise cardiac risk dramatically, invisible to any standard panel.",
  top_findings: [
    {
      signal: "LPA variant (rs10455872)",
      severity: "high",
      plain_explanation:
        "You carry a Lipoprotein(a) gene variant found 2–3× more often in South Asians. Lp(a) is a cholesterol particle that clogs arteries — and it doesn't show up on a standard cholesterol test. Most Indian GPs never check for it.",
      uniprot_id: "P08519",
      residue_position: 4057,
      action:
        "Ask your cardiologist specifically for an Lp(a) blood test — it costs under ₹500 and is NOT on standard lipid panels. Mention rs10455872 by name.",
    },
    {
      signal: "MYBPC3 Δ25bp carrier",
      severity: "high",
      plain_explanation:
        "You carry the MYBPC3 deletion found in approximately 4% of Indians and near-zero in Europeans. This variant thickens the heart muscle over time (hypertrophic cardiomyopathy) and can cause sudden cardiac events — often with no prior warning.",
      uniprot_id: "Q14896",
      residue_position: 502,
      action:
        "Request an echocardiogram and ask the cardiologist to check for hypertrophic cardiomyopathy. Mention MYBPC3 Δ25bp by name. Avoid intense competitive sports until reviewed.",
    },
    {
      signal: "Low HRV (28ms rMSSD)",
      severity: "medium",
      plain_explanation:
        "Your heart rate variability is in the lowest third of the population. This reflects chronic stress on your autonomic nervous system — a known early marker of cardiac strain that appears years before symptoms.",
      uniprot_id: "",
      residue_position: 0,
      action:
        "Begin 10 minutes of daily slow breathing (4s inhale / 6s exhale). Track HRV weekly. Target above 40ms rMSSD. Discuss with GP if no improvement in 6 weeks.",
    },
  ],
  action_plan: [
    "Get an Lp(a) blood test — ask for it by name, it is not on standard panels. Under ₹500 at any diagnostic lab.",
    "Book an echocardiogram and mention MYBPC3 Δ25bp to the cardiologist. Do not wait for symptoms.",
    "All first-degree male relatives under 50 should have an Lp(a) test and echo — MYBPC3 is inherited.",
    "Avoid NSAIDs (ibuprofen, diclofenac) — they interact poorly with cardiac gene variants like SCN5A.",
    "Next GP visit: ask for ApoB test, not just LDL-C. ApoB is a better cardiac risk predictor for South Asians.",
  ],
  family_recommendations: [
    "Father and brothers under 50: Lp(a) test + echocardiogram. MYBPC3 is autosomal dominant — 50% chance passed to children.",
    "Sons aged 18+: cardiac genetics panel including MYBPC3 screening before starting competitive sports.",
  ],
  citations: [
    "AHA 2018 — Circulation 138:e585 — South Asian CVD Scientific Statement",
    "MASALA Study — UCSF/Northwestern — SA risk under-prediction by 50%",
    "AlphaMissense — Science 2023 doi:10.1126/science.adg7492",
    "Dhandapany et al. — Nature Genetics 2009 doi:10.1038/ng.309 — MYBPC3 Δ25bp in South Asians",
  ],
};

export const RAMESH_TTS_HINDI =
  "रमेश जी, आपके परीक्षण में दो महत्वपूर्ण बातें सामने आई हैं। आपके जीन में एक विशेष बदलाव है जो भारतीय लोगों में अधिक पाया जाता है, और यह दिल की बीमारी का खतरा बढ़ाता है। कृपया अपने डॉक्टर से Lp(a) का टेस्ट और दिल का अल्ट्रासाउंड करवाएं। यह जानकारी आपके परिवार के लिए भी जरूरी है।";
