export type Grade = "1" | "2a" | "2b" | "3" | "4";
export type DiscrepancyType = "concordant" | "stylistic" | "underreport" | "overreport";

export interface DVFinding {
  accession_number: string;
  finding_category: string;
  anatomical_location: string;
  in_doctor_report: boolean;
  in_validator_report: boolean;
  doctor_description: string;
  validator_description: string;
  discrepancy_type: DiscrepancyType;
  grade: Grade;
  management_impact: string;
  notes: string;
  doctor_name: string;
  doctor_id: number;
  exam_date?: string; // populated by extraction script
}

export interface DVStudySummary {
  accession_number: string;
  doctor_name: string;
  doctor_id: number;
  exam_description?: string;
  patient_age?: number;
  patient_sex?: string;
  exam_date?: string;
  overall_grade: Grade | "N/A";
  total_findings: number;
  concordant_count: number;
  stylistic_count: number;
  minor_clinical_count: number;
  significant_underreport_count: number;
  significant_overreport_count: number;
  discrepancy_count: number;
  key_discrepancies: string[];
}

export interface DoctorValidatorPair {
  accession_number: string;
  doc_findings: string;
  doc_impression: string;
  val_findings: string;
  val_impression: string;
  val_protocol?: string;
  doctor_id: number;
  doctor_name: string;
}

export interface DoctorStats {
  doctor_id: number;
  doctor_name: string;
  total_studies: number;
  total_findings: number;
  grade1: number;
  grade2a: number;
  grade2b: number;
  grade3: number;
  grade4: number;
  concordance: number;
  clinicalConcordance: number;
  significantRate: number;
  topCategories: { category: string; count: number }[];
}

export interface TrendDataPoint {
  date: string;
  concordance: number;
  clinicalConcordance: number;
  totalFindings: number;
  grade1: number;
  grade2a: number;
  grade2b: number;
  grade3: number;
  grade4: number;
}
