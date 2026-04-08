interface DoctorGradeBarProps {
  grade1: number;
  grade2a: number;
  grade2b: number; // total grade2b (includes grade2bMips)
  grade2bMips: number;
  grade3: number;
  grade4: number;
  total: number;
}

export function DoctorGradeBar({ grade1, grade2a, grade2b, grade2bMips, grade3, grade4, total }: DoctorGradeBarProps) {
  if (total === 0) return <div className="h-4 w-32 rounded bg-slate-100" />;

  const grade2bNonMips = Math.max(0, grade2b - grade2bMips);
  const segments = [
    { count: grade1,        color: "bg-emerald-500", label: "1" },
    { count: grade2a,       color: "bg-blue-400",    label: "2a" },
    { count: grade2bNonMips,color: "bg-amber-400",   label: "2b" },
    { count: grade2bMips,   color: "bg-amber-600",   label: "2b-MIPS" },
    { count: grade3,        color: "bg-red-500",     label: "3" },
    { count: grade4,        color: "bg-red-500",     label: "4" },
  ];

  return (
    <div
      className="flex h-4 w-32 overflow-hidden rounded"
      title={`Grade 1: ${grade1}, 2a: ${grade2a}, 2b: ${grade2bNonMips}, 2b-MIPS: ${grade2bMips}, 3: ${grade3}, 4: ${grade4}`}
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
