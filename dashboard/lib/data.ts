import { cache } from "react";
import { parseISO, getISOWeek, getYear } from "date-fns";
import type {
  DVFinding,
  DoctorValidatorPair,
  DVStudySummary,
  DoctorStats,
  TrendDataPoint,
  Grade,
  MIPSStat,
  DoctorMIPSStat,
  CombinedQAStats,
  ReporterStats,
  FinalizerStats,
  DoctorMissReport,
} from "./types";
import { pct } from "./utils";
import { readRepoJSON } from "./git-data";

// --- MIPS types ---

type ClassifiedFinding = DVFinding & { mips_related: boolean; mips_measure: string | null };

// --- Raw data loaders (cached per request via React cache()) ---

// Reads findings from GitLab, joins exam_date, and maps mips_driven → mips_related
export const getDVFindings = cache(async (): Promise<DVFinding[]> => {
  const [raw, excel] = await Promise.all([
    readRepoJSON<Omit<DVFinding, "exam_date">[]>("dv_combined_analysis.json"),
    readRepoJSON<Record<string, { sheet_date?: string }>>("excel_reports.json"),
  ]);
  return raw.map((f) => ({
    ...f,
    exam_date: excel[f.accession_number]?.sheet_date ?? null,
    mips_related: (f as DVFinding).mips_driven ?? false,
  } as DVFinding));
});

export const getDoctorValidatorPairs = cache(
  (): Promise<DoctorValidatorPair[]> =>
    readRepoJSON<DoctorValidatorPair[]>("doctor_validator_pairs.json")
);

// Returns all grade-2b findings with mips_related/mips_measure sourced directly from JSON
export const getMIPSClassifiedFindings = cache(async (): Promise<ClassifiedFinding[]> => {
  const findings = await getDVFindings();
  return findings
    .filter((f) => f.grade === "2b")
    .map((f) => ({
      ...f,
      mips_related: f.mips_related ?? false,
      mips_measure: f.mips_measure ?? null,
    }));
});

// --- Period filtering (sync, pure) ---

export function filterFindingsByDateRange(
  findings: DVFinding[],
  start: string,
  end: string
): DVFinding[] {
  return findings.filter(
    (f) => f.exam_date == null || (f.exam_date >= start && f.exam_date <= end)
  );
}

// --- Stats from pre-filtered findings (sync, pure) ---

export function getOverallStatsFromFindings(findings: DVFinding[]) {
  const total = findings.length;
  const grade1  = findings.filter((f) => f.grade === "1").length;
  const grade2a = findings.filter((f) => f.grade === "2a").length;
  const grade2b = findings.filter((f) => f.grade === "2b").length;
  const grade3  = findings.filter((f) => f.grade === "3").length;
  const grade4  = findings.filter((f) => f.grade === "4").length;
  const grade4a = findings.filter((f) => f.grade === "4a").length;
  const grade4b = findings.filter((f) => f.grade === "4b").length;
  const totalStudies = new Set(findings.map((f) => f.accession_number)).size;
  const totalDoctors = new Set(findings.map((f) => f.doctor_id)).size;
  return {
    totalStudies, totalDoctors, totalFindings: total,
    grade1, grade2a, grade2b, grade3, grade4, grade4a, grade4b,
    concordance: pct(grade1, total),
    clinicalConcordance: pct(grade1 + grade2a, total),
    significantRate: pct(grade3 + grade4 + grade4b, total),
  };
}

export function getDoctorStatsListFromFindings(findings: DVFinding[]): DoctorStats[] {
  const doctorIds = [...new Set(findings.map((f) => f.doctor_id))];
  return doctorIds
    .map((id) => {
      const df = findings.filter((f) => f.doctor_id === id);
      const doctorName = df[0]?.doctor_name ?? String(id);
      const accessions = [...new Set(df.map((f) => f.accession_number))];
      const total = df.length;
      const g1  = df.filter((f) => f.grade === "1").length;
      const g2a = df.filter((f) => f.grade === "2a").length;
      const g2b = df.filter((f) => f.grade === "2b").length;
      const g3  = df.filter((f) => f.grade === "3").length;
      const g4  = df.filter((f) => f.grade === "4").length;
      const g4a = df.filter((f) => f.grade === "4a").length;
      const g4b = df.filter((f) => f.grade === "4b").length;
      const catCounts: Record<string, number> = {};
      for (const f of df.filter((f) => f.grade !== "1")) {
        catCounts[f.finding_category] = (catCounts[f.finding_category] ?? 0) + 1;
      }
      const topCategories = Object.entries(catCounts)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      return {
        doctor_id: id, doctor_name: doctorName,
        total_studies: accessions.length, total_findings: total,
        grade1: g1, grade2a: g2a, grade2b: g2b, grade3: g3, grade4: g4, grade4a: g4a, grade4b: g4b,
        concordance: pct(g1, total),
        clinicalConcordance: pct(g1 + g2a, total),
        significantRate: pct(g3 + g4 + g4b, total),
        topCategories,
      } satisfies DoctorStats;
    })
    .sort((a, b) => b.clinicalConcordance - a.clinicalConcordance);
}

// --- Grade distribution (sync, requires findings) ---

export function getGradeDistribution(
  findings: DVFinding[]
): { grade: Grade; count: number; label: string }[] {
  const grades: { grade: Grade; label: string }[] = [
    { grade: "1",  label: "Concordant" },
    { grade: "2a", label: "Minor Stylistic" },
    { grade: "2b", label: "Minor Clinical" },
    { grade: "3",  label: "Significant Underreport" },
    { grade: "4",  label: "Significant Overreport (legacy)" },
    { grade: "4a", label: "Minor Overreport" },
    { grade: "4b", label: "Significant Overreport" },
  ];
  return grades.map(({ grade, label }) => ({
    grade,
    count: findings.filter((f) => f.grade === grade).length,
    label,
  }));
}

// --- Overall stats ---

export async function getOverallStats() {
  const findings = await getDVFindings();
  const total = findings.length;
  const grade1  = findings.filter((f) => f.grade === "1").length;
  const grade2a = findings.filter((f) => f.grade === "2a").length;
  const grade2b = findings.filter((f) => f.grade === "2b").length;
  const grade3  = findings.filter((f) => f.grade === "3").length;
  const grade4  = findings.filter((f) => f.grade === "4").length;
  const grade4a = findings.filter((f) => f.grade === "4a").length;
  const grade4b = findings.filter((f) => f.grade === "4b").length;
  const totalStudies = new Set(findings.map((f) => f.accession_number)).size;
  const totalDoctors = new Set(findings.map((f) => f.doctor_id)).size;
  return {
    totalStudies, totalDoctors, totalFindings: total,
    grade1, grade2a, grade2b, grade3, grade4, grade4a, grade4b,
    concordance: pct(grade1, total),
    clinicalConcordance: pct(grade1 + grade2a, total),
    significantRate: pct(grade3 + grade4 + grade4b, total),
  };
}

// --- Doctor stats list (leaderboard) ---

export async function getDoctorStatsList(): Promise<DoctorStats[]> {
  const findings = await getDVFindings();
  const doctorIds = [...new Set(findings.map((f) => f.doctor_id))];
  return doctorIds
    .map((id) => {
      const doctorFindings = findings.filter((f) => f.doctor_id === id);
      const doctorName = doctorFindings[0]?.doctor_name ?? String(id);
      const accessions = [...new Set(doctorFindings.map((f) => f.accession_number))];
      const total = doctorFindings.length;
      const g1  = doctorFindings.filter((f) => f.grade === "1").length;
      const g2a = doctorFindings.filter((f) => f.grade === "2a").length;
      const g2b = doctorFindings.filter((f) => f.grade === "2b").length;
      const g3  = doctorFindings.filter((f) => f.grade === "3").length;
      const g4  = doctorFindings.filter((f) => f.grade === "4").length;
      const g4a = doctorFindings.filter((f) => f.grade === "4a").length;
      const g4b = doctorFindings.filter((f) => f.grade === "4b").length;
      const errorFindings = doctorFindings.filter((f) => f.grade !== "1");
      const catCounts: Record<string, number> = {};
      for (const f of errorFindings) {
        catCounts[f.finding_category] = (catCounts[f.finding_category] ?? 0) + 1;
      }
      const topCategories = Object.entries(catCounts)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      return {
        doctor_id: id, doctor_name: doctorName,
        total_studies: accessions.length, total_findings: total,
        grade1: g1, grade2a: g2a, grade2b: g2b, grade3: g3, grade4: g4, grade4a: g4a, grade4b: g4b,
        concordance: pct(g1, total),
        clinicalConcordance: pct(g1 + g2a, total),
        significantRate: pct(g3 + g4 + g4b, total),
        topCategories,
      } satisfies DoctorStats;
    })
    .sort((a, b) => b.clinicalConcordance - a.clinicalConcordance);
}

// --- Doctor by ID ---

export async function getDoctorById(id: number): Promise<DoctorStats | undefined> {
  return (await getDoctorStatsList()).find((d) => d.doctor_id === id);
}

// --- Doctor findings ---

export async function getDoctorFindings(doctorId: number): Promise<DVFinding[]> {
  return (await getDVFindings()).filter((f) => f.doctor_id === doctorId);
}

// --- Doctor studies list ---

export async function getDoctorStudies(doctorId: number): Promise<DVStudySummary[]> {
  const [findings, classified] = await Promise.all([
    getDoctorFindings(doctorId),
    getMIPSClassifiedFindings(),
  ]);
  const mipsAccMap = new Map<string, number>();
  for (const cf of classified) {
    if (cf.mips_related) {
      mipsAccMap.set(cf.accession_number, (mipsAccMap.get(cf.accession_number) ?? 0) + 1);
    }
  }
  const accessions = [...new Set(findings.map((f) => f.accession_number))];
  return accessions.map((acc) => {
    const accFindings = findings.filter((f) => f.accession_number === acc);
    const doctorName = accFindings[0]?.doctor_name ?? "";
    const total = accFindings.length;
    const g1  = accFindings.filter((f) => f.grade === "1").length;
    const g2a = accFindings.filter((f) => f.grade === "2a").length;
    const g2b = accFindings.filter((f) => f.grade === "2b").length;
    const g3  = accFindings.filter((f) => f.grade === "3").length;
    const g4  = accFindings.filter((f) => f.grade === "4").length;
    const g4a = accFindings.filter((f) => f.grade === "4a").length;
    const g4b = accFindings.filter((f) => f.grade === "4b").length;
    const discrepancies = accFindings.filter((f) => f.grade !== "1").length;
    const mips2b = mipsAccMap.get(acc) ?? 0;
    let overallGrade: Grade | "N/A" = "N/A";
    if (g4b > 0 || g4 > 0) overallGrade = "4b";
    else if (g3 > 0) overallGrade = "3";
    else if (g4a > 0) overallGrade = "4a";
    else if (g2b > 0) overallGrade = "2b";
    else if (g2a > 0) overallGrade = "2a";
    else if (g1 > 0) overallGrade = "1";
    const keyDiscrepancies = accFindings
      .filter((f) => f.grade === "3" || f.grade === "4" || f.grade === "4b")
      .map((f) => f.finding_category)
      .slice(0, 3);
    return {
      accession_number: acc, doctor_name: doctorName, doctor_id: doctorId,
      overall_grade: overallGrade, total_findings: total,
      concordant_count: g1, stylistic_count: g2a, minor_clinical_count: g2b,
      significant_underreport_count: g3, significant_overreport_count: g4 + g4b,
      minor_overreport_count: g4a,
      discrepancy_count: discrepancies, mips2b_count: mips2b,
      key_discrepancies: keyDiscrepancies,
    } satisfies DVStudySummary;
  });
}

// --- Doctor trend by date ---

export async function getDoctorTrendByDate(doctorId: number): Promise<TrendDataPoint[]> {
  const findings = await getDoctorFindings(doctorId);
  const findingsWithDate = findings.filter((f) => f.exam_date);
  if (findingsWithDate.length === 0) return [];
  const dates = [...new Set(findingsWithDate.map((f) => f.exam_date as string))].sort();
  return dates.map((date) => {
    const dayFindings = findingsWithDate.filter((f) => f.exam_date === date);
    const total = dayFindings.length;
    const g1  = dayFindings.filter((f) => f.grade === "1").length;
    const g2a = dayFindings.filter((f) => f.grade === "2a").length;
    const g2b = dayFindings.filter((f) => f.grade === "2b").length;
    const g3  = dayFindings.filter((f) => f.grade === "3").length;
    const g4  = dayFindings.filter((f) => f.grade === "4").length;
    const g4a = dayFindings.filter((f) => f.grade === "4a").length;
    const g4b = dayFindings.filter((f) => f.grade === "4b").length;
    return {
      date,
      concordance: pct(g1, total),
      clinicalConcordance: pct(g1 + g2a, total),
      totalFindings: total,
      grade1: g1, grade2a: g2a, grade2b: g2b, grade3: g3, grade4: g4, grade4a: g4a, grade4b: g4b,
    };
  });
}

// --- All study summaries ---

export async function getDVStudySummaries(): Promise<DVStudySummary[]> {
  const [findings, classified] = await Promise.all([
    getDVFindings(),
    getMIPSClassifiedFindings(),
  ]);
  const mipsAccMap = new Map<string, number>();
  for (const cf of classified) {
    if (cf.mips_related) {
      mipsAccMap.set(cf.accession_number, (mipsAccMap.get(cf.accession_number) ?? 0) + 1);
    }
  }
  const accessions = [...new Set(findings.map((f) => f.accession_number))];
  return accessions.map((acc) => {
    const accFindings = findings.filter((f) => f.accession_number === acc);
    const doctorName = accFindings[0]?.doctor_name ?? "";
    const doctorId = accFindings[0]?.doctor_id ?? 0;
    const total = accFindings.length;
    const g1  = accFindings.filter((f) => f.grade === "1").length;
    const g2a = accFindings.filter((f) => f.grade === "2a").length;
    const g2b = accFindings.filter((f) => f.grade === "2b").length;
    const g3  = accFindings.filter((f) => f.grade === "3").length;
    const g4  = accFindings.filter((f) => f.grade === "4").length;
    const g4a = accFindings.filter((f) => f.grade === "4a").length;
    const g4b = accFindings.filter((f) => f.grade === "4b").length;
    const discrepancies = accFindings.filter((f) => f.grade !== "1").length;
    const mips2b = mipsAccMap.get(acc) ?? 0;
    let overallGrade: Grade | "N/A" = "N/A";
    if (g4b > 0 || g4 > 0) overallGrade = "4b";
    else if (g3 > 0) overallGrade = "3";
    else if (g4a > 0) overallGrade = "4a";
    else if (g2b > 0) overallGrade = "2b";
    else if (g2a > 0) overallGrade = "2a";
    else if (g1 > 0) overallGrade = "1";
    const keyDiscrepancies = accFindings
      .filter((f) => f.grade === "3" || f.grade === "4" || f.grade === "4b")
      .map((f) => f.finding_category)
      .slice(0, 3);
    return {
      accession_number: acc, doctor_name: doctorName, doctor_id: doctorId,
      overall_grade: overallGrade, total_findings: total,
      concordant_count: g1, stylistic_count: g2a, minor_clinical_count: g2b,
      significant_underreport_count: g3, significant_overreport_count: g4 + g4b,
      minor_overreport_count: g4a,
      discrepancy_count: discrepancies, mips2b_count: mips2b,
      key_discrepancies: keyDiscrepancies,
    } satisfies DVStudySummary;
  });
}

// --- Study detail ---

export async function getStudyDetail(accession: string) {
  const [findings, pairs, summaries] = await Promise.all([
    getDVFindings(),
    getDoctorValidatorPairs(),
    getDVStudySummaries(),
  ]);
  const accFindings = findings.filter((f) => f.accession_number === accession);
  return {
    findings: accFindings,
    pair: pairs.find((p) => p.accession_number === accession),
    summary: summaries.find((s) => s.accession_number === accession),
  };
}

// --- Static params helpers ---

export async function getAllAccessions(): Promise<string[]> {
  const findings = await getDVFindings();
  return [...new Set(findings.map((f) => f.accession_number))];
}

export async function getAllDoctorIds(): Promise<number[]> {
  const findings = await getDVFindings();
  return [...new Set(findings.map((f) => f.doctor_id))];
}

// --- Category stats ---

export async function getCategoryStats() {
  const findings = await getDVFindings();
  const categories = [...new Set(findings.map((f) => f.finding_category))];
  return categories
    .map((cat) => {
      const catFindings = findings.filter((f) => f.finding_category === cat);
      const total = catFindings.length;
      const discrepancies = catFindings.filter((f) => f.grade !== "1").length;
      return { category: cat, total, discrepancies, discrepancyRate: pct(discrepancies, total) };
    })
    .sort((a, b) => b.discrepancies - a.discrepancies)
    .slice(0, 10);
}

// --- Svod: category detailed stats ---

export interface CategoryDetailedStat {
  category: string;
  total: number;
  g2bPct: number;
  g3PlusPct: number;
}

export async function getCategoryDetailedStats(): Promise<CategoryDetailedStat[]> {
  const source = await getDVFindings();
  const cats = [...new Set(source.map((f) => f.finding_category))];
  return cats
    .map((cat) => {
      const cf = source.filter((f) => f.finding_category === cat);
      const total = cf.length;
      const g2b = cf.filter((f) => f.grade === "2b").length;
      const g3  = cf.filter((f) => f.grade === "3").length;
      const g4  = cf.filter((f) => f.grade === "4").length;
      const g4b = cf.filter((f) => f.grade === "4b").length;
      return { category: cat, total, g2bPct: pct(g2b, total), g3PlusPct: pct(g3 + g4 + g4b, total) };
    })
    .sort((a, b) => b.g3PlusPct - a.g3PlusPct);
}

// --- Svod: grade trend over time ---

const MONTHS_SHORT_RU = ["Янв","Фев","Мар","Апр","Май","Июн","Июл","Авг","Сен","Окт","Ноя","Дек"];

function toPeriodKey(examDate: string, mode: "week" | "month" | "year"): string {
  if (mode === "year")  return examDate.slice(0, 4);
  if (mode === "month") return examDate.slice(0, 7);
  const d = parseISO(examDate);
  return `${getYear(d)}-W${String(getISOWeek(d)).padStart(2, "0")}`;
}

function toPeriodLabel(key: string, mode: "week" | "month" | "year"): string {
  if (mode === "year") return key;
  if (mode === "month") {
    const [year, month] = key.split("-");
    return `${MONTHS_SHORT_RU[parseInt(month) - 1]} '${year.slice(2)}`;
  }
  const [year, w] = key.split("-W");
  return `Нед ${parseInt(w)} '${year.slice(2)}`;
}

export interface GradeTrendPoint {
  period: string;
  label: string;
  clinConcordance: number;
  g2bPct: number;
  g2bNonMipsPct: number;
  g2bMipsPct: number;
  g3PlusPct: number;
  g4Pct: number;
  g4aPct: number;
  g4bPct: number;
  totalFindings: number;
}

export async function getGradeTrendData(mode: "week" | "month" | "year" = "month"): Promise<GradeTrendPoint[]> {
  const [allFindings, classified] = await Promise.all([getDVFindings(), getMIPSClassifiedFindings()]);
  const source = allFindings.filter((f) => f.exam_date);
  const mipsGroups: Record<string, number> = {};
  for (const cf of classified) {
    if (!cf.mips_related || !cf.exam_date) continue;
    const key = toPeriodKey(cf.exam_date, mode);
    mipsGroups[key] = (mipsGroups[key] ?? 0) + 1;
  }
  const groups: Record<string, DVFinding[]> = {};
  for (const f of source) {
    const key = toPeriodKey(f.exam_date!, mode);
    groups[key] = groups[key] ?? [];
    groups[key].push(f);
  }
  return Object.keys(groups)
    .sort()
    .map((key) => {
      const pf = groups[key];
      const total = pf.length;
      const g1  = pf.filter((f) => f.grade === "1").length;
      const g2a = pf.filter((f) => f.grade === "2a").length;
      const g2b = pf.filter((f) => f.grade === "2b").length;
      const g3  = pf.filter((f) => f.grade === "3").length;
      const g4  = pf.filter((f) => f.grade === "4").length;
      const g4a = pf.filter((f) => f.grade === "4a").length;
      const g4b = pf.filter((f) => f.grade === "4b").length;
      const mips2b = mipsGroups[key] ?? 0;
      const nonMips2b = Math.max(0, g2b - mips2b);
      return {
        period: key,
        label: toPeriodLabel(key, mode),
        clinConcordance: pct(g1 + g2a, total),
        g2bPct: pct(g2b, total),
        g2bNonMipsPct: pct(nonMips2b, total),
        g2bMipsPct: pct(mips2b, total),
        g3PlusPct: pct(g3, total),
        g4Pct: pct(g4 + g4b, total),
        g4aPct: pct(g4a, total),
        g4bPct: pct(g4b, total),
        totalFindings: total,
      };
    });
}

// --- MIPS ---

const MIPS_MEASURE_LABELS: Record<string, string> = {
  ACRad44:  "Коронарный кальциноз",
  MIPS_364: "Узлы лёгкого / Fleischner",
  "364":    "Узлы лёгкого / Fleischner",
  MIPS_405: "Доброкач. абдоминальные",
  "405":    "Доброкач. абдоминальные",
  MIPS_406: "Узлы щитовидки",
  "406":    "Узлы щитовидки",
  MIPS_360: "Структура протокола",
  QMM23:    "Эмфизема + LDCT",
};

export async function countMIPS2bInFindings(findings: DVFinding[]): Promise<number> {
  const classified = await getMIPSClassifiedFindings();
  const accessions = new Set(findings.map((f) => f.accession_number));
  return classified.filter((f) => f.mips_related && accessions.has(f.accession_number)).length;
}

export async function getMIPS2bCountsByDoctor(findings: DVFinding[]): Promise<Map<number, number>> {
  const classified = await getMIPSClassifiedFindings();
  const accessions = new Set(findings.map((f) => f.accession_number));
  const result = new Map<number, number>();
  for (const cf of classified) {
    if (cf.mips_related && accessions.has(cf.accession_number)) {
      result.set(cf.doctor_id, (result.get(cf.doctor_id) ?? 0) + 1);
    }
  }
  return result;
}

export async function getMIPSOverallStats(): Promise<{
  total949: number;
  total2b: number;
  mips2b: number;
  nonMips2b: number;
  mipsPctOfAll: number;
  mipsPctOf2b: number;
  byMeasure: MIPSStat[];
}> {
  const [all, classified] = await Promise.all([getDVFindings(), getMIPSClassifiedFindings()]);
  const total949 = all.length;
  const total2b = classified.length;
  const mipsFindings = classified.filter((f) => f.mips_related);
  const mips2b = mipsFindings.length;
  const nonMips2b = total2b - mips2b;
  const measureCounts: Record<string, number> = {};
  for (const f of mipsFindings) {
    const m = f.mips_measure ?? "unknown";
    measureCounts[m] = (measureCounts[m] ?? 0) + 1;
  }
  const byMeasure: MIPSStat[] = Object.entries(measureCounts)
    .map(([measure, count]) => ({
      measure,
      label: MIPS_MEASURE_LABELS[measure] ?? measure,
      count,
      pctOf2b: pct(count, total2b),
      pctOfAll: pct(count, total949),
    }))
    .sort((a, b) => b.count - a.count);
  return { total949, total2b, mips2b, nonMips2b, mipsPctOfAll: pct(mips2b, total949), mipsPctOf2b: pct(mips2b, total2b), byMeasure };
}

export async function getMIPSByDoctor(): Promise<DoctorMIPSStat[]> {
  const classified = await getMIPSClassifiedFindings();
  const doctorIds = [...new Set(classified.map((f) => f.doctor_id))];
  return doctorIds
    .map((id) => {
      const df = classified.filter((f) => f.doctor_id === id);
      const doctorName = df[0]?.doctor_name ?? String(id);
      const total2b = df.length;
      const mipsFindings = df.filter((f) => f.mips_related);
      const mips2b = mipsFindings.length;
      const byMeasure: Record<string, number> = {};
      for (const f of mipsFindings) {
        const m = f.mips_measure ?? "unknown";
        byMeasure[m] = (byMeasure[m] ?? 0) + 1;
      }
      return { doctor_id: id, doctor_name: doctorName, total2b, mips2b, mipsPct: pct(mips2b, total2b), byMeasure } satisfies DoctorMIPSStat;
    })
    .sort((a, b) => b.mipsPct - a.mipsPct);
}

// --- Root cause analysis ---

export interface RootCauseData {
  g3TopCategories: { category: string; count: number; pct: number }[];
  g4TopCategories: { category: string; count: number; pct: number }[];
  mipsTopMeasures: { measure: string; label: string; count: number }[];
  g3Concentration: {
    topDoctorId: number;
    topDoctorName: string;
    topCount: number;
    topPct: number;
    totalG3: number;
    isSystemic: boolean;
  } | null;
  mixEffect: {
    currLowPct: number;
    prevLowPct: number | null;
    changed: number | null;
  };
}

export async function getRootCauseData(
  periodFindings: DVFinding[],
  prevPeriodFindings: DVFinding[] | null,
): Promise<RootCauseData> {
  const classified = await getMIPSClassifiedFindings();
  const periodAccessions = new Set(periodFindings.map((f) => f.accession_number));

  const g3findings = periodFindings.filter((f) => f.grade === "3");
  const g4findings = periodFindings.filter((f) => f.grade === "4");

  const g3ByCat: Record<string, number> = {};
  for (const f of g3findings) {
    g3ByCat[f.finding_category] = (g3ByCat[f.finding_category] ?? 0) + 1;
  }
  const g3TopCategories = Object.entries(g3ByCat)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([category, count]) => ({ category, count, pct: pct(count, g3findings.length) }));

  const g4ByCat: Record<string, number> = {};
  for (const f of g4findings) {
    g4ByCat[f.finding_category] = (g4ByCat[f.finding_category] ?? 0) + 1;
  }
  const g4TopCategories = Object.entries(g4ByCat)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([category, count]) => ({ category, count, pct: pct(count, g4findings.length) }));

  const mipsByMeasure: Record<string, number> = {};
  for (const cf of classified) {
    if (cf.mips_related && cf.mips_measure && periodAccessions.has(cf.accession_number)) {
      mipsByMeasure[cf.mips_measure] = (mipsByMeasure[cf.mips_measure] ?? 0) + 1;
    }
  }
  const mipsTopMeasures = Object.entries(mipsByMeasure)
    .sort((a, b) => b[1] - a[1])
    .map(([measure, count]) => ({ measure, label: MIPS_MEASURE_LABELS[measure] ?? measure, count }));

  let g3Concentration: RootCauseData["g3Concentration"] = null;
  if (g3findings.length > 0) {
    const byDoc: Record<number, { name: string; count: number }> = {};
    for (const f of g3findings) {
      if (!byDoc[f.doctor_id]) byDoc[f.doctor_id] = { name: f.doctor_name, count: 0 };
      byDoc[f.doctor_id].count++;
    }
    const top = Object.entries(byDoc).sort((a, b) => b[1].count - a[1].count)[0];
    const topPct = pct(top[1].count, g3findings.length);
    g3Concentration = {
      topDoctorId: Number(top[0]),
      topDoctorName: top[1].name,
      topCount: top[1].count,
      topPct,
      totalG3: g3findings.length,
      isSystemic: topPct < 50,
    };
  }

  function computeLowPct(findings: DVFinding[]): number {
    if (findings.length === 0) return 0;
    const byDoc: Record<number, { g1: number; g2a: number; total: number }> = {};
    for (const f of findings) {
      if (!byDoc[f.doctor_id]) byDoc[f.doctor_id] = { g1: 0, g2a: 0, total: 0 };
      byDoc[f.doctor_id].total++;
      if (f.grade === "1") byDoc[f.doctor_id].g1++;
      if (f.grade === "2a") byDoc[f.doctor_id].g2a++;
    }
    let lowFindings = 0;
    for (const d of Object.values(byDoc)) {
      const conc = d.total > 0 ? ((d.g1 + d.g2a) / d.total) * 100 : 0;
      if (conc < 40) lowFindings += d.total;
    }
    return pct(lowFindings, findings.length);
  }

  const currLowPct = computeLowPct(periodFindings);
  const prevLowPct = prevPeriodFindings ? computeLowPct(prevPeriodFindings) : null;

  return {
    g3TopCategories,
    g4TopCategories,
    mipsTopMeasures,
    g3Concentration,
    mixEffect: {
      currLowPct,
      prevLowPct,
      changed: prevLowPct !== null ? Math.round((currLowPct - prevLowPct) * 10) / 10 : null,
    },
  };
}

// --- Doctor recurring patterns ---

export async function getDoctorRecurringPatterns(doctorId: number): Promise<{
  g3Patterns: { category: string; count: number; discrepancyType: string }[];
  mipsPatterns: { measure: string; label: string; count: number }[];
}> {
  const [findings, classified] = await Promise.all([
    getDoctorFindings(doctorId),
    getMIPSClassifiedFindings(),
  ]);
  const classifiedForDoctor = classified.filter((f) => f.doctor_id === doctorId);

  const g3 = findings.filter((f) => f.grade === "3" || f.grade === "4");
  const g3ByCat: Record<string, { count: number; types: string[] }> = {};
  for (const f of g3) {
    if (!g3ByCat[f.finding_category]) g3ByCat[f.finding_category] = { count: 0, types: [] };
    g3ByCat[f.finding_category].count++;
    if (!g3ByCat[f.finding_category].types.includes(f.discrepancy_type))
      g3ByCat[f.finding_category].types.push(f.discrepancy_type);
  }
  const g3Patterns = Object.entries(g3ByCat)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([category, { count, types }]) => ({ category, count, discrepancyType: types.join(", ") }));

  const mipsByCat: Record<string, number> = {};
  for (const f of classifiedForDoctor) {
    if (f.mips_related && f.mips_measure) {
      mipsByCat[f.mips_measure] = (mipsByCat[f.mips_measure] ?? 0) + 1;
    }
  }
  const mipsPatterns = Object.entries(mipsByCat)
    .sort((a, b) => b[1] - a[1])
    .map(([measure, count]) => ({ measure, label: MIPS_MEASURE_LABELS[measure] ?? measure, count }));

  return { g3Patterns, mipsPatterns };
}

// --- Combined QA (xAID vs SimonMed finals) ---

interface RawCombinedFinding {
  accession_number: string;
  finding_category: string;
  grade: string;
  prelim_report_by: string;
  finalized_by: string;
  discrepancy_type: string;
}

interface RawCombinedData {
  findings: RawCombinedFinding[];
  study_summaries: { accession_number: string; sheet_date: string; prelim_report_by: string }[];
  pending_final_report?: { accession_number: string; sheet_date: string; exam_description: string }[];
}

interface RawMissFile {
  doctor_name: string;
  doctor_id: number;
  total_studies: number;
  total_missed_pathologies: number;
  breakdown_by_category?: Record<string, number>;
  summary_by_category?: Record<string, number>;
  category_breakdown?: Record<string, number>;
}

export const getCombinedQAStats = cache(async (): Promise<CombinedQAStats> => {
  const data = await readRepoJSON<RawCombinedData>("combined_analysis.json");
  const findings = data.findings;
  const total = findings.length;

  const g1  = findings.filter((f) => f.grade === "1").length;
  const g2a = findings.filter((f) => f.grade === "2a").length;
  const g2b = findings.filter((f) => f.grade === "2b").length;
  const g3  = findings.filter((f) => f.grade === "3").length;
  const g4  = findings.filter((f) => f.grade === "4").length;

  const reporters = [...new Set(findings.map((f) => f.prelim_report_by).filter(Boolean))];
  const byReporter: ReporterStats[] = reporters.map((name) => {
    const rf = findings.filter((f) => f.prelim_report_by === name);
    const rt = rf.length;
    const rg1  = rf.filter((f) => f.grade === "1").length;
    const rg2a = rf.filter((f) => f.grade === "2a").length;
    const rg2b = rf.filter((f) => f.grade === "2b").length;
    const rg3  = rf.filter((f) => f.grade === "3").length;
    const rg4  = rf.filter((f) => f.grade === "4").length;
    return { name, totalFindings: rt, g1: rg1, g2a: rg2a, g2b: rg2b, g3: rg3, g4: rg4,
      concordance: pct(rg1, rt), clinicalConcordance: pct(rg1 + rg2a, rt) };
  });

  const finalizers = [...new Set(findings.map((f) => f.finalized_by).filter(Boolean))];
  const byFinalizer: FinalizerStats[] = finalizers
    .map((name) => {
      const ff = findings.filter((f) => f.finalized_by === name);
      const ft = ff.length;
      const fg1  = ff.filter((f) => f.grade === "1").length;
      const fg2a = ff.filter((f) => f.grade === "2a").length;
      return { name, totalFindings: ft, concordance: pct(fg1, ft), clinicalConcordance: pct(fg1 + fg2a, ft) };
    })
    .sort((a, b) => b.totalFindings - a.totalFindings);

  const catCounts: Record<string, { count: number; g3Plus: number }> = {};
  for (const f of findings.filter((f) => f.grade !== "1")) {
    if (!catCounts[f.finding_category]) catCounts[f.finding_category] = { count: 0, g3Plus: 0 };
    catCounts[f.finding_category].count++;
    if (f.grade === "3" || f.grade === "4") catCounts[f.finding_category].g3Plus++;
  }
  const topCategories = Object.entries(catCounts)
    .map(([category, { count, g3Plus }]) => ({ category, count, g3Plus }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const pending = data.pending_final_report ?? [];
  return {
    totalStudies: data.study_summaries.length,
    totalFindings: total,
    pendingCount: pending.length,
    g1, g1Pct: pct(g1, total),
    g2a, g2aPct: pct(g2a, total),
    g2b, g2bPct: pct(g2b, total),
    g3, g3Pct: pct(g3, total),
    g4, g4Pct: pct(g4, total),
    concordance: pct(g1, total),
    clinicalConcordance: pct(g1 + g2a, total),
    significantRate: pct(g3 + g4, total),
    byReporter,
    byFinalizer,
    topCategories,
    pendingStudies: pending.map((p) => ({
      accession_number: p.accession_number,
      sheet_date: p.sheet_date,
      exam_description: p.exam_description ?? "",
    })),
  };
});

export const getDoctorMissReports = cache(async (): Promise<DoctorMissReport[]> => {
  const files = [
    "misses_lukyanov.json",
    "misses_astakhov.json",
    "misses_pavlovich.json",
    "misses_rodina.json",
  ];
  const results = await Promise.all(files.map((f) => readRepoJSON<RawMissFile>(f)));
  return results
    .map((d) => {
      const breakdown = d.breakdown_by_category ?? d.summary_by_category ?? d.category_breakdown ?? {};
      const top_categories = Object.entries(breakdown)
        .map(([category, count]) => ({ category, count: count as number }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);
      return {
        doctor_name: d.doctor_name,
        doctor_id: d.doctor_id,
        total_studies: d.total_studies,
        total_missed_pathologies: d.total_missed_pathologies,
        miss_rate: d.total_studies > 0
          ? Math.round((d.total_missed_pathologies / d.total_studies) * 10) / 10
          : 0,
        top_categories,
      };
    })
    .sort((a, b) => b.total_missed_pathologies - a.total_missed_pathologies);
});
