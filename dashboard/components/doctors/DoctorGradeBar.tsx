interface DoctorGradeBarProps {
  grade1: number;
  grade2a: number;
  grade2b: number;
  grade3: number;
  grade4: number;
  total: number;
}

const segments = [
  { key: "grade1" as const, color: "bg-emerald-500", label: "1" },
  { key: "grade2a" as const, color: "bg-blue-400", label: "2a" },
  { key: "grade2b" as const, color: "bg-amber-400", label: "2b" },
  { key: "grade3" as const, color: "bg-orange-500", label: "3" },
  { key: "grade4" as const, color: "bg-red-500", label: "4" },
];

export function DoctorGradeBar({ grade1, grade2a, grade2b, grade3, grade4, total }: DoctorGradeBarProps) {
  if (total === 0) return <div className="h-4 w-32 rounded bg-slate-100" />;

  const values = { grade1, grade2a, grade2b, grade3, grade4 };

  return (
    <div className="flex h-4 w-32 overflow-hidden rounded" title={`Grade 1: ${grade1}, 2a: ${grade2a}, 2b: ${grade2b}, 3: ${grade3}, 4: ${grade4}`}>
      {segments.map(({ key, color, label }) => {
        const count = values[key];
        if (count === 0) return null;
        const widthPct = (count / total) * 100;
        return (
          <div
            key={label}
            className={`${color} h-full`}
            style={{ width: `${widthPct}%` }}
            title={`Grade ${label}: ${count}`}
          />
        );
      })}
    </div>
  );
}
