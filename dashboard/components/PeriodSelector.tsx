"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { ChevronLeft, ChevronRight, GitCompareArrows } from "lucide-react";
import { shiftPeriod, type PeriodMode } from "@/lib/period";
import { cn } from "@/lib/utils";

interface Props {
  mode: PeriodMode;
  ref_: string;         // current ref date string
  label: string;        // current period display label
  compareEnabled: boolean;
}

const MODES: { value: PeriodMode; label: string }[] = [
  { value: "week",  label: "Неделя" },
  { value: "month", label: "Месяц" },
  { value: "year",  label: "Год" },
];

export function PeriodSelector({ mode, ref_, label, compareEnabled }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const push = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === null) params.delete(k);
        else params.set(k, v);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const prevRef = shiftPeriod(mode, ref_, -1);
  const nextRef = shiftPeriod(mode, ref_, 1);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Mode tabs */}
      <div className="flex rounded-lg border bg-muted p-0.5 gap-0.5">
        {MODES.map((m) => (
          <button
            key={m.value}
            onClick={() => push({ period: m.value, ref: null, compare: compareEnabled ? "1" : null })}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              mode === m.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Period navigation */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => push({ ref: prevRef })}
          className="rounded-md p-1.5 hover:bg-accent transition-colors"
          aria-label="Предыдущий период"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-[160px] text-center text-sm font-medium tabular-nums">
          {label}
        </span>
        <button
          onClick={() => push({ ref: nextRef })}
          className="rounded-md p-1.5 hover:bg-accent transition-colors"
          aria-label="Следующий период"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Compare toggle */}
      <button
        onClick={() => push({ compare: compareEnabled ? null : "1" })}
        className={cn(
          "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
          compareEnabled
            ? "border-blue-500 bg-blue-50 text-blue-700"
            : "border-border text-muted-foreground hover:text-foreground hover:bg-accent"
        )}
      >
        <GitCompareArrows className="h-4 w-4" />
        Сравнить с прошлым периодом
      </button>
    </div>
  );
}
