export interface Doctor {
  id: number;
  name: string;
}

export interface DayCell {
  tasks: number;
  omissions: number;
  omission_rate: number;
  grade_3_count: number;
  task_ids: number[];
}

export interface WorkloadCell {
  tasks: number;
  hours: number;
}

export interface DoctorQualityRow {
  id: number;
  name: string;
  total: {
    tasks: number;
    omissions: number;
    omission_rate: number;
    grade_3_count: number;
  };
  days: Record<string, DayCell | null>;
}

export interface DoctorWorkloadRow {
  id: number;
  name: string;
  total: {
    tasks: number;
    hours: number;
    active_days: number;
    avg_per_day: number;
  };
  days: Record<string, WorkloadCell | null>;
}

export interface QualityTableData {
  col_keys: string[];
  col_labels: string[];
  doctors: DoctorQualityRow[];
  view: "days" | "weeks";
  period: { start: string; end: string };
}

export interface WorkloadData {
  col_keys: string[];
  col_labels: string[];
  doctors: DoctorWorkloadRow[];
  view: "days" | "weeks";
  period: { start: string; end: string };
}

export interface OverviewData {
  total_tasks: number;
  omission_count: number;
  omission_rate: number;
  grade_2b_count: number;
  grade_2b_rate: number;
  grade_3_count: number;
  grade_3_rate: number;
  graded_count: number;
  ungraded_count: number;
  period: { start: string; end: string };
}

export interface TrendPoint {
  date: string;
  tasks: number;
  omissions: number;
  omission_rate: number;
}

export interface CategoryBreakdown {
  category: string;
  label: string;
  count: number;
}

export interface MissedFinding {
  date: string;
  task_id: number;
  grade: string;
  category: string;
  category_label: string;
  finding_text: string;
  management_impact: boolean;
  location: string;
}

export interface DoctorDetail {
  id: number;
  name: string;
  stats: {
    total_tasks: number;
    graded_tasks: number;
    omission_rate: number;
    total_omissions: number;
    grade_3_count: number;
    clinical_concordance: number | null;
  };
  grade_distribution: {
    grade_1_count: number;
    grade_2a_count: number;
    grade_2b_count: number;
    grade_3_count: number;
    grade_4_count: number;
    total_findings: number;
  };
  trend_data: TrendPoint[];
  category_breakdown: CategoryBreakdown[];
  missed_findings: MissedFinding[];
}

export interface ReportVersion {
  id: number;
  task_id: number;
  version: number;
  author_id: number;
  author_name: string;
  protocol: string | null;
  findings: string | null;
  impression: string | null;
  protocol_en: string | null;
  findings_en: string | null;
  impression_en: string | null;
  created_at: string;
}

export interface GradingFinding {
  id: number;
  category: string;
  category_label: string;
  finding_text: string;
  radiologist_text: string | null;
  validator_text: string | null;
  grade: string;
  grade_label: string;
  management_impact: string | null;
  location: string;
}

export interface GradingSummary {
  grade_1_count: number;
  grade_2a_count: number;
  grade_2b_count: number;
  grade_3_count: number;
  grade_4_count: number;
  total_findings: number;
  has_omissions: boolean;
  overall_grade: string;
  concordance_rate: number;
  clinical_concordance_rate: number;
}

export interface GradeResult {
  task_id: number;
  graded_at: string;
  overall_grade: string;
  has_omissions: boolean;
  findings: GradingFinding[];
  summary: GradingSummary;
}

export interface TaskReports {
  task_id: number;
  radiologist_report: ReportVersion;
  validator_report: ReportVersion | null;
  all_versions: number;
  grade: GradeResult | null;
}

export type PeriodPreset = "all" | "day" | "week" | "month" | "year";
export type ViewMode = "days" | "weeks";
export type Tab = "quality" | "workload";
