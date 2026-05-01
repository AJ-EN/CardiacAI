"use client";

import { useEffect, useRef, useState } from "react";

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewerRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !uniprotId) return;

    let mounted = true;
    let resizeHandler: (() => void) | null = null;

    const init = async () => {
      try {
        await import("3dmol");
        const $3Dmol = window.$3Dmol;
        if (!$3Dmol || !mounted || !containerRef.current) return;

        // Wait for layout — 3Dmol needs measured dimensions
        await new Promise((r) => requestAnimationFrame(r));
        if (!mounted || !containerRef.current) return;

        const viewer = $3Dmol.createViewer(containerRef.current, {
          backgroundColor: "#070d18",
          antialias: true,
        });
        viewerRef.current = viewer;

        // Fetch PDB — local first, fallback to AlphaFold EBI
        const localUrl = `/pdb/${uniprotId}.pdb`;
        const response = await fetch(localUrl);
        let pdbData: string;

        if (response.ok) {
          pdbData = await response.text();
        } else {
          const afResponse = await fetch(
            `https://alphafold.ebi.ac.uk/files/AF-${uniprotId}-F1-model_v6.pdb`
          );
          pdbData = await afResponse.text();
        }

        if (!mounted) return;

        viewer.addModel(pdbData, "pdb");

        // DeepMind-style cartoon — smooth, spectrum coloring (mimics pLDDT)
        viewer.setStyle({}, {
          cartoon: { color: "spectrum", thickness: 0.5, opacity: 0.95 },
        });

        // Mutation site — bold red sphere with translucent halo
        if (residuePosition) {
          viewer.addStyle(
            { resi: residuePosition },
            { sphere: { color: "#c0392b", radius: 2.4, opacity: 0.25 } }
          );
          viewer.addStyle(
            { resi: residuePosition },
            { sphere: { color: "#ff3b30", radius: 1.3, opacity: 1 } }
          );
        }

        viewer.zoomTo();
        viewer.render();
        viewer.zoom(1.15, 600);
        viewer.spin("y", 0.4);

        if (mounted) setLoading(false);

        // Keep canvas sized to container
        resizeHandler = () => {
          try {
            viewer.resize();
            viewer.render();
          } catch {}
        };
        window.addEventListener("resize", resizeHandler);
      } catch (e) {
        console.error("ProteinViewer error:", e);
        if (mounted) {
          setError(true);
          setLoading(false);
        }
      }
    };

    init();

    return () => {
      mounted = false;
      if (resizeHandler) window.removeEventListener("resize", resizeHandler);
      if (viewerRef.current) {
        try {
          viewerRef.current.spin(false);
          viewerRef.current.removeAllModels();
          viewerRef.current.removeAllLabels();
        } catch {}
        viewerRef.current = null;
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [uniprotId, residuePosition]);

  if (!uniprotId) return null;

  return (
    <div className="rounded-2xl overflow-hidden border border-white/5 shadow-2xl shadow-black/50 bg-[#070d18]">
      {/* Header — DeepMind-style: minimal, monospace, lots of whitespace */}
      <div className="px-5 py-3 flex items-center justify-between border-b border-white/5 bg-gradient-to-b from-[#0a1422] to-[#070d18]">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgb(52,211,153)]" />
          <span className="font-(family-name:--font-jetbrains) text-[10px] text-white/40 uppercase tracking-[3px]">
            AlphaFold
          </span>
          <span className="text-white/15">/</span>
          <span className="font-(family-name:--font-jetbrains) text-xs text-white/80">
            {label ?? uniprotId}
          </span>
        </div>
        {residuePosition !== undefined && residuePosition > 0 && (
          <div className="flex items-center gap-2">
            <span className="font-(family-name:--font-jetbrains) text-[10px] text-white/40 uppercase tracking-[2px]">
              mutation site
            </span>
            <span className="w-2 h-2 rounded-full bg-[#ff3b30] animate-pulse shadow-[0_0_10px_#ff3b30]" />
            <span className="font-(family-name:--font-jetbrains) text-xs text-[#ff8a82]">
              residue {residuePosition}
            </span>
          </div>
        )}
      </div>

      {/* Viewer — position: relative is critical so 3Dmol's absolutely-positioned
          canvas stays inside this box and doesn't leak to the document root */}
      <div
        className="relative w-full h-[420px] bg-[#070d18]"
        style={{ position: "relative", overflow: "hidden" }}
      >
        {/* The actual 3Dmol canvas mount point */}
        <div
          ref={containerRef}
          className="absolute inset-0"
          style={{ position: "absolute", inset: 0 }}
        />

        {/* Subtle radial vignette for depth — DeepMind always has this */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.4) 100%)",
          }}
        />

        {/* Grid overlay — barely visible, scientific feel */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Loading state */}
        {loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="text-center">
              <div className="relative w-12 h-12 mx-auto">
                <div className="absolute inset-0 border-2 border-white/5 rounded-full" />
                <div className="absolute inset-0 border-2 border-transparent border-t-emerald-400 rounded-full animate-spin" />
              </div>
              <p className="text-white/40 text-[10px] mt-4 font-(family-name:--font-jetbrains) uppercase tracking-[3px]">
                Folding structure
              </p>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center text-white/40 text-sm z-10">
            3D structure unavailable
          </div>
        )}

        {/* Bottom-left metadata — DeepMind credit style */}
        <div className="pointer-events-none absolute bottom-3 left-4 font-(family-name:--font-jetbrains) text-[9px] text-white/30 uppercase tracking-[2.5px] flex items-center gap-2">
          <span>AF-{uniprotId}</span>
          <span className="text-white/15">·</span>
          <span>pLDDT spectrum</span>
        </div>

        {/* Bottom-right hint */}
        <div className="pointer-events-none absolute bottom-3 right-4 font-(family-name:--font-jetbrains) text-[9px] text-white/30 uppercase tracking-[2.5px]">
          auto-rotate
        </div>
      </div>
    </div>
  );
}
