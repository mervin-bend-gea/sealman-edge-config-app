import { useCallback, useState } from "react";
import SealmanEasterEgg from "./SealmanEasterEgg";

export default function HalfManHalfSeal({ collapsed = false }: { collapsed?: boolean }) {
  const [playing, setPlaying] = useState(false);
  const close = useCallback(() => setPlaying(false), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setPlaying(true)}
        className={`flex w-full items-center rounded text-[10px] font-bold uppercase select-none transition-opacity hover:opacity-90 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-white/70 ${
          collapsed ? "justify-center gap-1 tracking-[0.04em]" : "justify-center gap-1.5 tracking-[0.12em]"
        }`}
        aria-label="Half man, half seal"
        title="Half Man, Half Seal"
      >
        <span className="text-slate-200">{collapsed ? "HM" : "Half Man"}</span>
        <span className="h-2 w-2 shrink-0 rounded-full border-2 border-sky-400" aria-hidden="true" />
        <span className="bg-linear-to-r from-sky-400 to-teal-400 bg-clip-text text-transparent">{collapsed ? "HS" : "Half Seal"}</span>
      </button>
      {playing && <SealmanEasterEgg onClose={close} />}
    </>
  );
}
