import { Info } from "lucide-react";

export function Tooltip({ text }) {
  return (
    <span className="group relative ml-1 inline-block cursor-help">
      <Info className="inline h-3.5 w-3.5 text-slate-400" />
      <span className="invisible absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 rounded-md bg-slate-800 px-2 py-1 text-xs text-white opacity-0 transition group-hover:visible group-hover:opacity-100">
        {text}
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
      </span>
    </span>
  );
}
