import type { Tab } from "../types";

interface Props {
  tab: Tab;
  onTabChange: (t: Tab) => void;
  onMethodologyClick: () => void;
}

const LEGEND = [
  { color: "#4ade80", label: "0%" },
  { color: "#86efac", label: "≤25%" },
  { color: "#eab308", label: "≤50%" },
  { color: "#f97316", label: "≤75%" },
  { color: "#ef4444", label: ">75%" },
];

export default function Header({ tab, onTabChange, onMethodologyClick }: Props) {
  return (
    <header className="border-b border-zinc-800 bg-[#0d0d0d]">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Title + tabs */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-xl">🫁</span>
            <span className="font-semibold text-white tracking-tight">
              Качество описания КТ ОГК
            </span>
          </div>
          <nav className="flex gap-1">
            {(["quality", "workload"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => onTabChange(t)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  tab === t
                    ? "bg-zinc-700 text-white"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                }`}
              >
                {t === "quality" ? "Качество" : "Нагрузка"}
              </button>
            ))}
          </nav>
        </div>

        {/* Legend + methodology */}
        <div className="flex items-center gap-4">
          {tab === "quality" && (
            <div className="flex items-center gap-3 text-xs text-zinc-400">
              {LEGEND.map((l) => (
                <span key={l.label} className="flex items-center gap-1">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-sm"
                    style={{ background: l.color }}
                  />
                  {l.label}
                </span>
              ))}
              <span className="text-zinc-600">|</span>
              <span>% протоколов с пропуском</span>
            </div>
          )}
          <button
            onClick={onMethodologyClick}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-zinc-700 text-sm text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Методология
          </button>
        </div>
      </div>
    </header>
  );
}
