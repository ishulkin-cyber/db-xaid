import { getDVStudySummaries, getDoctorStatsList } from "@/lib/data";
import { DVStudyTable } from "@/components/studies/DVStudyTable";

export default function StudiesPage() {
  const summaries = getDVStudySummaries();
  const doctors = getDoctorStatsList();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Исследования</h1>
        <p className="mt-1 text-muted-foreground">
          Все исследования с анализом Doctor vs Validator ({summaries.length} всего)
        </p>
      </div>

      <DVStudyTable summaries={summaries} doctors={doctors} />
    </div>
  );
}
