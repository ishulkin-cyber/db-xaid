import Link from "next/link";
import { getDoctorStatsList, getOverallStats } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DoctorGradeBar } from "@/components/doctors/DoctorGradeBar";

export default function DoctorsPage() {
  const doctors = getDoctorStatsList();
  const stats = getOverallStats();

  const grade3Plus = stats.grade3 + stats.grade4;
  const avgClinicalConcordance =
    doctors.length > 0
      ? Math.round(
          (doctors.reduce((sum, d) => sum + d.clinicalConcordance, 0) / doctors.length) * 10
        ) / 10
      : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Врачи</h1>
        <p className="mt-1 text-muted-foreground">
          Рейтинг по клинической конкордантности (Doctor vs Validator)
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Всего исследований
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.totalStudies}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Врачей
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.totalDoctors}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Средняя клин. конкорд.
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">{avgClinicalConcordance}%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Оценки 3+ (значимые)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-600">{grade3Plus}</p>
          </CardContent>
        </Card>
      </div>

      {/* Doctor Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle>Рейтинг врачей</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Врач</TableHead>
                <TableHead className="text-right">Исследования</TableHead>
                <TableHead className="text-right">Находки</TableHead>
                <TableHead className="text-right">Конкорд. %</TableHead>
                <TableHead className="text-right">Клин. конкорд. %</TableHead>
                <TableHead className="text-right">Grade 3+</TableHead>
                <TableHead>Распределение оценок</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {doctors.map((doc, idx) => (
                <TableRow key={doc.doctor_id}>
                  <TableCell className="text-muted-foreground font-medium">
                    {idx + 1}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/doctors/${doc.doctor_id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {doc.doctor_name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">{doc.total_studies}</TableCell>
                  <TableCell className="text-right">{doc.total_findings}</TableCell>
                  <TableCell className="text-right">
                    <span
                      className={
                        doc.concordance >= 70
                          ? "text-emerald-600 font-semibold"
                          : doc.concordance >= 50
                          ? "text-amber-600 font-semibold"
                          : "text-red-600 font-semibold"
                      }
                    >
                      {doc.concordance}%
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={
                        doc.clinicalConcordance >= 80
                          ? "text-emerald-600 font-semibold"
                          : doc.clinicalConcordance >= 60
                          ? "text-amber-600 font-semibold"
                          : "text-red-600 font-semibold"
                      }
                    >
                      {doc.clinicalConcordance}%
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {doc.grade3 + doc.grade4 > 0 ? (
                      <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
                        {doc.grade3 + doc.grade4}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <DoctorGradeBar
                      grade1={doc.grade1}
                      grade2a={doc.grade2a}
                      grade2b={doc.grade2b}
                      grade3={doc.grade3}
                      grade4={doc.grade4}
                      total={doc.total_findings}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
