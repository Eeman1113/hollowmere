"use client";

import { useEffect, useRef } from "react";
import { VT323 } from "next/font/google";

const pixel = VT323({ weight: "400", subsets: ["latin"] });

export default function Game() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let game: { destroy: (b: boolean) => void } | null = null;
    let cancelled = false;
    (async () => {
      const family = pixel.style.fontFamily;
      try { await document.fonts.load(`20px ${family}`); } catch { /* fall back to monospace */ }
      const { startGame } = await import("@/game/main");
      if (!cancelled && ref.current) game = startGame(ref.current, family);
    })();
    return () => { cancelled = true; game?.destroy(true); };
  }, []);

  return <div ref={ref} className={pixel.className} style={{ position: "fixed", inset: 0 }} />;
}
