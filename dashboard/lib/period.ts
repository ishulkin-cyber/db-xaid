import {
  addDays,
  addMonths,
  addYears,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  format,
  parseISO,
  getISOWeek,
  getYear,
} from "date-fns";

export type PeriodMode = "week" | "month" | "year";

export interface PeriodRange {
  start: string;   // YYYY-MM-DD
  end: string;     // YYYY-MM-DD
  label: string;   // Full display label
}

const MONTHS_RU = [
  "Январь","Февраль","Март","Апрель","Май","Июнь",
  "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь",
];

export function getPeriodRange(mode: PeriodMode, ref: string): PeriodRange {
  const date = parseISO(ref);

  if (mode === "week") {
    const start = startOfWeek(date, { weekStartsOn: 1 });
    const end = endOfWeek(date, { weekStartsOn: 1 });
    const weekNum = getISOWeek(date);
    return {
      start: format(start, "yyyy-MM-dd"),
      end: format(end, "yyyy-MM-dd"),
      label: `Нед. ${weekNum}  ${format(start, "dd.MM")}–${format(end, "dd.MM")}`,
    };
  }

  if (mode === "month") {
    const start = startOfMonth(date);
    const end = endOfMonth(date);
    return {
      start: format(start, "yyyy-MM-dd"),
      end: format(end, "yyyy-MM-dd"),
      label: `${MONTHS_RU[date.getMonth()]} ${getYear(date)}`,
    };
  }

  // year
  const start = startOfYear(date);
  const end = endOfYear(date);
  return {
    start: format(start, "yyyy-MM-dd"),
    end: format(end, "yyyy-MM-dd"),
    label: `${getYear(date)}`,
  };
}

/** Shift ref date by ±1 period step. */
export function shiftPeriod(mode: PeriodMode, ref: string, dir: 1 | -1): string {
  const date = parseISO(ref);
  if (mode === "week")  return format(addDays(date, dir * 7), "yyyy-MM-dd");
  if (mode === "month") return format(addMonths(date, dir), "yyyy-MM-dd");
  return format(addYears(date, dir), "yyyy-MM-dd");
}

/** Returns a ref date string appropriate for the current calendar period. */
export function currentRef(mode: PeriodMode): string {
  const now = new Date();
  if (mode === "week")  return format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
  if (mode === "month") return format(startOfMonth(now), "yyyy-MM-dd");
  return format(startOfYear(now), "yyyy-MM-dd");
}
