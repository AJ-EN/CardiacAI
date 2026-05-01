export interface ParsedVariant {
  rsid: string;
  chromosome: string;
  position: string;
  genotype: string;
}

export function parse23andMe(text: string): ParsedVariant[] {
  const variants: ParsedVariant[] = [];
  const lines = text.split("\n");

  for (const line of lines) {
    if (line.startsWith("#") || line.trim() === "") continue;
    const parts = line.split("\t");
    if (parts.length < 4) continue;
    const [rsid, chromosome, position, genotype] = parts;
    if (!rsid.startsWith("rs")) continue;
    variants.push({
      rsid: rsid.trim(),
      chromosome: chromosome.trim(),
      position: position.trim(),
      genotype: genotype.trim(),
    });
  }

  return variants;
}

export function extractRsIds(variants: ParsedVariant[]): string[] {
  return variants.map((v) => v.rsid);
}
