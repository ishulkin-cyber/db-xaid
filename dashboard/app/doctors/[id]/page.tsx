import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getDoctorById,
  getDoctorFindings,
  getDoctorStudies,
  getDoctorTrendByDate,
  getGradeDistribution,
  getAllDoctorIds,
  getDoctorRecurringPatterns,
} from "@/lib/data";
import { gradeColors } from "@/lib/colors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GradeBadge } from "@/components/studies/GradeBadge";
import { GradeDistributionChart } from "@/components/doctors/GradeDistributionChart";
import { TopCategoriesChart } from "@/components/doctors/TopCategoriesChart";
import type { Grade } from "@/lib/types";

export async function generateStaticParams() {
  return getAllDoctorIds().map((id) => ({ id: String(id) }));
}

interface DoctorDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function DoctorDetailPage({ params }: DoctorDetailPageProps) {
  const { id } = await params;
  const doctorId = Number(id);
  const doctor = getDoctorById(doctorId);

  if (!doctor) notFound();

  const findings = getDoctorFindings(doctorId);
  const gradeData = getGradeDistribution(findings);
  const studies = getDoctorStudies(doctorId);
  const trend = getDoctorTrendByDate(doctorId);
  const patterns = getDoctorRecurringPatterns(doctorId);

  const grades: Grade[] = ["1", "2a", "2b", "3", "4"];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Link
          href="/doctors"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Все врачи
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{doctor.doctor_name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {grades.map((g) => {
            const count = gradeData.find((d) => d.grade === g)?.count ?? 0;
            if (count === 0) return null;
            const colors = gradeColors[g];
            return (
              <Badge key={g} className={colors.badge}>
                Grade {g}: {count}
              </Badge>
            );
          })}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Исследований</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{doctor.total_studies}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Конкордантность</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{doctor.concordance}%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Клин. конкорд.</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">{doctor.clinicalConcordance}%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Grade 3+ (значимые)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-600">{doctor.grade3 + doctor.grade4}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Распределение оценок</CardTitle>
          </CardHeader>
          <CardContent>
            <GradeDistributionChart data={gradeData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Топ категорий расхождений</CardTitle>
          </CardHeader>
          <CardContent>
            <TopCategoriesChart data={doctor.topCategories} />
          </CardContent>
        </Card>
      </div>

      {/* Trend chart (only if data available) */}
      {trend.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Динамика по датам</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Клин. конкордантность по датам экзаменов: {trend.map((t) => `${t.date} (${t.clinicalConcordance}%)`).join(", ")}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Study list */}
      <Card>
        <CardHeader>
          <CardTitle>Исследования ({studies.length})</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Номер</TableHead>
                <TableHead>Общая оценка</TableHead>
                <TableHead className="text-right">Находки</TableHead>
                <TableHead className="text-right">Расхождения</TableHead>
                <TableHead>Ключевые расхождения</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {studies.map((study) => (
                <TableRow key={study.accession_number}>
                  <TableCell>
                    <Link
                      href={`/studies/${study.accession_number}`}
                      className="font-mono text-sm text-blue-600 hover:underline"
                    >
                      {study.accession_number}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <GradeBadge grade={study.overall_grade} />
                  </TableCell>
                  <TableCell className="text-right">{study.total_findings}</TableCell>
                  <TableCell className="text-right">{study.discrepancy_count}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {study.key_discrepancies.join(", ") || "\u2014"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recurring patterns */}
      {(patterns.g3Patterns.length > 0 || patterns.mipsPatterns.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Повторяющиеся паттерны</CardTitle>
            <p className="text-sm text-muted-foreground">
              Категории где врач системно допускает ошибки (по всем исследованиям)
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {patterns.g3Patterns.length > 0 && (
              <div>
                <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
                  Значимые пропуски G3+ по категориям
                </p>
                <div className="space-y-2">
                  {patterns.g3Patterns.map(({ category, count, discrepancyType }) => (
                    <div key={category} className="flex items-center justify-between rounded-lg border px-3 py-2">
                      <div>
                        <p className="text-sm font-medium">{category}</p>
                        <p className="text-xs text-muted-foreground capitalize">{discrepancyType}</p>
                      </div>
                      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                        {count} раз
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {patterns.mipsPatterns.length > 0 && (
              <div>
                <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-amber-700" />
                  MIPS-нарушения по мерам
                </p>
                <div className="space-y-2">
                  {patterns.mipsPatterns.map(({ measure, label, count }) => (
                    <div key={measure} className="flex items-center justify-between rounded-lg border px-3 py-2">
                      <div>
                        <p className="text-sm font-medium">{label}</p>
                        <p className="text-xs font-mono text-muted-foreground">{measure}</p>
                      </div>
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                        {count} раз
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
