import type { PeriodPreset, ViewMode } from "../types";

interface Props {
  preset: PeriodPreset;
  onPresetChange: (p: PeriodPreset) => void;
  viewMode: ViewMode;
  onViewModeChange: (v: ViewMode) => void;
  customStart: Date | null;
  customEnd: Date | null;
  onCustomRange: (start: Date, end: Date) => void;
}

const PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: "all", label: "Весь период" },
  { value: "day", label: "День" },
  { value: "week", label: "Неделю" },
  { value: "month", label: "Месяц" },
  { value: "year", label: "Год" },
];

export default function PeriodSelector({
  preset,
  onPresetChange,
  viewMode,
  onViewModeChange,
  customStart,
  customEnd,
  onCustomRange,
}: Props) {
  function handleDateChange(field: "start" | "end", val: string) {
    const d = val ? new Date(val) : null;
    if (field === "start" && d) onCustomRange(d, customEnd ?? new Date());
    if (field === "end" && d) onCustomRange(customStart ?? new Date(), d);
  }

  function fmt(d: Date | null) {
    if (!d) return "";
    return d.toISOString().slice(0, 10);
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      {/* Preset buttons */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-zinc-500 uppercase tracking-widest mr-1">
          Показать за:
        </span>
        {PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => onPresetChange(p.value)}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              preset === p.value && !customStart
                ? "bg-zinc-700 text-white"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom date range */}
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        <input
          type="date"
          value={fmt(customStart)}
          onChange={(e) => handleDateChange("start", e.target.value)}
          className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-zinc-500"
        />
        <span>—</span>
        <input
          type="date"
          value={fmt(customEnd)}
          onChange={(e) => handleDateChange("end", e.target.value)}
          className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-zinc-500"
        />
      </div>

      {/* View mode toggle */}
      <div className="flex items-center gap-1 ml-auto">
        <span className="text-xs text-zinc-500 uppercase tracking-widest mr-1">
          Таблица:
        </span>
        {(["days", "weeks"] as ViewMode[]).map((v) => (
          <button
            key={v}
            onClick={() => onViewModeChange(v)}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              viewMode === v
                ? "bg-zinc-700 text-white"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800"
            }`}
          >
            {v === "days" ? "По дням" : "По неделям"}
          </button>
        ))}
      </div>
    </div>
  );
}
