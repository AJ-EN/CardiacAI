export interface ParsedVariant {
  rsid: string;
  chromosome: string;
  position: string;
  genotype: string;
}

export function parse23andMe(text: string): ParsedVariant[] {
  const variants: ParsedVariant[] = [];
  // Handle CRLF exports as well as LF.
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    if (line.startsWith("#") || line.trim() === "") continue;
    // Canonical exports are tab-separated, but some builds use spaces.
    const parts = line.trim().split(/\s+/);
    if (parts.length < 4) continue;
    const [rsid, chromosome, position, genotype] = parts;
    if (!rsid.startsWith("rs")) continue;
    variants.push({
      rsid: rsid.trim(),
      chromosome: chromosome.trim(),
      position: position.trim(),
      genotype: genotype.trim().toUpperCase(),
    });
  }

  return variants;
}

/**
 * Index parsed variants by rsID, preserving the genotype call.
 *
 * The genotype is the entire point: a genome file contains a line for every
 * SNP the array *assayed*, whether or not the person carries the risk allele.
 * Matching on rsID alone therefore flags everybody.
 */
export function buildGenotypeMap(variants: ParsedVariant[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const v of variants) {
    if (!map.has(v.rsid)) map.set(v.rsid, v.genotype);
  }
  return map;
}
