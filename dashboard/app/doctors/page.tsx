import Link from "next/link";
import { Suspense } from "react";
import {
  getDVFindings,
  filterFindingsByDateRange,
  getOverallStatsFromFindings,
  getDoctorStatsListFromFindings,
} from "@/lib/data";
import {
  getPeriodRange,
  shiftPeriod,
  currentRef,
  type PeriodMode,
} from "@/lib/period";
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
import { PeriodSelector } from "@/components/PeriodSelector";

// ── helpers ──────────────────────────────────────────────────────────────────

function Delta({
  curr,
  prev,
  invert = false,
}: {
  curr: number;
  prev: number;
  /** When true: lower is better (e.g. grade 3+) */
  invert?: boolean;
}) {
  const diff = curr - prev;
  if (diff === 0) return <span className="text-xs text-muted-foreground ml-1">±0</span>;
  const positive = diff > 0;
  // good = improvement; for invert=true, decrease is improvement
  const good = invert ? !positive : positive;
  return (
    <span
      className={`ml-1 text-xs font-medium ${
        good ? "text-emerald-600" : "text-red-600"
      }`}
    >
      {positive ? "▲" : "▼"}
      {Math.abs(diff)}
    </span>
  );
}

function PctDelta({
  curr,
  prev,
  invert = false,
}: {
  curr: number;
  prev: number;
  invert?: boolean;
}) {
  const diff = Math.round((curr - prev) * 10) / 10;
  if (diff === 0) return null;
  const positive = diff > 0;
  const good = invert ? !positive : positive;
  return (
    <span className={`text-xs font-medium ${good ? "text-emerald-600" : "text-red-600"}`}>
      {positive ? " ▲" : " ▼"}
      {Math.abs(diff)}%
    </span>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────

interface SearchParams {
  period?: string;
  ref?: string;
  compare?: string;
}

export default function DoctorsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const mode = ((searchParams.period ?? "month") as PeriodMode);
  const safeMode: PeriodMode = ["week", "month", "year"].includes(mode)
    ? mode
    : "month";

  const ref = searchParams.ref ?? currentRef(safeMode);
  const compareEnabled = searchParams.compare === "1";

  const range = getPeriodRange(safeMode, ref);
  const prevRef = shiftPeriod(safeMode, ref, -1);
  const prevRange = getPeriodRange(safeMode, prevRef);

  const allFindings = getDVFindings();
  const currFindings = filterFindingsByDateRange(allFindings, range.start, range.end);
  const prevFindings = compareEnabled
    ? filterFindingsByDateRange(allFindings, prevRange.start, prevRange.end)
    : null;

  const stats = getOverallStatsFromFindings(currFindings);
  const prevStats = prevFindings ? getOverallStatsFromFindings(prevFindings) : null;

  const doctors = getDoctorStatsListFromFindings(currFindings);
  const prevDoctors = prevFindings
    ? getDoctorStatsListFromFindings(prevFindings)
    : null;

  const grade3Plus = stats.grade3 + stats.grade4;
  const prevGrade3Plus = prevStats ? prevStats.grade3 + prevStats.grade4 : null;

  const g1Pct = stats.totalFindings > 0
    ? Math.round(stats.grade1 / stats.totalFindings * 1000) / 10
    : 0;
  const g2aPct = stats.totalFindings > 0
    ? Math.round(stats.grade2a / stats.totalFindings * 1000) / 10
    : 0;

  const g2bPct = stats.totalFindings > 0
    ? Math.round(stats.grade2b / stats.totalFindings * 1000) / 10
    : 0;
  const prevG2bPct = prevStats && prevStats.totalFindings > 0
    ? Math.round(prevStats.grade2b / prevStats.totalFindings * 1000) / 10
    : null;

  const grade3PlusPct = stats.totalFindings > 0
    ? Math.round(grade3Plus / stats.totalFindings * 1000) / 10
    : 0;
  const prevGrade3PlusPct = prevStats && prevStats.totalFindings > 0
    ? Math.round((prevStats.grade3 + prevStats.grade4) / prevStats.totalFindings * 1000) / 10
    : null;

  const avgClinicalConcordance =
    doctors.length > 0
      ? Math.round(
          (doctors.reduce((s, d) => s + d.clinicalConcordance, 0) / doctors.length) * 10
        ) / 10
      : 0;
  const prevAvgClinical =
    prevDoctors && prevDoctors.length > 0
      ? Math.round(
          (prevDoctors.reduce((s, d) => s + d.clinicalConcordance, 0) / prevDoctors.length) * 10
        ) / 10
      : null;

  // Map prev doctor stats by id for comparison row
  const prevDoctorMap = prevDoctors
    ? Object.fromEntries(prevDoctors.map((d) => [d.doctor_id, d]))
    : {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Врачи</h1>
          <p className="mt-1 text-muted-foreground">
            Рейтинг по клинической конкордантности (Doctor vs Validator)
          </p>
        </div>
      </div>

      {/* Period selector */}
      <Suspense>
        <PeriodSelector
          mode={safeMode}
          ref_={ref}
          label={range.label}
          compareEnabled={compareEnabled}
        />
      </Suspense>

      {/* Compare period label */}
      {compareEnabled && (
        <p className="text-sm text-muted-foreground">
          Сравнение:{" "}
          <span className="font-medium text-foreground">{range.label}</span>
          {" "} vs{" "}
          <span className="font-medium text-foreground">{prevRange.label}</span>
        </p>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Всего исследований
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {stats.totalStudies}
              {prevStats && (
                <Delta curr={stats.totalStudies} prev={prevStats.totalStudies} />
              )}
            </p>
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
            <p className="text-3xl font-bold text-blue-600">
              {avgClinicalConcordance}%
              {prevAvgClinical !== null && (
                <PctDelta curr={avgClinicalConcordance} prev={prevAvgClinical} />
              )}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              G1 {g1Pct}% + G2a {g2aPct}%
            </p>
          </CardContent>
        </Card>

        {/* Grade 2b block */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Grade 2b (мин. клин.)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-amber-600">
              {stats.grade2b}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {g2bPct}% находок
              {prevG2bPct !== null && (
                <PctDelta curr={g2bPct} prev={prevG2bPct} invert />
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Grade 3+ (значимые)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600">
              {grade3Plus}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {grade3PlusPct}% находок
              {prevGrade3PlusPct !== null && (
                <PctDelta curr={grade3PlusPct} prev={prevGrade3PlusPct} invert />
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Grade legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="font-medium text-foreground text-sm">Распределение оценок:</span>
        {[
          { color: "bg-emerald-500", label: "G1 — совпадение" },
          { color: "bg-blue-400",    label: "G2a — стилистика" },
          { color: "bg-amber-400",   label: "G2b — мин. клин." },
          { color: "bg-orange-500",  label: "G3 — значимый пропуск" },
          { color: "bg-red-500",     label: "G4 — гипердиагностика" },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={`inline-block h-3 w-3 rounded-sm ${color}`} />
            {label}
          </span>
        ))}
      </div>

      {/* Doctor Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle>
            Рейтинг врачей
            {compareEnabled && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                — в скобках динамика vs {prevRange.label}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {currFindings.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground text-sm">
              Нет данных за выбранный период
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Врач</TableHead>
                  <TableHead className="text-right">Исследования</TableHead>
                  <TableHead className="text-right">Находки</TableHead>
                  <TableHead className="text-right">Клин. конкорд. %</TableHead>
                  <TableHead className="text-right">Grade 2b</TableHead>
                  <TableHead className="text-right">Grade 3+</TableHead>
                  <TableHead>Распределение</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {doctors.map((doc, idx) => {
                  const prev = prevDoctorMap[doc.doctor_id];
                  return (
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
                      <TableCell className="text-right">
                        {doc.total_studies}
                        {prev && (
                          <Delta curr={doc.total_studies} prev={prev.total_studies} />
                        )}
                      </TableCell>
                      <TableCell className="text-right">{doc.total_findings}</TableCell>
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
                        {prev && (
                          <PctDelta
                            curr={doc.clinicalConcordance}
                            prev={prev.clinicalConcordance}
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {doc.grade2b > 0 ? (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                            {doc.grade2b}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                        {prev && prev.total_findings > 0 && (
                          <PctDelta
                            curr={Math.round(doc.grade2b / doc.total_findings * 1000) / 10}
                            prev={Math.round(prev.grade2b / prev.total_findings * 1000) / 10}
                            invert
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {doc.grade3 + doc.grade4 > 0 ? (
                          <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                            {doc.grade3 + doc.grade4}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                        {prev && prev.total_findings > 0 && (
                          <PctDelta
                            curr={Math.round((doc.grade3 + doc.grade4) / doc.total_findings * 1000) / 10}
                            prev={Math.round((prev.grade3 + prev.grade4) / prev.total_findings * 1000) / 10}
                            invert
                          />
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
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
