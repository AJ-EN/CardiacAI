# CardiacAI — CLAUDE.md

> "Same patient. Two scores. One of them is true."
> DevSummit 2026 · Bio Tech Track · Jagannath University, Jaipur · Solo 24h Build

---

## What This Is

CardiacAI is a **South-Asian-calibrated AI co-clinician** for cardiovascular risk screening. It is **not** a diagnosis tool — it is a screening signal (same legal category as Apple Watch ECG). It catches asymptomatic high-risk patients that Western tools (Framingham, ASCVD, QRISK) systematically miss by ~50% for South Asian populations.

The kill shot: show the same patient scored by Framingham (4% — LOW) vs CardiacAI (71 — HIGH), side by side, large, with the SA-specific genomic findings that explain the gap.

---

## Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js 14 + Tailwind + shadcn/ui | App router, mobile-first |
| Heart Rate/HRV | rPPG via face-api.js (WebRTC) | **Build demo-mode toggle FIRST** — high failure risk under venue lighting |
| Voice Pipeline | UI stub only | Waveform animation + hardcoded neutral score. Real Meyda.js extraction is CUT. Too fragile. |
| Genome Parser | Plain JavaScript | 23andMe .txt → rsIDs → tab-split, no library needed |
| Variant Lookup | AlphaMissense → IndexedDB | ~50MB pre-filtered CSV, progress screen on first load |
| 3D Protein | 3Dmol.js + AlphaFold PDB | Pre-cache PDB, red sphere on mutation residue, auto-rotation |
| AI Agent | Claude API (`claude-sonnet-4-6`) | Single `/api/analyse` endpoint, strict JSON output, Ramesh fallback pre-cached |
| Hindi TTS | `window.speechSynthesis` | hi-IN voice, browser-native, free, 30-min integration |
| Deployment | Vercel | Deploy empty shell in hour 0 — HTTPS live from minute one |

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

## Cardiac Gene Weights (AlphaMissense filter)

| Gene | Points | Why |
|---|---|---|
| LPA | +25 | 2–3x higher in South Asians; most GPs never test |
| LDLR | +20 | Familial hypercholesterolemia, presents at normal BMI in SA |
| PCSK9 | +18 | Gain-of-function = massively elevated LDL |
| MYBPC3 | +15 | SA Δ25bp deletion, ~4% of Indians, near-zero in Europeans, HCM risk |
| APOB | +15 | Better MI predictor than LDL-C, almost never tested in India |
| MYH7 | +12 | Hypertrophic cardiomyopathy, young adult sudden death |
| SCN5A | +12 | Arrhythmia / Brugada syndrome, young male sudden death |
| TTN | +10 | Dilated cardiomyopathy, most common genetic cardiac cause |

---

## Risk Calibration Algorithm

```
1. Compute ASCVD baseline from basic_markers
2. Apply AHA 2018 SA multiplier × 1.5
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
{ "basic_markers": {}, "variants": [], "vitals": {}, "voice_score": 0, "lifestyle": {}, "language": "en|hi" }
```

**Output (strict JSON, no preamble):**
```json
{
  "cardiacai_score": 0-100,
  "framingham_score": 0-100,
  "risk_tier": "low|moderate|high|very_high",
  "gap_explanation": "1 sentence plain language",
  "top_findings": [
    {
      "signal": "variant name or vital",
      "severity": "low|medium|high",
      "plain_explanation": "no jargon",
      "uniprot_id": "for AlphaFold 3D lookup",
      "residue_position": 123,
      "action": "specific test name or concrete step"
    }
  ],
  "action_plan": ["Ask for Lp(a) blood test", "..."],
  "family_recommendations": ["..."],
  "citations": ["AHA 2018 — Circulation 138:e585", "..."]
}
```

**Critical:** Pre-cache the perfect Ramesh JSON as hardcoded fallback. If live API fails on stage, cached JSON shows instantly.

---

## Demo Data — "Ramesh, 38"

```
Age: 38, Sex: Male, Ethnicity: South Asian
BP: 128/82, LDL: 110, HDL: 48, Total cholesterol: 195
BMI: 24, Non-smoker
Genome: 1000 Genomes GIH sample — LPA pathogenic + MYBPC3 Δ25bp carrier
Expected output: Framingham ~4% LOW · CardiacAI ~71 HIGH
```

This is the ONLY demo path. Never accept a judge's personal genome file live.

---

## Build Priority Order (strict)

1. **Agent system prompt** — iterate 30+ times, test 10+ inputs, this IS the moat
2. **rPPG demo-mode toggle** — before any other biometric feature
3. **Score dashboard** — two numbers side by side, large, high contrast
4. **Genomic parser + AlphaMissense IndexedDB**
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
| AlphaMissense (DeepMind) | 71M variant pathogenicity predictions, CC-BY 4.0 | zenodo.org/records/8208688 |
| AlphaFold DB | Protein PDB files for 3D viewer | alphafold.ebi.ac.uk/entry/{UniProtID} |
| ClinVar (NCBI) | Variant–disease cross-reference | ncbi.nlm.nih.gov/clinvar/ |
| 1000 Genomes GIH/PJL | Demo genome file ("Ramesh") | internationalgenome.org |

---

## Key Citations (print before demo)

- AHA 2018 SA Statement — *Circulation* 138:e585
- MASALA Study — UCSF/Northwestern
- AlphaMissense — *Science* 2023, doi:10.1126/science.adg7492
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
