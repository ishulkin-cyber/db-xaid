interface DoctorGradeBarProps {
  grade1: number;
  grade2a: number;
  grade2b: number;
  grade2bMips: number;
  grade3: number;
  grade4: number;
  grade4a: number;
  grade4b: number;
  total: number;
}

export function DoctorGradeBar({ grade1, grade2a, grade2b, grade2bMips, grade3, grade4, grade4a, grade4b, total }: DoctorGradeBarProps) {
  if (total === 0) return <div className="h-4 w-32 rounded bg-slate-100" />;

  const grade2bNonMips = Math.max(0, grade2b - grade2bMips);
  const segments = [
    { count: grade1,         color: "bg-emerald-500", label: "1" },
    { count: grade2a,        color: "bg-blue-400",    label: "2a" },
    { count: grade2bNonMips, color: "bg-amber-400",   label: "2b" },
    { count: grade2bMips,    color: "bg-amber-600",   label: "2b-MIPS" },
    { count: grade3,         color: "bg-red-500",     label: "3" },
    { count: grade4,         color: "bg-red-700",     label: "4" },
    { count: grade4a,        color: "bg-orange-400",  label: "4a" },
    { count: grade4b,        color: "bg-rose-700",    label: "4b" },
  ];

  return (
    <div
      className="flex h-4 w-32 overflow-hidden rounded"
      title={`1: ${grade1}, 2a: ${grade2a}, 2b: ${grade2bNonMips}, 2b-MIPS: ${grade2bMips}, 3: ${grade3}, 4: ${grade4}, 4a: ${grade4a}, 4b: ${grade4b}`}
    >
      {segments.map(({ count, color, label }) => {
        if (count === 0) return null;
        return (
          <div
            key={label}
            className={`${color} h-full`}
            style={{ width: `${(count / total) * 100}%` }}
            title={`Grade ${label}: ${count}`}
          />
        );
      })}
    </div>
  );
}
