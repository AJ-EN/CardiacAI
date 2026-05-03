# CardiacAI

CardiacAI is a Next.js prototype for South-Asian-calibrated cardiovascular risk screening. It compares a conventional Framingham-style reading with a CardiacAI score that adds South Asian calibration, genomic variant signals, rPPG-derived vitals, and lifestyle factors.

The app is framed as a screening signal, not a diagnosis. Its primary demo story is the same patient receiving two different readings: low risk from a Western-cohort calculator and high risk from CardiacAI because of South-Asian-specific genomic and biometric signals.

## What the app does

- Collects standard health markers: age, sex, blood pressure, cholesterol, BMI, smoking, BP medication, and diabetes status.
- Runs a 30-second camera-based rPPG scan to estimate heart rate and HRV, with a demo mode fallback for unreliable camera or lighting conditions.
- Accepts a 23andMe-style `.txt` genome file and parses rsIDs entirely in the browser.
- Screens a focused cardiac variant lookup table inspired by AlphaMissense against genes such as `LPA`, `MYBPC3`, `LDLR`, `PCSK9`, `APOB`, `MYH7`, `SCN5A`, and `TTN`.
- Stores assessment data in browser `localStorage` and the local variant lookup table in IndexedDB.
- Calls `/api/analyse` to generate a patient-facing risk explanation with the Anthropic SDK.
- Falls back to a cached "Ramesh, 38" demo result if the analysis API is slow or unavailable.
- Shows results with score comparison, action plan, family recommendations, citations, Hindi browser TTS, and a 3D protein viewer using `3dmol`.

## User flow

```text
Landing
  -> /assess/vitals
  -> /assess/camera
  -> /assess/genome
  -> /assess/lifestyle
  -> /assess/analysing
  -> /results
```

There is also a voice assessment page at `/assess/voice`. In the current flow it is not linked from the main path; it is implemented as a visual stub with a neutral hardcoded score.

## Tech stack

- Framework: Next.js App Router, React, TypeScript
- Styling: Tailwind CSS v4, custom CSS variables, shadcn-style component setup
- Animation and UI helpers: Framer Motion, Lucide React, Base UI
- AI analysis: Anthropic SDK through `app/api/analyse/route.ts`
- 3D protein rendering: `3dmol`
- Client persistence: `localStorage` and IndexedDB
- Browser APIs: WebRTC camera access and `window.speechSynthesis`

## Project structure

```text
app/
  page.tsx                  Landing page and assessment reset
  assess/
    vitals/page.tsx         Basic health marker form
    camera/page.tsx         rPPG scan step
    genome/page.tsx         Genome upload and variant lookup step
    lifestyle/page.tsx      Lifestyle questionnaire
    analysing/page.tsx      Client-side scoring and API call
    voice/page.tsx          Voice biomarker UI stub
  api/analyse/route.ts      Anthropic-backed analysis endpoint
  results/page.tsx          Score comparison and recommendations

components/
  RPPGCamera.tsx            Camera capture and scan UI
  GenomeUpload.tsx          23andMe upload, demo genome, scan theatre
  ProteinViewer.tsx         3Dmol/AlphaFold protein visualization
  StepLayout.tsx            Shared assessment layout
  VoiceStub.tsx             Stubbed voice analysis UI

lib/
  alphamissense.ts          Focused cardiac rsID lookup table
  genome-parser.ts          23andMe text parser
  store.ts                  Assessment/result types and browser storage
  tts.ts                    Hindi/English browser speech helpers
  agent-prompt.ts           Analysis system prompt, ignored by git
  risk-calculator.ts        Framingham and CardiacAI score logic, ignored by git
  rppg-engine.ts            rPPG signal processing engine, ignored by git
  ramesh-fallback.ts        Cached demo result and Hindi TTS text, ignored by git

public/pdb/
  P08519.pdb                Local LPA protein structure
  Q14896.pdb                Local MYBPC3 protein structure
```

## Local setup

Install dependencies:

```bash
npm install
```

Create `.env.local`:

```bash
ANTHROPIC_API_KEY=your_anthropic_api_key
```

Run the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Build for production:

```bash
npm run build
npm run start
```

Run linting:

```bash
npm run lint
```

## Important local files

Several core files are intentionally ignored by git because they contain proprietary prompt, scoring, signal-processing, or demo logic:

- `lib/agent-prompt.ts`
- `lib/risk-calculator.ts`
- `lib/rppg-engine.ts`
- `lib/ramesh-fallback.ts`
- `CLAUDE.md`

The app will not build without the ignored `lib/*.ts` files listed above. Keep them available in the local workspace or provide safe replacements before deploying from a clean clone.

## Analysis model

The browser pre-computes two scores before calling the API:

- Framingham-style baseline from standard markers only.
- CardiacAI score that applies a South Asian multiplier and adds variant, HRV, voice, family history, sleep, and sitting-time modifiers.

The `/api/analyse` route sends those values plus the assessment payload to Anthropic and expects strict JSON matching `AnalysisResult` in `lib/store.ts`. If the API fails, times out, or returns invalid JSON, the app returns the cached `RAMESH_FALLBACK` result so the demo can continue.

## Privacy model

- Standard health markers, vitals, lifestyle answers, and final results are stored in browser `localStorage`.
- Genome parsing happens client-side.
- The focused variant lookup table is initialized in IndexedDB.
- The full uploaded genome file is not sent to the server by the current genome upload flow.
- Only the selected assessment payload and flagged variant identifiers are sent to `/api/analyse`.

## Demo notes

- Camera scanning uses real browser camera access when available.
- If camera access fails, `RPPGCamera` silently switches to demo mode.
- The genome step includes a built-in demo genome path that flags `LPA` and `MYBPC3`.
- The results page can read the Hindi summary through browser-native speech synthesis.
- The WhatsApp family-share section is a mock UI state, not a live integration.
- The 3D viewer tries local PDB files first and falls back to AlphaFold EBI URLs.

## Medical disclaimer

CardiacAI is a screening and education prototype. It does not diagnose disease, replace clinical judgment, or provide emergency medical advice. Any high-risk finding should be reviewed with a qualified clinician using named clinical tests and standard medical evaluation.
