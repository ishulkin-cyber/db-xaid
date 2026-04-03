interface Props {
  onClose: () => void;
}

const GRADES = [
  {
    grade: "1",
    label: "Concordant",
    color: "#4ade80",
    definition:
      "Same clinical meaning. The preliminary and final reports convey the same diagnostic information, even if worded differently.",
  },
  {
    grade: "2a",
    label: "Minor Stylistic",
    color: "#60a5fa",
    definition:
      "Wording or formatting differences only. No change in clinical meaning. Examples: added counseling language, reformulated sentences, different terminology.",
  },
  {
    grade: "2b",
    label: "Minor Clinical",
    color: "#fb923c",
    definition:
      "Finding added or modified, but no management change. The clinical meaning differs slightly but would not alter patient care. Examples: different measurements, added qualifier.",
  },
  {
    grade: "3",
    label: "Significant Underreport",
    color: "#f87171",
    definition:
      "Missed finding that changes clinical management. Our report failed to identify a finding that the attending added, and this finding would change the recommendation.",
  },
  {
    grade: "4",
    label: "Significant Overreport",
    color: "#c084fc",
    definition:
      "False finding causing unnecessary workup. Our report included a finding or recommendation that was incorrect, potentially leading to unnecessary procedures.",
  },
];

const METRICS = [
  {
    name: "Concordance Rate",
    desc: "Percentage of findings graded as 1 (exact concordance). Measures how often our preliminary reports match the final report exactly in clinical meaning.",
  },
  {
    name: "Clinical Concordance Rate",
    desc: "Percentage of findings graded as 1 or 2a (concordant + minor stylistic). This is the primary quality metric — it captures all findings where clinical meaning is preserved, regardless of stylistic differences.",
  },
  {
    name: "Significant Discrepancy Rate",
    desc: "Percentage of findings graded as 3 or 4. These represent clinically meaningful differences that could affect patient management.",
  },
];

export default function MethodologyModal({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-[#141414] border border-zinc-700 rounded-xl w-full max-w-3xl max-h-[85vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div>
            <h2 className="text-lg font-semibold text-white">Methodology</h2>
            <p className="text-sm text-zinc-500 mt-0.5">
              RADPEER-Adapted Grading System for Radiology Report Quality
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors text-xl">
            ✕
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Overview */}
          <section className="bg-zinc-800/30 rounded-xl p-4 text-sm text-zinc-300 leading-relaxed">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Overview</h3>
            <p>
              This dashboard measures the quality of preliminary radiology reports by comparing them against the
              finalized reports from attending radiologists (validators). The analysis uses an adapted version of
              the <strong className="text-white">RADPEER</strong> scoring system, applied at the{" "}
              <strong className="text-white">individual finding level</strong> rather than the whole report level.
            </p>
            <p className="mt-2">
              Each radiology report is broken down into its constituent findings (e.g., pulmonary nodules, coronary
              calcification, lymphadenopathy). Each finding is then compared between our preliminary report and the
              validator's final report, and assigned a grade from 1 to 4.
            </p>
            <p className="mt-2">
              Grading is performed automatically by{" "}
              <strong className="text-white">Claude claude-sonnet-4-6</strong> using the xAID{" "}
              <code className="text-orange-300 bg-zinc-800 px-1 rounded">radpeer-grade</code> skill.
            </p>
          </section>

          {/* Grading scale */}
          <section>
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Grading Scale</h3>
            <div className="border border-zinc-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-800/50 border-b border-zinc-800">
                    <th className="px-4 py-2 text-left text-xs text-zinc-500 uppercase tracking-wider w-16">Grade</th>
                    <th className="px-4 py-2 text-left text-xs text-zinc-500 uppercase tracking-wider w-36">Label</th>
                    <th className="px-4 py-2 text-left text-xs text-zinc-500 uppercase tracking-wider">Definition</th>
                  </tr>
                </thead>
                <tbody>
                  {GRADES.map((g) => (
                    <tr key={g.grade} className="border-b border-zinc-800/50">
                      <td className="px-4 py-3">
                        <span
                          className="font-bold"
                          style={{ color: g.color }}
                        >
                          {g.grade}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-300 font-medium">{g.label}</td>
                      <td className="px-4 py-3 text-zinc-400 text-xs leading-relaxed">{g.definition}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Key metrics */}
          <section>
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Key Metrics</h3>
            <div className="space-y-3">
              {METRICS.map((m) => (
                <div key={m.name}>
                  <p className="text-sm font-semibold text-white">{m.name}</p>
                  <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{m.desc}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
