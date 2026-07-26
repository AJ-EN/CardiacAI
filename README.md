# CardiacAI — South-Asian-Calibrated Cardiovascular Risk Screening

> **"Same patient. Two scores. One of them is true."**

CardiacAI is a local-first, privacy-preserving AI co-clinician that catches the cardiac risk Western tools systematically miss in South Asian populations. It runs entirely on-device using **Google Gemma 4** via **Ollama** — no cloud APIs, no data leaving the machine.

---

## The Problem

Standard cardiovascular risk calculators (Framingham, ASCVD, QRISK) were built on Western cohorts. They **systematically under-predict risk by ~50%** for the 2 billion South Asians worldwide ([AHA 2018, Circulation 138:e585](https://doi.org/10.1161/CIR.0000000000000580); [MASALA Study, UCSF/Northwestern](https://masalastudy.org/)).

A 38-year-old Indian male with normal blood values, pathogenic LPA and MYBPC3 variants scores **4% (LOW)** on Framingham — and **71 (HIGH)** on CardiacAI. The difference: South-Asian-specific genomic signals that standard tools cannot see.

## How Gemma 4 Powers CardiacAI

| Capability | How Gemma 4 Is Used |
|---|---|
| **Clinical Risk Reasoning** | Gemma 4 (via Ollama) acts as the AI agent interpreting genomic variants, biometrics, and lifestyle data against South Asian cardiac epidemiology |
| **Structured JSON Output** | `format: 'json'` in the Ollama API enforces strict schema adherence for reliable downstream parsing |
| **Multilingual Health Equity** | Generates both English and Hindi (`hi-IN`) patient-facing explanations — bridging the language barrier for 600M+ Hindi speakers |
| **Local-First Privacy** | Genome data, biometrics, and health markers never leave the user's machine — Gemma 4 runs entirely via local Ollama |
| **Domain-Specific Calibration** | System prompt encodes AHA 2018 SA multipliers, AlphaMissense gene weights, and MASALA Study findings for grounded clinical reasoning |

## What the App Does

- **Standard health markers** — age, sex, blood pressure, cholesterol, BMI, smoking, BP medication, diabetes status
- **Camera-based rPPG** — 30-second facial scan for heart rate and HRV estimation (WebRTC), with demo mode fallback
- **Client-side genome parsing** — 23andMe `.txt` file → rsID extraction entirely in-browser (no upload to server)
- **Cardiac variant screening** — focused AlphaMissense-inspired lookup: `LPA`, `MYBPC3`, `LDLR`, `PCSK9`, `APOB`, `MYH7`, `SCN5A`, `TTN`
- **Dual-score comparison** — Framingham (Western) vs CardiacAI (SA-calibrated) side by side
- **AI-powered analysis** — Gemma 4 generates patient-facing findings, action plans, family recommendations, and citations
- **Hindi TTS** — browser-native speech synthesis for patient accessibility
- **3D protein viewer** — AlphaFold PDB visualization with mutation highlighting via 3Dmol.js

## Architecture

```
┌───────────────────────────────────────────────────┐
│                  Browser (Client)                  │
│                                                   │
│  WebRTC Camera → rPPG Engine → Heart Rate / HRV   │
│  23andMe .txt → Genome Parser → Variant Lookup    │
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
│  Fallback: pre-cached Ramesh JSON (demo-safe)     │
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
| AI Agent | **Gemma 4 via Ollama** | Local inference, strict JSON, SA-calibrated prompt |
| Heart Rate/HRV | rPPG via face-api.js (WebRTC) | Demo-mode toggle for unreliable lighting |
| Genome Parser | Plain JavaScript | 23andMe .txt → rsID, client-side only |
| Variant Lookup | AlphaMissense-inspired | Focused cardiac gene table, IndexedDB |
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
    genome/page.tsx         Genome upload and variant lookup step
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
  agent-prompt.ts           Gemma 4 system prompt (SA-calibrated cardiac agent)
  alphamissense.ts          Focused cardiac rsID lookup table
  genome-parser.ts          23andMe text parser
  risk-calculator.ts        Framingham and CardiacAI score logic
  rppg-engine.ts            rPPG signal processing engine
  ramesh-fallback.ts        Pre-cached demo result (Gemma 4 inference fallback)
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
- Genome step includes a built-in demo genome path that flags `LPA` and `MYBPC3`
- If Ollama / Gemma 4 is unavailable, pre-cached "Ramesh, 38" fallback loads instantly (demo never breaks)
- Hindi summary playback via browser-native speech synthesis
- WhatsApp family-share section is a mock UI (not a live integration)
- 3D protein viewer tries local PDB files first, falls back to AlphaFold EBI URLs

## Data Sources

| Source | Use | License |
|---|---|---|
| [AlphaMissense (DeepMind)](https://zenodo.org/records/8208688) | Variant pathogenicity predictions | CC-BY 4.0 |
| [AlphaFold DB](https://alphafold.ebi.ac.uk) | Protein PDB structures | CC-BY 4.0 |
| [ClinVar (NCBI)](https://www.ncbi.nlm.nih.gov/clinvar/) | Variant–disease cross-reference | Public domain |
| [1000 Genomes](https://www.internationalgenome.org/) | Demo genome (GIH/PJL) | Open access |

## Key Citations

- AHA 2018 SA Statement — *Circulation* 138:e585 — [doi:10.1161/CIR.0000000000000580](https://doi.org/10.1161/CIR.0000000000000580)
- MASALA Study — UCSF/Northwestern — [masalastudy.org](https://masalastudy.org/)
- AlphaMissense — *Science* 2023 — [doi:10.1126/science.adg7492](https://doi.org/10.1126/science.adg7492)
- Dhandapany et al. MYBPC3 — *Nature Genetics* 2009 — [doi:10.1038/ng.309](https://doi.org/10.1038/ng.309)
- *The Brown Heart* — Drs. Nirmal & Renu Joshi, JioHotstar 2025

## Medical Disclaimer

CardiacAI is a screening and education prototype. It does not diagnose disease, replace clinical judgment, or provide emergency medical advice. Any high-risk finding should be reviewed with a qualified clinician using named clinical tests and standard medical evaluation. Same category as Apple Watch ECG — it says "show this to a doctor," it doesn't say "you have a condition." We route, we don't diagnose.
