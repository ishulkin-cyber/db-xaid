import type { DayCell, QualityTableData } from "../types";

interface Props {
  data: QualityTableData | null;
  loading: boolean;
  selectedDoctorId: number | null;
  onDoctorSelect: (id: number | null) => void;
  onTaskClick: (taskId: number) => void;
}

function cellClass(rate: number | null | undefined): string {
  if (rate == null) return "";
  if (rate === 0) return "grade-cell-0";
  if (rate <= 0.25) return "grade-cell-low";
  if (rate <= 0.5) return "grade-cell-med";
  if (rate <= 0.75) return "grade-cell-high";
  return "grade-cell-crit";
}

function pct(r: number) {
  return Math.round(r * 100) + "%";
}

function Cell({ cell }: { cell: DayCell | null }) {
  if (!cell) return <td className="px-2 py-2 text-center text-zinc-700">—</td>;

  const cls = cellClass(cell.omission_rate);
  return (
    <td className={`px-2 py-2 text-center text-xs ${cls}`}>
      <div className="font-semibold">{pct(cell.omission_rate)}</div>
      <div className="text-zinc-500 text-[10px]">
        {cell.tasks} исслед.
      </div>
      <div className="text-[10px]">
        {cell.omissions} с пропуском
      </div>
      {cell.grade_3_count > 0 && (
        <span className="inline-block mt-0.5 px-1 rounded bg-orange-500/80 text-white text-[9px] font-bold">
          G3:{cell.grade_3_count}
        </span>
      )}
    </td>
  );
}

export default function QualityTable({
  data,
  loading,
  selectedDoctorId,
  onDoctorSelect,
  onTaskClick: _onTaskClick,
}: Props) {
  if (loading) {
    return (
      <div className="bg-[#141414] border border-zinc-800 rounded-xl p-6">
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-zinc-800 rounded" />
          ))}
        </div>
      </div>
    );
  }
  if (!data || data.doctors.length === 0) {
    return (
      <div className="bg-[#141414] border border-zinc-800 rounded-xl p-6 text-zinc-500 text-center">
        Нет данных за выбранный период
      </div>
    );
  }

  return (
    <div className="bg-[#141414] border border-zinc-800 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="sticky left-0 bg-[#141414] z-10 px-4 py-2 text-left text-xs text-zinc-500 uppercase tracking-wider w-48">
                Врач
              </th>
              <th className="px-3 py-2 text-right text-xs text-zinc-500 uppercase tracking-wider whitespace-nowrap">
                За весь период
              </th>
              {data.col_labels.map((label, i) => (
                <th
                  key={data.col_keys[i]}
                  className="px-2 py-2 text-center text-xs text-zinc-500 whitespace-nowrap min-w-[90px]"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.doctors.map((doc) => {
              const isSelected = doc.id === selectedDoctorId;
              const t = doc.total;
              return (
                <tr
                  key={doc.id}
                  className={`border-b border-zinc-800/60 cursor-pointer transition-colors ${
                    isSelected ? "bg-zinc-800/50" : "hover:bg-zinc-800/30"
                  }`}
                  onClick={() => onDoctorSelect(isSelected ? null : doc.id)}
                >
                  {/* Doctor name */}
                  <td className="sticky left-0 bg-inherit z-10 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: isSelected ? "#f97316" : "#3b82f6" }}
                      />
                      <div>
                        <div className="font-medium text-white">{doc.name}</div>
                        {isSelected && (
                          <button
                            className="text-[10px] text-zinc-500 hover:text-zinc-300 mt-0.5"
                            onClick={(e) => { e.stopPropagation(); onDoctorSelect(null); }}
                          >
                            ▼ свернуть тренд
                          </button>
                        )}
                        {!isSelected && (
                          <button className="text-[10px] text-zinc-500 hover:text-zinc-300 mt-0.5">
                            ▶ показать тренд
                          </button>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Total column */}
                  <td className="px-3 py-3 text-right">
                    <div className="text-base font-bold text-white">{t.tasks}</div>
                    <div className={`text-sm font-semibold ${cellClass(t.omission_rate)}`}>
                      {pct(t.omission_rate)}
                    </div>
                    <div className="text-[10px] text-zinc-500">{t.omissions} с пропуском</div>
                    {t.grade_3_count > 0 && (
                      <span className="inline-block px-1 rounded bg-orange-500/80 text-white text-[9px] font-bold">
                        G3:{t.grade_3_count}
                      </span>
                    )}
                  </td>

                  {/* Day cells */}
                  {data.col_keys.map((ck) => (
                    <Cell key={ck} cell={doc.days[ck] ?? null} />
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
