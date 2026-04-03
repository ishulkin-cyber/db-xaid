import type {
  DoctorDetail,
  GradeResult,
  OverviewData,
  QualityTableData,
  TaskReports,
  WorkloadData,
} from "./types";

const BASE = "/api";

async function get<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(BASE + path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => v && url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail ?? res.statusText);
  }
  return res.json();
}

async function post<T>(path: string): Promise<T> {
  const res = await fetch(BASE + path, { method: "POST" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail ?? res.statusText);
  }
  return res.json();
}

export const api = {
  overview: (start: string, end: string) =>
    get<OverviewData>("/quality/overview", { start_date: start, end_date: end }),

  qualityTable: (start: string, end: string, view: "days" | "weeks") =>
    get<QualityTableData>("/quality/table", { start_date: start, end_date: end, view }),

  workload: (start: string, end: string, view: "days" | "weeks") =>
    get<WorkloadData>("/workload", { start_date: start, end_date: end, view }),

  doctorDetail: (id: number, start: string, end: string) =>
    get<DoctorDetail>(`/doctor/${id}/detail`, { start_date: start, end_date: end }),

  taskReports: (taskId: number) =>
    get<TaskReports>(`/task/${taskId}/reports`),

  gradeTask: (taskId: number) =>
    post<GradeResult>(`/task/${taskId}/grade`),
};
