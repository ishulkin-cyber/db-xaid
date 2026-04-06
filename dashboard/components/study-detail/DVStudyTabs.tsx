"use client";

import { useState } from "react";
import { DVFindingsTable } from "./DVFindingsTable";
import { ReportDiff } from "./ReportDiff";
import { cn } from "@/lib/utils";
import type { DVFinding } from "@/lib/types";

interface ReportPair {
  val_findings: string;
  val_impression: string;
  val_protocol: string;
  doc_findings: string;
  doc_impression: string;
  doc_findings_en: string;
  doc_impression_en: string;
}

interface DVStudyTabsProps {
  findings: DVFinding[];
  pair?: ReportPair;
}


type Tab = "findings" | "diff";

export function DVStudyTabs({ findings, pair }: DVStudyTabsProps) {
  const [active, setActive] = useState<Tab>("findings");

  const tabs: { id: Tab; label: string }[] = [
    { id: "findings", label: `Находки (${findings.length})` },
    { id: "diff", label: "Сравнение отчётов" },
  ];

  const noData = (
    <div className="py-8 text-center text-muted-foreground">
      Тексты отчётов недоступны для этого исследования.
    </div>
  );

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

      {active === "diff" && (
        pair ? (
          <>
            {!pair.doc_findings_en && (
              <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Английский перевод протокола врача недоступен — показан оригинал (RU).
              </div>
            )}
            <ReportDiff
              doctorText={pair.doc_findings_en
                ? `${pair.doc_findings_en}\n\n${pair.doc_impression_en}`
                : `${pair.doc_findings}\n\n${pair.doc_impression}`}
              validatorText={`${pair.val_findings}\n\n${pair.val_impression}`}
            />
          </>
        ) : noData
      )}
    </div>
  );
}
