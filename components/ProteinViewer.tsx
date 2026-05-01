"use client";

import { useEffect, useRef } from "react";

interface Props {
  uniprotId: string;
  residuePosition?: number;
  label?: string;
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $3Dmol: any;
  }
}

export default function ProteinViewer({ uniprotId, residuePosition, label }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<unknown>(null);

  useEffect(() => {
    if (!containerRef.current || !uniprotId) return;

    const load3Dmol = async () => {
      // Dynamically import 3Dmol
      await import("3dmol");
      const $3Dmol = window.$3Dmol;
      if (!$3Dmol) return;

      const viewer = $3Dmol.createViewer(containerRef.current!, {
        backgroundColor: "#0f1e2e",
        antialias: true,
      });
      viewerRef.current = viewer;

      try {
        // Fetch AlphaFold PDB from local public/pdb or fallback to AF API
        const localUrl = `/pdb/${uniprotId}.pdb`;
        const response = await fetch(localUrl);
        let pdbData: string;

        if (response.ok) {
          pdbData = await response.text();
        } else {
          // Fallback: fetch from AlphaFold EBI (may be slow, for non-demo paths)
          const afResponse = await fetch(
            `https://alphafold.ebi.ac.uk/files/AF-${uniprotId}-F1-model_v6.pdb`
          );
          pdbData = await afResponse.text();
        }

        viewer.addModel(pdbData, "pdb");
        viewer.setStyle({}, { cartoon: { color: "spectrum" } });

        // Highlight mutation residue in red
        if (residuePosition) {
          viewer.setStyle(
            { resi: residuePosition },
            { sphere: { color: "#c0392b", radius: 1.2 } }
          );
        }

        viewer.zoomTo();
        viewer.render();

        // Auto-rotate
        let angle = 0;
        const rotate = setInterval(() => {
          angle += 0.5;
          viewer.rotate(0.5, "y");
          viewer.render();
          if (angle > 3600) clearInterval(rotate);
        }, 30);
      } catch {
        // 3D viewer is gravy — fail silently
        if (containerRef.current) {
          containerRef.current.innerHTML =
            '<div class="flex items-center justify-center h-full text-white/40 text-sm">3D viewer unavailable offline</div>';
        }
      }
    };

    load3Dmol();
  }, [uniprotId, residuePosition]);

  if (!uniprotId) return null;

  return (
    <div className="rounded-xl overflow-hidden border border-[var(--navy-mid)]">
      <div className="bg-[var(--navy-bg)] px-4 py-2 flex items-center justify-between">
        <span className="font-(family-name:--font-jetbrains) text-xs text-[var(--navy-mid)] uppercase tracking-wider">
          AlphaFold · {label ?? uniprotId}
        </span>
        {residuePosition && (
          <span className="font-(family-name:--font-jetbrains) text-xs text-[var(--risk-mid)]">
            residue {residuePosition} <span className="text-[var(--risk)]">●</span>
          </span>
        )}
      </div>
      <div ref={containerRef} className="w-full h-64 bg-[var(--navy-bg)]" />
    </div>
  );
}
