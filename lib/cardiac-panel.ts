"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Curated cardiac variant panel + genotype-aware calling.
//
// Every entry below was verified against NCBI dbSNP and ClinVar (July 2026).
// Allele frequencies are gnomAD v4. Nothing here is inferred or estimated —
// if a value could not be verified against a public database, the variant is
// not in the panel.
//
// This panel is NOT AlphaMissense. AlphaMissense predicts pathogenicity of
// missense substitutions only; it cannot score intronic variants or indels,
// which is what most of the cardiac variants of interest actually are.
//
// Risk alleles are given on the GRCh38 PLUS strand, which is the orientation
// consumer genotyping services (23andMe et al.) report. Do not compare these
// against coding-strand alleles from the literature without flipping.
// ─────────────────────────────────────────────────────────────────────────────

export type VariantClass = "pathogenic" | "risk_associated";

export interface PanelVariant {
  rsid: string;
  gene: string;
  /** Reference allele, GRCh38 plus strand. */
  refAllele: string;
  /** The allele that carries risk, GRCh38 plus strand. */
  riskAllele: string;
  class: VariantClass;
  /** Aggregate ClinVar germline classification for the risk allele specifically. */
  clinvar: string;
  /** Protein consequence; empty string for non-coding variants. */
  proteinChange: string;
  /** gnomAD v4 allele frequency as a percentage. */
  freq: { sas: number; nfe: number };
  /**
   * Heuristic triage weight, points per risk allele copy. These are NOT
   * derived effect sizes and must not be read as such — they are an ordering
   * chosen to reflect the relative magnitude reported in the literature
   * (monogenic FH >> common Lp(a)-raising variants).
   */
  pointsPerAllele: number;
  /**
   * dominant  — one copy already carries the full clinical implication
   * additive  — contribution scales with allele dosage
   */
  inheritance: "dominant" | "additive";
  plainName: string;
  citation: string;
}

export const CARDIAC_PANEL: Record<string, PanelVariant> = {
  rs121908030: {
    rsid: "rs121908030",
    gene: "LDLR",
    refAllele: "G",
    riskAllele: "A",
    class: "pathogenic",
    clinvar: "Pathogenic / Likely pathogenic",
    proteinChange: "p.Asp303Asn",
    freq: { sas: 0.0, nfe: 0.0001 },
    pointsPerAllele: 25,
    inheritance: "dominant",
    plainName: "Familial hypercholesterolemia (LDL receptor)",
    citation: "ClinVar VCV000003678 — LDLR p.Asp303Asn",
  },
  rs5742904: {
    rsid: "rs5742904",
    gene: "APOB",
    refAllele: "C",
    riskAllele: "T",
    class: "pathogenic",
    clinvar: "Pathogenic",
    proteinChange: "p.Arg3527Gln",
    freq: { sas: 0.0, nfe: 0.0495 },
    pointsPerAllele: 20,
    inheritance: "dominant",
    plainName: "Familial defective apolipoprotein B-100",
    citation: "ClinVar — APOB p.Arg3527Gln (legacy R3500Q)",
  },
  rs10455872: {
    rsid: "rs10455872",
    gene: "LPA",
    refAllele: "A",
    riskAllele: "G",
    class: "risk_associated",
    clinvar: "Benign (as a Mendelian variant)",
    proteinChange: "",
    freq: { sas: 1.01, nfe: 6.94 },
    pointsPerAllele: 10,
    inheritance: "additive",
    plainName: "Raised lipoprotein(a)",
    citation: "Clarke et al., N Engl J Med 2009;361:2518 — OR ~1.7 per copy for CAD",
  },
  rs3798220: {
    rsid: "rs3798220",
    gene: "LPA",
    refAllele: "T",
    riskAllele: "C",
    class: "risk_associated",
    clinvar: "Benign (as a Mendelian variant)",
    proteinChange: "p.Ile→Met",
    freq: { sas: 0.48, nfe: 1.75 },
    pointsPerAllele: 8,
    inheritance: "additive",
    plainName: "Raised lipoprotein(a)",
    citation: "Clarke et al., N Engl J Med 2009;361:2518",
  },
};

/**
 * Both LPA entries tag the same intermediate phenotype (plasma Lp(a)
 * concentration), so their contributions are capped rather than summed as
 * though they were independent risks.
 */
const GENE_POINT_CAP: Record<string, number> = { LPA: 20 };

/**
 * Variants that matter for this population but that a genotyping array
 * physically cannot detect. Surfacing these is the honest alternative to
 * pretending an array screen is comprehensive.
 */
export const NOT_ARRAY_DETECTABLE = [
  {
    gene: "MYBPC3",
    label: "MYBPC3 Δ25bp (c.3628-41_3628-17del25)",
    why: "A 25 base-pair intronic deletion. Genotyping arrays assay single-nucleotide substitutions at fixed positions and cannot call an indel of this size. Detection requires targeted PCR or sequencing.",
    relevance:
      "Carried by roughly 4% of South Asians and near-absent in Europeans (Dhandapany et al., Nature Genetics 2009) — the single most population-specific cardiac variant known for this group, and invisible to every consumer genome test.",
  },
  {
    gene: "LPA",
    label: "LPA KIV-2 copy-number variation",
    why: "A variable number of tandem repeats, not a point substitution. Arrays cannot count repeat copies.",
    relevance:
      "The dominant genetic determinant of plasma Lp(a). The SNPs in this panel tag only part of the signal, and they are more common in Europeans than South Asians.",
  },
];

export type Zygosity =
  | "not_assayed"
  | "no_call"
  | "non_carrier"
  | "heterozygous"
  | "homozygous";

export interface VariantCall {
  rsid: string;
  gene: string;
  /** Genotype exactly as reported by the source file, null if the SNP was absent. */
  genotype: string | null;
  zygosity: Zygosity;
  riskAlleleCount: 0 | 1 | 2;
  points: number;
  variant: PanelVariant;
}

const NO_CALL = new Set(["--", "__", "-", "", "NN", "II", "DD", "DI"]);

/**
 * Count copies of the risk allele in a genotype string such as "AG".
 * Returns null when the genotype is a no-call or an indel encoding we cannot
 * interpret against a substitution panel.
 */
function countRiskAlleles(genotype: string, riskAllele: string): 0 | 1 | 2 | null {
  const g = genotype.trim().toUpperCase();
  if (NO_CALL.has(g)) return null;
  if (!/^[ACGT]{1,2}$/.test(g)) return null;

  let n = 0;
  for (const base of g) if (base === riskAllele) n++;
  // Hemizygous calls (single character, e.g. X in males) still yield 0 or 1.
  return Math.min(n, 2) as 0 | 1 | 2;
}

function pointsFor(variant: PanelVariant, count: 0 | 1 | 2): number {
  if (count === 0) return 0;
  // For dominant conditions a single copy already carries the full clinical
  // implication. A second copy is clinically more severe, but we do not invent
  // a multiplier for it — the homozygous state is surfaced in the UI instead.
  if (variant.inheritance === "dominant") return variant.pointsPerAllele;
  return variant.pointsPerAllele * count;
}

/**
 * Call every panel variant against the genotypes parsed from the uploaded file.
 *
 * The critical distinction this makes, which rsID-presence matching cannot:
 *   not_assayed — the SNP is absent from the file; we know nothing
 *   non_carrier — the SNP was assayed and the risk allele is absent
 * Treating the first as the second is how a screen ends up reporting
 * reassurance it never earned.
 */
export function callVariants(genotypes: Map<string, string>): {
  calls: VariantCall[];
  carriers: VariantCall[];
  totalPoints: number;
  assayed: number;
  screened: number;
} {
  const calls: VariantCall[] = [];

  for (const variant of Object.values(CARDIAC_PANEL)) {
    const raw = genotypes.get(variant.rsid) ?? null;

    let zygosity: Zygosity;
    let count: 0 | 1 | 2 = 0;

    if (raw === null) {
      zygosity = "not_assayed";
    } else {
      const n = countRiskAlleles(raw, variant.riskAllele);
      if (n === null) {
        zygosity = "no_call";
      } else {
        count = n;
        zygosity = n === 0 ? "non_carrier" : n === 1 ? "heterozygous" : "homozygous";
      }
    }

    calls.push({
      rsid: variant.rsid,
      gene: variant.gene,
      genotype: raw,
      zygosity,
      riskAlleleCount: count,
      points: pointsFor(variant, count),
      variant,
    });
  }

  const carriers = calls.filter((c) => c.riskAlleleCount > 0);

  // Apply per-gene caps so correlated variants do not stack as independent risks.
  const byGene = new Map<string, number>();
  for (const c of carriers) {
    byGene.set(c.gene, (byGene.get(c.gene) ?? 0) + c.points);
  }
  let totalPoints = 0;
  for (const [gene, pts] of byGene) {
    totalPoints += Math.min(pts, GENE_POINT_CAP[gene] ?? pts);
  }

  return {
    calls,
    carriers,
    totalPoints,
    assayed: calls.filter((c) => c.zygosity !== "not_assayed").length,
    screened: genotypes.size,
  };
}

/**
 * Demo genotypes for the "Ramesh" walkthrough.
 *
 * These are illustrative genotypes at real, verified panel positions — one
 * pathogenic FH carrier call, one Lp(a) risk allele, and two genuine
 * non-carrier calls so the demo shows what a negative result looks like.
 */
export function getDemoGenotypes(): Map<string, string> {
  return new Map<string, string>([
    ["rs5742904", "CT"], // APOB p.Arg3527Gln — heterozygous carrier
    ["rs10455872", "AG"], // LPA — one copy of the Lp(a)-raising allele
    ["rs3798220", "TT"], // LPA — non-carrier
    ["rs121908030", "GG"], // LDLR — non-carrier
  ]);
}

// ── IndexedDB cache (panel is small; this mirrors the app's local-first model) ──

const DB_NAME = "cardiacai_panel";
const DB_VERSION = 1;
const STORE_NAME = "variants";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "rsid" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function initPanel(onProgress?: (pct: number) => void): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

  const entries = Object.values(CARDIAC_PANEL);
  for (let i = 0; i < entries.length; i++) {
    store.put(entries[i]);
    onProgress?.(Math.round(((i + 1) / entries.length) * 100));
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}
