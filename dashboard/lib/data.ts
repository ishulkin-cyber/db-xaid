import fs from "fs";
import path from "path";
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
} from "./types";
import { pct } from "./utils";

const dataDir = path.join(process.cwd(), "data");

function readJSON<T>(filename: string): T {
  const filePath = path.join(dataDir, filename);
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

// --- Raw data loaders ---

export function getDVFindings(): DVFinding[] {
  return readJSON<DVFinding[]>("dv_findings.json");
}

export function getDoctorValidatorPairs(): DoctorValidatorPair[] {
  return readJSON<DoctorValidatorPair[]>("doctor_validator_pairs.json");
}

// --- Period filtering ---

export function filterFindingsByDateRange(
  findings: DVFinding[],
  start: string,
  end: string
): DVFinding[] {
  return findings.filter(
    (f) => f.exam_date == null || (f.exam_date >= start && f.exam_date <= end)
  );
}

// --- Stats from pre-filtered findings (for period filtering) ---

export function getOverallStatsFromFindings(findings: DVFinding[]) {
  const total = findings.length;
  const grade1  = findings.filter((f) => f.grade === "1").length;
  const grade2a = findings.filter((f) => f.grade === "2a").length;
  const grade2b = findings.filter((f) => f.grade === "2b").length;
  const grade3  = findings.filter((f) => f.grade === "3").length;
  const grade4  = findings.filter((f) => f.grade === "4").length;
  const totalStudies  = new Set(findings.map((f) => f.accession_number)).size;
  const totalDoctors  = new Set(findings.map((f) => f.doctor_id)).size;
  return {
    totalStudies, totalDoctors, totalFindings: total,
    grade1, grade2a, grade2b, grade3, grade4,
    concordance: pct(grade1, total),
    clinicalConcordance: pct(grade1 + grade2a, total),
    significantRate: pct(grade3 + grade4, total),
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
        grade1: g1, grade2a: g2a, grade2b: g2b, grade3: g3, grade4: g4,
        concordance: pct(g1, total),
        clinicalConcordance: pct(g1 + g2a, total),
        significantRate: pct(g3 + g4, total),
        topCategories,
      } satisfies DoctorStats;
    })
    .sort((a, b) => b.clinicalConcordance - a.clinicalConcordance);
}

// --- Grade distribution (for a given finding set) ---

export function getGradeDistribution(
  findings?: DVFinding[]
): { grade: Grade; count: number; label: string }[] {
  const source = findings ?? getDVFindings();
  const grades: { grade: Grade; label: string }[] = [
    { grade: "1", label: "Concordant" },
    { grade: "2a", label: "Minor Stylistic" },
    { grade: "2b", label: "Minor Clinical" },
    { grade: "3", label: "Significant Underreport" },
    { grade: "4", label: "Significant Overreport" },
  ];
  return grades.map(({ grade, label }) => ({
    grade,
    count: source.filter((f) => f.grade === grade).length,
    label,
  }));
}

// --- Overall stats ---

export function getOverallStats() {
  const findings = getDVFindings();
  const total = findings.length;
  const grade1 = findings.filter((f) => f.grade === "1").length;
  const grade2a = findings.filter((f) => f.grade === "2a").length;
  const grade2b = findings.filter((f) => f.grade === "2b").length;
  const grade3 = findings.filter((f) => f.grade === "3").length;
  const grade4 = findings.filter((f) => f.grade === "4").length;

  const allAccessions = [...new Set(findings.map((f) => f.accession_number))];
  const totalStudies = allAccessions.length;
  const allDoctorIds = [...new Set(findings.map((f) => f.doctor_id))];
  const totalDoctors = allDoctorIds.length;

  return {
    totalStudies,
    totalDoctors,
    totalFindings: total,
    grade1,
    grade2a,
    grade2b,
    grade3,
    grade4,
    concordance: pct(grade1, total),
    clinicalConcordance: pct(grade1 + grade2a, total),
    significantRate: pct(grade3 + grade4, total),
  };
}

// --- Doctor stats list (leaderboard) ---

export function getDoctorStatsList(): DoctorStats[] {
  const findings = getDVFindings();
  const doctorIds = [...new Set(findings.map((f) => f.doctor_id))];

  return doctorIds
    .map((id) => {
      const doctorFindings = findings.filter((f) => f.doctor_id === id);
      const doctorName = doctorFindings[0]?.doctor_name ?? String(id);
      const accessions = [...new Set(doctorFindings.map((f) => f.accession_number))];
      const total = doctorFindings.length;
      const g1 = doctorFindings.filter((f) => f.grade === "1").length;
      const g2a = doctorFindings.filter((f) => f.grade === "2a").length;
      const g2b = doctorFindings.filter((f) => f.grade === "2b").length;
      const g3 = doctorFindings.filter((f) => f.grade === "3").length;
      const g4 = doctorFindings.filter((f) => f.grade === "4").length;

      // Top error categories (non-concordant findings)
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
        doctor_id: id,
        doctor_name: doctorName,
        total_studies: accessions.length,
        total_findings: total,
        grade1: g1,
        grade2a: g2a,
        grade2b: g2b,
        grade3: g3,
        grade4: g4,
        concordance: pct(g1, total),
        clinicalConcordance: pct(g1 + g2a, total),
        significantRate: pct(g3 + g4, total),
        topCategories,
      } satisfies DoctorStats;
    })
    .sort((a, b) => b.clinicalConcordance - a.clinicalConcordance);
}

// --- Doctor by ID ---

export function getDoctorById(id: number): DoctorStats | undefined {
  return getDoctorStatsList().find((d) => d.doctor_id === id);
}

// --- Doctor findings ---

export function getDoctorFindings(doctorId: number): DVFinding[] {
  return getDVFindings().filter((f) => f.doctor_id === doctorId);
}

// --- Doctor studies list ---

export function getDoctorStudies(doctorId: number): DVStudySummary[] {
  const findings = getDoctorFindings(doctorId);
  const classified = getMIPSClassifiedFindings();
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
    const g1 = accFindings.filter((f) => f.grade === "1").length;
    const g2a = accFindings.filter((f) => f.grade === "2a").length;
    const g2b = accFindings.filter((f) => f.grade === "2b").length;
    const g3 = accFindings.filter((f) => f.grade === "3").length;
    const g4 = accFindings.filter((f) => f.grade === "4").length;
    const discrepancies = accFindings.filter((f) => f.grade !== "1").length;
    const mips2b = mipsAccMap.get(acc) ?? 0;

    // Determine overall grade: worst grade present
    let overallGrade: Grade | "N/A" = "N/A";
    if (g4 > 0) overallGrade = "4";
    else if (g3 > 0) overallGrade = "3";
    else if (g2b > 0) overallGrade = "2b";
    else if (g2a > 0) overallGrade = "2a";
    else if (g1 > 0) overallGrade = "1";

    const keyDiscrepancies = accFindings
      .filter((f) => f.grade === "3" || f.grade === "4")
      .map((f) => f.finding_category)
      .slice(0, 3);

    return {
      accession_number: acc,
      doctor_name: doctorName,
      doctor_id: doctorId,
      overall_grade: overallGrade,
      total_findings: total,
      concordant_count: g1,
      stylistic_count: g2a,
      minor_clinical_count: g2b,
      significant_underreport_count: g3,
      significant_overreport_count: g4,
      discrepancy_count: discrepancies,
      mips2b_count: mips2b,
      key_discrepancies: keyDiscrepancies,
    } satisfies DVStudySummary;
  });
}

// --- Doctor trend by date ---

export function getDoctorTrendByDate(doctorId: number): TrendDataPoint[] {
  const findings = getDoctorFindings(doctorId);
  const findingsWithDate = findings.filter((f) => f.exam_date);

  if (findingsWithDate.length === 0) return [];

  const dates = [...new Set(findingsWithDate.map((f) => f.exam_date as string))].sort();

  return dates.map((date) => {
    const dayFindings = findingsWithDate.filter((f) => f.exam_date === date);
    const total = dayFindings.length;
    const g1 = dayFindings.filter((f) => f.grade === "1").length;
    const g2a = dayFindings.filter((f) => f.grade === "2a").length;
    const g2b = dayFindings.filter((f) => f.grade === "2b").length;
    const g3 = dayFindings.filter((f) => f.grade === "3").length;
    const g4 = dayFindings.filter((f) => f.grade === "4").length;

    return {
      date,
      concordance: pct(g1, total),
      clinicalConcordance: pct(g1 + g2a, total),
      totalFindings: total,
      grade1: g1,
      grade2a: g2a,
      grade2b: g2b,
      grade3: g3,
      grade4: g4,
    };
  });
}

// --- All study summaries (for studies list page) ---

export function getDVStudySummaries(): DVStudySummary[] {
  const findings = getDVFindings();
  const classified = getMIPSClassifiedFindings();
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
    const g1 = accFindings.filter((f) => f.grade === "1").length;
    const g2a = accFindings.filter((f) => f.grade === "2a").length;
    const g2b = accFindings.filter((f) => f.grade === "2b").length;
    const g3 = accFindings.filter((f) => f.grade === "3").length;
    const g4 = accFindings.filter((f) => f.grade === "4").length;
    const discrepancies = accFindings.filter((f) => f.grade !== "1").length;
    const mips2b = mipsAccMap.get(acc) ?? 0;

    let overallGrade: Grade | "N/A" = "N/A";
    if (g4 > 0) overallGrade = "4";
    else if (g3 > 0) overallGrade = "3";
    else if (g2b > 0) overallGrade = "2b";
    else if (g2a > 0) overallGrade = "2a";
    else if (g1 > 0) overallGrade = "1";

    const keyDiscrepancies = accFindings
      .filter((f) => f.grade === "3" || f.grade === "4")
      .map((f) => f.finding_category)
      .slice(0, 3);

    return {
      accession_number: acc,
      doctor_name: doctorName,
      doctor_id: doctorId,
      overall_grade: overallGrade,
      total_findings: total,
      concordant_count: g1,
      stylistic_count: g2a,
      minor_clinical_count: g2b,
      significant_underreport_count: g3,
      significant_overreport_count: g4,
      discrepancy_count: discrepancies,
      mips2b_count: mips2b,
      key_discrepancies: keyDiscrepancies,
    } satisfies DVStudySummary;
  });
}

// --- Study detail ---

export function getStudyDetail(accession: string) {
  const findings = getDVFindings().filter((f) => f.accession_number === accession);
  const pair = getDoctorValidatorPairs().find((p) => p.accession_number === accession);
  const summaries = getDVStudySummaries();
  const summary = summaries.find((s) => s.accession_number === accession);
  return { findings, pair, summary };
}

// --- Static params helpers ---

export function getAllAccessions(): string[] {
  const findings = getDVFindings();
  return [...new Set(findings.map((f) => f.accession_number))];
}

export function getAllDoctorIds(): number[] {
  const findings = getDVFindings();
  return [...new Set(findings.map((f) => f.doctor_id))];
}

// --- Category stats ---

export function getCategoryStats() {
  const findings = getDVFindings();
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

export function getCategoryDetailedStats(): CategoryDetailedStat[] {
  const source = getDVFindings();
  const cats = [...new Set(source.map((f) => f.finding_category))];
  return cats
    .map((cat) => {
      const cf = source.filter((f) => f.finding_category === cat);
      const total = cf.length;
      const g2b = cf.filter((f) => f.grade === "2b").length;
      const g3 = cf.filter((f) => f.grade === "3").length;
      const g4 = cf.filter((f) => f.grade === "4").length;
      return { category: cat, total, g2bPct: pct(g2b, total), g3PlusPct: pct(g3 + g4, total) };
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
  totalFindings: number;
}

export function getGradeTrendData(mode: "week" | "month" | "year" = "month"): GradeTrendPoint[] {
  const source = getDVFindings().filter((f) => f.exam_date);
  const classified = getMIPSClassifiedFindings();
  // Build set of accession_numbers that have mips findings per period
  const mipsAccSet = new Set(classified.filter((f) => f.mips_related).map((f) => f.accession_number));
  // Build mips count by exam_date key
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
      const mips2b = mipsGroups[key] ?? 0;
      const nonMips2b = Math.max(0, g2b - mips2b);
      return {
        period: key,
        label: toPeriodLabel(key, mode),
        clinConcordance: pct(g1 + g2a, total),
        g2bPct: pct(g2b, total),
        g2bNonMipsPct: pct(nonMips2b, total),
        g2bMipsPct: pct(mips2b, total),
        g3PlusPct: pct(g3 + g4, total),
        totalFindings: total,
      };
    });
}

// --- MIPS ---

type ClassifiedFinding = DVFinding & { mips_related: boolean; mips_measure: string | null };

const MIPS_MEASURE_LABELS: Record<string, string> = {
  ACRad44: "Коронарный кальциноз",
  "364":    "Узлы лёгкого / Fleischner",
  "405":    "Доброкач. абдоминальные",
  "406":    "Узлы щитовидки",
  QMM23:   "Эмфизема + LDCT",
};

export function getMIPSClassifiedFindings(): ClassifiedFinding[] {
  return readJSON<ClassifiedFinding[]>("dv_findings_2b_classified.json");
}

export function countMIPS2bInFindings(findings: DVFinding[]): number {
  const classified = getMIPSClassifiedFindings();
  const accessions = new Set(findings.map((f) => f.accession_number));
  return classified.filter(
    (f) => f.mips_related && accessions.has(f.accession_number)
  ).length;
}

export function getMIPS2bCountsByDoctor(findings: DVFinding[]): Map<number, number> {
  const classified = getMIPSClassifiedFindings();
  const accessions = new Set(findings.map((f) => f.accession_number));
  const result = new Map<number, number>();
  for (const cf of classified) {
    if (cf.mips_related && accessions.has(cf.accession_number)) {
      result.set(cf.doctor_id, (result.get(cf.doctor_id) ?? 0) + 1);
    }
  }
  return result;
}

export function getMIPSOverallStats(): {
  total949: number;
  total2b: number;
  mips2b: number;
  nonMips2b: number;
  mipsPctOfAll: number;
  mipsPctOf2b: number;
  byMeasure: MIPSStat[];
} {
  const all = getDVFindings();
  const classified = getMIPSClassifiedFindings();
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

export function getMIPSByDoctor(): DoctorMIPSStat[] {
  const classified = getMIPSClassifiedFindings();
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
  /** Top G3+ finding categories */
  g3TopCategories: { category: string; count: number; pct: number }[];
  /** Top 2b-MIPS measures violated this period */
  mipsTopMeasures: { measure: string; label: string; count: number }[];
  /** Who is responsible for G3+ — individual vs systemic signal */
  g3Concentration: {
    topDoctorId: number;
    topDoctorName: string;
    topCount: number;
    topPct: number;
    totalG3: number;
    isSystemic: boolean;
  } | null;
  /** % of findings from doctors with concordance <40% */
  mixEffect: {
    currLowPct: number;
    prevLowPct: number | null;
    changed: number | null;
  };
}

export function getRootCauseData(
  periodFindings: DVFinding[],
  prevPeriodFindings: DVFinding[] | null,
): RootCauseData {
  const classified = getMIPSClassifiedFindings();
  const periodAccessions = new Set(periodFindings.map((f) => f.accession_number));

  // 1. Top G3+ categories
  const g3findings = periodFindings.filter((f) => f.grade === "3" || f.grade === "4");
  const g3ByCat: Record<string, number> = {};
  for (const f of g3findings) {
    g3ByCat[f.finding_category] = (g3ByCat[f.finding_category] ?? 0) + 1;
  }
  const g3TopCategories = Object.entries(g3ByCat)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([category, count]) => ({
      category,
      count,
      pct: pct(count, g3findings.length),
    }));

  // 2. Top MIPS measures
  const mipsByMeasure: Record<string, number> = {};
  for (const cf of classified) {
    if (cf.mips_related && cf.mips_measure && periodAccessions.has(cf.accession_number)) {
      mipsByMeasure[cf.mips_measure] = (mipsByMeasure[cf.mips_measure] ?? 0) + 1;
    }
  }
  const mipsTopMeasures = Object.entries(mipsByMeasure)
    .sort((a, b) => b[1] - a[1])
    .map(([measure, count]) => ({
      measure,
      label: MIPS_MEASURE_LABELS[measure] ?? measure,
      count,
    }));

  // 3. G3+ concentration
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

  // 4. Mix effect: % of findings from doctors with low concordance (<40%)
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
    mipsTopMeasures,
    g3Concentration,
    mixEffect: {
      currLowPct,
      prevLowPct,
      changed: prevLowPct !== null ? Math.round((currLowPct - prevLowPct) * 10) / 10 : null,
    },
  };
}

/** Top recurring failure categories for a single doctor */
export function getDoctorRecurringPatterns(doctorId: number): {
  g3Patterns: { category: string; count: number; discrepancyType: string }[];
  mipsPatterns: { measure: string; label: string; count: number }[];
} {
  const findings = getDoctorFindings(doctorId);
  const classified = getMIPSClassifiedFindings().filter((f) => f.doctor_id === doctorId);

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
    .map(([category, { count, types }]) => ({
      category,
      count,
      discrepancyType: types.join(", "),
    }));

  const mipsByCat: Record<string, number> = {};
  for (const f of classified) {
    if (f.mips_related && f.mips_measure) {
      mipsByCat[f.mips_measure] = (mipsByCat[f.mips_measure] ?? 0) + 1;
    }
  }
  const mipsPatterns = Object.entries(mipsByCat)
    .sort((a, b) => b[1] - a[1])
    .map(([measure, count]) => ({
      measure,
      label: MIPS_MEASURE_LABELS[measure] ?? measure,
      count,
    }));

  return { g3Patterns, mipsPatterns };
}
