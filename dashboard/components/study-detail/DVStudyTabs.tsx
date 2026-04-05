"use client";

import { useState } from "react";
import { DVFindingsTable } from "./DVFindingsTable";
import { cn } from "@/lib/utils";
import type { DVFinding } from "@/lib/types";

interface ReportPair {
  val_findings: string;
  val_impression: string;
  val_protocol: string;
  doc_findings: string;
  doc_impression: string;
}

interface DVStudyTabsProps {
  findings: DVFinding[];
  pair?: ReportPair;
}

function ReportSection({
  title,
  findings,
  impression,
}: {
  title: string;
  findings: string;
  impression: string;
}) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-base">{title}</h3>
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
          Findings
        </h4>
        <div className="whitespace-pre-wrap text-sm leading-relaxed bg-muted/30 rounded-md p-3 font-mono text-xs">
          {findings || "No findings text available."}
        </div>
      </div>
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
          Impression
        </h4>
        <div className="whitespace-pre-wrap text-sm leading-relaxed bg-muted/30 rounded-md p-3 font-mono text-xs">
          {impression || "No impression text available."}
        </div>
      </div>
    </div>
  );
}

type Tab = "findings" | "reports";

export function DVStudyTabs({ findings, pair }: DVStudyTabsProps) {
  const [active, setActive] = useState<Tab>("findings");

  const tabs: { id: Tab; label: string }[] = [
    { id: "findings", label: `Находки (${findings.length})` },
    { id: "reports", label: "Сравнение отчётов" },
  ];

  return (
    <div>
      <div className="flex gap-1 border-b mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={cn(
              "px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              active === tab.id
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {active === "findings" && <DVFindingsTable findings={findings} />}

      {active === "reports" && (
        <div>
          {pair ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ReportSection
                title="Врач (черновик)"
                findings={pair.doc_findings}
                impression={pair.doc_impression}
              />
              <ReportSection
                title="Валидатор (финальный)"
                findings={pair.val_findings}
                impression={pair.val_impression}
              />
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              Тексты отчётов недоступны для этого исследования.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
