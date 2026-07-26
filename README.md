# CardiacAI — South-Asian-Calibrated Cardiovascular Risk Screening

> **"Same patient. Two scores. One of them is true."**

CardiacAI is a local-first, privacy-preserving cardiac risk screening prototype for South Asian populations. It runs entirely on-device using **Google Gemma 4** via **Ollama** — no cloud APIs, no data leaving the machine.

---

## The Problem

Standard cardiovascular risk calculators (Framingham, ASCVD, QRISK) were built on Western cohorts. They under-predict risk for South Asians, who develop coronary disease earlier and at lower BMI than Western reference cohorts ([AHA 2018, Circulation 138:e1](https://doi.org/10.1161/CIR.0000000000000580); [MASALA Study, UCSF/Northwestern](https://masalastudy.org/)). Note QRISK3 does carry a South Asian ethnicity term; the US Pooled Cohort Equations do not.

A 38-year-old Indian male with unremarkable blood values who carries a pathogenic *APOB* variant scores **4% (LOW)** on Framingham. Framingham reads blood pressure, cholesterol, smoking and age — it has no way to see an inherited lipid disorder, and no South Asian term.

## Scientific Honesty

This is a **prototype screening heuristic, not a validated clinical instrument.** It has no derivation cohort, no discrimination statistic, and no calibration curve. The Concern Index is a triage weighting, not a probability, and it is on a different scale from Framingham. Treat both numbers as prompts to talk to a clinician, not as competing estimates of the same quantity.

Specific limits worth stating up front:

- **The variant panel is small and hand-curated.** Four variants across *LDLR*, *APOB* and *LPA*, each verified against NCBI dbSNP and ClinVar, with gnomAD v4 allele frequencies. It is not a comprehensive cardiac gene screen.
- **None of the panel variants are South-Asian-enriched.** All four are more common in Europeans, or absent from South Asian reference populations. The genuinely SA-specific signals — the *MYBPC3* Δ25bp deletion and *LPA* KIV-2 copy number — are structural variants that genotyping arrays physically cannot detect. The app says so on screen rather than implying coverage it does not have.
- **The gene weights are a heuristic ordering, not derived effect sizes.**
- **HRV from a webcam is indicative only.** rPPG at 30fps cannot resolve rMSSD to ECG precision.

## How Gemma 4 Powers CardiacAI

| Capability | How Gemma 4 Is Used |
|---|---|
| **Clinical Risk Reasoning** | Gemma 4 (via Ollama) acts as the AI agent interpreting genomic variants, biometrics, and lifestyle data against South Asian cardiac epidemiology |
| **Structured JSON Output** | `format: 'json'` in the Ollama API enforces strict schema adherence for reliable downstream parsing |
| **Multilingual Health Equity** | Generates both English and Hindi (`hi-IN`) patient-facing explanations — bridging the language barrier for 600M+ Hindi speakers |
| **Local-First Privacy** | Genome data, biometrics, and health markers never leave the user's machine — Gemma 4 runs entirely via local Ollama |
| **Constrained Narration** | The model receives already-computed scores and variant calls and writes only the plain-language framing. Scores, findings and citations are pinned by the application and any the model invents are discarded |

## What the App Does

- **Standard health markers** — age, sex, blood pressure, cholesterol, BMI, smoking, BP medication, diabetes status
- **Camera-based rPPG** — 30-second facial scan for heart rate and HRV estimation (WebRTC), with demo mode fallback
- **Client-side genome parsing** — 23andMe `.txt` file → rsID extraction entirely in-browser (no upload to server)
- **Genotype-aware variant calling** — a ClinVar-verified panel across `LDLR`, `APOB` and `LPA`. Risk alleles are matched allele by allele on the GRCh38 plus strand, so "not assayed", "no call", "non-carrier", "heterozygous" and "homozygous" are distinct outcomes
- **Dual-score comparison** — Framingham (Western) vs CardiacAI (SA-calibrated) side by side
- **Constrained AI narration** — Gemma 4 writes the plain-language framing. Scores, variant findings and citations are computed by the application and pinned; anything the model invents for those fields is discarded
- **Hindi TTS** — browser-native speech synthesis for patient accessibility
- **3D protein viewer** — AlphaFold PDB visualization with mutation highlighting via 3Dmol.js

## Architecture

```
┌───────────────────────────────────────────────────┐
│                  Browser (Client)                  │
│                                                   │
│  WebRTC Camera → rPPG Engine → Heart Rate / HRV   │
│  23andMe .txt → Parser → Genotype-aware calling   │
│  Health Markers + Lifestyle → Risk Calculator     │
│  localStorage / IndexedDB (all data stays local)  │
└─────────────────────┬─────────────────────────────┘
                      │ POST /api/analyse
                      ▼
┌───────────────────────────────────────────────────┐
│              Next.js API Route (Server)            │
│                                                   │
│  Ollama Node.js Client → ollama.chat()            │
│  Model: gemma4 | format: json                     │
│  System prompt: SA-calibrated cardiac agent       │
│  On failure: 503 (client renders local result)    │
└─────────────────────┬─────────────────────────────┘
                      │
                      ▼
┌───────────────────────────────────────────────────┐
│              Ollama (Local Server)                  │
│                                                   │
│  Gemma 4 model running on localhost:11434          │
│  No cloud. No API keys. No data exfiltration.     │
└───────────────────────────────────────────────────┘
```

## User Flow

```
Landing → /assess/vitals → /assess/camera → /assess/genome → /assess/lifestyle → /assess/analysing → /results
```

## Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js 16 App Router + Tailwind v4 + shadcn | Mobile-first, TypeScript |
| AI Agent | **Gemma 4 via Ollama** | Local inference, strict JSON, narration-only role |
| Heart Rate/HRV | rPPG via face-api.js (WebRTC) | Demo-mode toggle for unreliable lighting |
| Genome Parser | Plain JavaScript | 23andMe .txt → rsID, client-side only |
| Variant Calling | Curated dbSNP/ClinVar panel | Genotype-aware, plus-strand risk alleles, IndexedDB |
| 3D Protein | 3Dmol.js + AlphaFold PDB | Red sphere on mutation residue, auto-rotate |
| Hindi TTS | `window.speechSynthesis` | hi-IN voice, browser-native |
| Animation | Framer Motion | Micro-interactions and transitions |

## Local Setup

### Prerequisites

1. **Install Ollama** (if not already installed):
   ```bash
   brew install ollama
   ```

2. **Pull the Gemma 4 model**:
   ```bash
   ollama pull gemma4
   ```

3. **Start the Ollama server** (runs on `localhost:11434`):
   ```bash
   ollama serve
   ```

### Run CardiacAI

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables (optional)

No API keys required. All config is optional:

```bash
# Override Ollama server address (default: http://localhost:11434)
OLLAMA_HOST=http://localhost:11434

# Override model name (default: gemma4)
OLLAMA_MODEL=gemma4
```

## Project Structure

```
app/
  page.tsx                  Landing page and assessment reset
  assess/
    vitals/page.tsx         Basic health marker form
    camera/page.tsx         rPPG scan step
    genome/page.tsx         Genome upload and genotype-aware calling step
    lifestyle/page.tsx      Lifestyle questionnaire
    analysing/page.tsx      Client-side scoring and API call
    voice/page.tsx          Voice biomarker UI stub
  api/analyse/route.ts      Gemma 4 (Ollama) analysis endpoint
  results/page.tsx          Score comparison and recommendations

components/
  RPPGCamera.tsx            Camera capture and scan UI
  GenomeUpload.tsx          23andMe upload, demo genome, scan theatre
  ProteinViewer.tsx         3Dmol/AlphaFold protein visualization
  StepLayout.tsx            Shared assessment layout
  VoiceStub.tsx             Stubbed voice analysis UI

lib/
  agent-prompt.ts           Gemma 4 system prompt (narration only, scores pinned)
  cardiac-panel.ts          ClinVar-verified panel + genotype-aware calling
  build-result.ts           Builds the result from the patient's own calls
  genome-parser.ts          23andMe text parser (preserves genotype)
  risk-calculator.ts        Framingham and CardiacAI score logic
  rppg-engine.ts            rPPG signal processing engine
  store.ts                  Assessment/result types and browser storage
  tts.ts                    Hindi/English browser speech helpers

public/pdb/
  P08519.pdb                Local LPA protein structure
  Q14896.pdb                Local MYBPC3 protein structure
```

## Privacy Model

- **All genome parsing happens client-side** — the raw `.txt` file never leaves the browser
- Health markers, vitals, and results stored in browser `localStorage`
- Variant lookup table cached in IndexedDB
- Only the assessment payload and flagged variant identifiers are sent to the **local** `/api/analyse` route
- Gemma 4 runs via **local Ollama** — no cloud API, no data exfiltration
- Zero API keys required

## Demo Notes

- Camera scanning uses real browser camera access when available; silently falls back to demo mode
- Genome step includes illustrative demo genotypes at the four verified panel positions (one pathogenic carrier, one risk allele, two non-carriers). These are example calls, not a real individual's genome
- If Ollama / Gemma 4 is unavailable, `/api/analyse` returns 503 and the client renders a result computed entirely from the patient's own data. It never substitutes a pre-written example
- Hindi summary playback via browser-native speech synthesis
- WhatsApp family-share section is a mock UI (not a live integration)
- 3D protein viewer tries local PDB files first, falls back to AlphaFold EBI URLs

## Data Sources

| Source | Use | License |
|---|---|---|
| [NCBI ClinVar](https://www.ncbi.nlm.nih.gov/clinvar/) | Variant classifications for every panel entry | Public domain |
| [gnomAD v4](https://gnomad.broadinstitute.org/) | Population allele frequencies | CC0 |
| [NCBI dbSNP](https://www.ncbi.nlm.nih.gov/snp/) | Reference/alternate alleles, strand orientation | Public domain |
| [AlphaFold DB](https://alphafold.ebi.ac.uk) | Protein PDB structures | CC-BY 4.0 |
| [ClinVar (NCBI)](https://www.ncbi.nlm.nih.gov/clinvar/) | Variant–disease cross-reference | Public domain |
| [1000 Genomes](https://www.internationalgenome.org/) | Demo genome (GIH/PJL) | Open access |

## Key Citations

- AHA 2018 SA Statement — *Circulation* 138:e585 — [doi:10.1161/CIR.0000000000000580](https://doi.org/10.1161/CIR.0000000000000580)
- MASALA Study — UCSF/Northwestern — [masalastudy.org](https://masalastudy.org/)
- Clarke et al. — *N Engl J Med* 2009;361:2518 — LPA variants and coronary disease
- Dhandapany et al. MYBPC3 — *Nature Genetics* 2009 — [doi:10.1038/ng.309](https://doi.org/10.1038/ng.309)
- *The Brown Heart* — Drs. Nirmal & Renu Joshi, JioHotstar 2025

## Medical Disclaimer

CardiacAI is a screening and education prototype. It does not diagnose disease, replace clinical judgment, or provide emergency medical advice. Any high-risk finding should be reviewed with a qualified clinician using named clinical tests and standard medical evaluation. Same category as Apple Watch ECG — it says "show this to a doctor," it doesn't say "you have a condition." We route, we don't diagnose.
