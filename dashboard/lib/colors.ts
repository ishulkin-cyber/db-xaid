import type { Grade } from "./types";

export const gradeColors: Record<Grade, { bg: string; text: string; badge: string; border: string; label: string }> = {
  "1":  { bg: "bg-emerald-50",  text: "text-emerald-700",  badge: "bg-emerald-100 text-emerald-800",  border: "border-emerald-500", label: "Concordant" },
  "2a": { bg: "bg-blue-50",     text: "text-blue-700",     badge: "bg-blue-100 text-blue-800",        border: "border-blue-500",    label: "Minor Stylistic" },
  "2b": { bg: "bg-amber-50",    text: "text-amber-700",    badge: "bg-amber-100 text-amber-800",      border: "border-amber-500",   label: "Minor Clinical" },
  "3":  { bg: "bg-red-50",      text: "text-red-700",      badge: "bg-red-100 text-red-800",          border: "border-red-600",     label: "Significant Underreport" },
  "4":  { bg: "bg-red-50",      text: "text-red-700",      badge: "bg-red-100 text-red-800",          border: "border-red-600",     label: "Significant Overreport" },
};

export const gradeChartColors: Record<Grade, string> = {
  "1":  "#10b981",
  "2a": "#3b82f6",
  "2b": "#f59e0b",
  "3":  "#ea580c",
  "4":  "#dc2626",
};

export function gradeColor(grade: Grade): string {
  return gradeChartColors[grade] ?? "#94a3b8";
}

export function gradeTextColor(grade: Grade): string {
  return gradeColors[grade]?.text ?? "text-slate-700";
}

export function gradeBgColor(grade: Grade): string {
  return gradeColors[grade]?.badge ?? "bg-slate-100 text-slate-700";
}
