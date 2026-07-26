# CardiacAI — CLAUDE.md

> "Same patient. Two scores. One of them is true."

---

## What This Is

CardiacAI is a **South-Asian-calibrated AI co-clinician** for cardiovascular risk screening. It is **not** a diagnosis tool — it is a screening signal (same legal category as Apple Watch ECG). It aims to surface asymptomatic risk that Western-derived tools under-weight for South Asians. It is an unvalidated prototype heuristic: no derivation cohort, no discrimination or calibration statistics.

The demo: same patient, Framingham (1% — LOW) beside the Concern Index, side by side and large, with the verified variant calls that Framingham structurally cannot see. The two numbers are on different scales — the UI says so explicitly rather than implying one refutes the other.

---

## Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js 14 + Tailwind + shadcn/ui | App router, mobile-first |
| Heart Rate/HRV | rPPG via YCbCr + CHROM (WebRTC) | **Build demo-mode toggle FIRST** — high failure risk under venue lighting |
| Voice Pipeline | UI stub only | Waveform animation + hardcoded neutral score. Real Meyda.js extraction is CUT. Too fragile. |
| Genome Parser | Plain JavaScript | 23andMe .txt → rsIDs → tab-split, no library needed |
| Variant Calling | Curated dbSNP/ClinVar panel → IndexedDB | Genotype-aware, plus-strand risk alleles |
| 3D Protein | 3Dmol.js + AlphaFold PDB | Pre-cache PDB, red sphere on mutation residue, auto-rotation |
| AI Agent | **Gemma 4 via Ollama** (local) | Single `/api/analyse` endpoint, `format: 'json'`, narration only — scores pinned client-side |
| Hindi TTS | `window.speechSynthesis` | hi-IN voice, browser-native, free, 30-min integration |
| Deployment | Vercel + local Ollama | Frontend on Vercel, AI inference local via Ollama |

---

## Design Tokens (locked — never revisit)

```
Background:     #f7f6f2  (warm white / clinical)
Risk Red:       #c0392b
Text:           #1a1a1a
Text dim:       #5a5751
Score font:     Playfair Display (serif, bold 900)
Body font:      Inter
Mono font:      JetBrains Mono
Border:         #e2ddd5
```

---

## Cardiac Variant Panel (dbSNP / ClinVar verified, July 2026)

Points are a **heuristic triage weighting, not derived effect sizes.**
Risk alleles are GRCh38 **plus strand** — the orientation consumer arrays report.

| rsID | Gene / consequence | Risk allele | ClinVar | Points | gnomAD SAS / NFE |
|---|---|---|---|---|---|
| rs121908030 | LDLR p.Asp303Asn | A | Pathogenic | 25 (dominant) | 0.00% / 0.0001% |
| rs5742904 | APOB p.Arg3527Gln | T | Pathogenic | 20 (dominant) | 0.00% / 0.0495% |
| rs10455872 | LPA, intronic | G | Benign (risk-associated) | 10 per copy | 1.01% / 6.94% |
| rs3798220 | LPA p.Ile→Met | C | Benign (risk-associated) | 8 per copy | 0.48% / 1.75% |

LPA contributions are capped at 20: both variants tag the same intermediate
phenotype (plasma Lp(a)) and must not stack as independent risks.

**Not array-detectable** — stated on screen rather than silently omitted:
- *MYBPC3* Δ25bp — 25bp intronic deletion, ~4% of South Asians, near-absent in
  Europeans (Dhandapany 2009). Genuinely SA-specific; requires sequencing.
- *LPA* KIV-2 copy number — VNTR, the dominant determinant of Lp(a) level.

**Removed after verification:** rs28942073 (maps to HEXB, not LDLR),
rs28942109 (SAR1B, not PCSK9), rs397516037 (MYBPC3, not MYH7),
rs281875428 (not in dbSNP), rs397516064 (ClinVar likely-benign),
rs199473084 and rs397517775 (uncertain significance).

**Note:** no panel variant is South-Asian-enriched. All four are commoner in
Europeans or absent from South Asian reference data. The SA-specific signals
are precisely the ones arrays cannot see — that gap is the honest finding.

---

## Risk Calibration Algorithm

```
1. Compute Framingham 10-yr hard CHD risk (NCEP ATP III, sex-specific tables)
2. Apply SA multiplier × 1.5 — HEURISTIC. The 2018 ACC/AHA guidance treats
   South Asian ancestry as a qualitative risk-enhancing factor; it does NOT
   specify a 1.5 multiplier. Do not cite AHA 2018 as the source of this number.
3. Add variant points (table above)
4. HRV lowest tertile (<30ms rMSSD): +10
   Voice stress score >2SD: +5
5. Family history CAD before 55: +12
   Sleep <6hrs avg: +5
   Sitting >10hrs/day: +5
6. Cap final CardiacAI score at 95
7. Compute Framingham SEPARATELY — no SA multiplier, no genomics/vitals
```

---

## Agent API Contract

**Endpoint:** `POST /api/analyse`

**Input:**
```json
{ "basic_markers": {}, "variant_calls": [{"gene":"","rsid":"","genotype":"AG","zygosity":"heterozygous","risk_allele_copies":1}],
  "vitals": {}, "voice_score": 0, "lifestyle": {}, "pre_computed": {}, "language": "en|hi" }
```

**Output — narration only (strict JSON, no preamble):**
```json
{
  "gap_explanation": "1-2 sentences; must say the scales differ",
  "action_plan": ["4-6 concrete steps, each naming a test or specialist"],
  "family_recommendations": ["Who specifically + exact test"],
  "tts_hindi": "2-3 warm sentences in Hindi"
}
```

**Critical:** the model does NOT produce scores, risk tier, findings, or
citations. Those are computed in `lib/build-result.ts` from the patient's own
data and pinned by the client; anything the model returns for them is
discarded. On inference failure `/api/analyse` returns **503** and the client
renders its locally computed result. Never substitute a pre-written example —
that reports findings the patient does not have.

---

## Demo Data — "Ramesh, 38"

```
Age: 38, Sex: Male, Ethnicity: South Asian
BP: 128/82, LDL: 110, HDL: 48, Total cholesterol: 195
BMI: 24, Non-smoker
Genome: illustrative genotypes at the 4 verified panel positions
  rs5742904 CT  (APOB p.Arg3527Gln — pathogenic, heterozygous)
  rs10455872 AG (LPA risk allele, 1 copy)
  rs3798220 TT  (non-carrier)
  rs121908030 GG (non-carrier)
Expected output: Framingham 1% LOW · Concern Index ~32 (42 if the camera step runs;
varies with lifestyle answers)
```

This is the ONLY demo path. Never accept a judge's personal genome file live.
The demo genotypes are illustrative calls at real verified positions — they are
not a real individual's genome and the UI says so.

---

## Build Priority Order (strict)

1. **Agent system prompt** — iterate 30+ times, test 10+ inputs, this IS the moat
2. **rPPG demo-mode toggle** — before any other biometric feature
3. **Score dashboard** — two numbers side by side, large, high contrast
4. **Genomic parser + genotype-aware variant calling**
5. **Voice UI stub** (animation only, hardcoded score)
6. **Hindi TTS** (~30 min, browser-native)
7. **3D protein viewer** (gravy — score alone wins if needed)

---

## Cut List (DO NOT BUILD)

- User accounts / login / signup
- Persistent backend database (LocalStorage + IndexedDB is enough)
- Real WhatsApp family share (mock the screen)
- Multi-language beyond Hindi + English
- Native iOS/Android app (PWA is enough)
- Live voice acoustic extraction (Meyda.js wired)
- Co-clinician PDF/Markdown export (say "v2" in pitch)
- Doctor portal / EMR integration
- Multiple 3D protein viewers
- Longitudinal tracking / history charts
- Custom ML model training
- Settings / onboarding / feature walkthrough screens

---

## Data Sources

| Source | Use | Location |
|---|---|---|
| NCBI ClinVar | Variant classifications for every panel entry | ncbi.nlm.nih.gov/clinvar/ |
| gnomAD v4 | Population allele frequencies | gnomad.broadinstitute.org |
| NCBI dbSNP | Ref/alt alleles, strand orientation | ncbi.nlm.nih.gov/snp/ |
| AlphaFold DB | Protein PDB files for 3D viewer | alphafold.ebi.ac.uk/entry/{UniProtID} |

---

## Key Citations (print before demo)

- AHA 2018 SA Statement — *Circulation* 138:e585
- MASALA Study — UCSF/Northwestern
- Clarke et al. LPA variants — *N Engl J Med* 2009;361:2518
- Dhandapany et al. MYBPC3 — *Nature Genetics* 2009, doi:10.1038/ng.309
- *The Brown Heart* — Drs. Nirmal & Renu Joshi, JioHotstar 2025

---

## Regulatory Framing

**If asked "are you practicing medicine?":**
"Screening signal, not a diagnosis. Same category as Apple Watch ECG — it says show this to a doctor, it doesn't say you have a condition. We route, we don't diagnose."

---

## Three-Layer Demo Backup

1. Live Vercel URL
2. `localhost` (always running before walk-in)
3. Recorded video on phone

Never walk in without all three.
