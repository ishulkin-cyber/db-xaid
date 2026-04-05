import fs from "fs";
import path from "path";
import type {
  DVFinding,
  DoctorValidatorPair,
  DVStudySummary,
  DoctorStats,
  TrendDataPoint,
  Grade,
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
