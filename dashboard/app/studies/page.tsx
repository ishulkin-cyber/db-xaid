import { getDVStudySummaries, getDoctorStatsList } from "@/lib/data";

export const dynamic = "force-dynamic";
import { DVStudyTable } from "@/components/studies/DVStudyTable";

export default async function StudiesPage() {
  const [summaries, doctors] = await Promise.all([
    getDVStudySummaries(),
    getDoctorStatsList(),
  ]);

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
