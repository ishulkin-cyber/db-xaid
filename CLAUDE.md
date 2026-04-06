# xAID Internal QA Dashboard — CLAUDE.md

## Project purpose
Internal radiology QA dashboard comparing doctor vs validator reports at SimonMed.
Grades discrepancies using a RADPEER-adapted scale (1, 2a, 2b, 3, 4).

## Repo layout

```
internal_dashboard/
├── dashboard/          # Next.js 14 app (App Router, Tailwind, shadcn/ui, recharts)
│   ├── app/            # Pages: /doctors, /svod, /mips, /studies, /methodology
│   ├── components/     # UI components
│   ├── data/           # Static JSON data files (source of truth for dashboard)
│   └── lib/            # data.ts (all data functions), types.ts, utils.ts
└── analysis/           # Python scripts for data processing
    ├── MIPS_CONTEXT.md         # MIPS compliance rules for radpeer LLM grader
    ├── classify_2b_mips.py     # Script to classify 2b findings as MIPS/non-MIPS
    └── data/
        ├── dv_findings.json               # 949 graded findings (all grades)
        └── dv_findings_2b_classified.json # 241 grade 2b findings + mips_related + mips_measure
```

## MIPS classification

Grade 2b findings are split into two categories:
- **2b-MIPS**: Finding falls under an active MIPS/QCDR measure AND the omission involves a required documentation element
- **2b-non-MIPS**: All other grade 2b discrepancies

Active measures (Measure 360 excluded — it's study-level, not finding-level):
- **ACRad44** — Coronary artery calcification on chest CT
- **364** — Incidental pulmonary nodules / Fleischner follow-up
- **405** — No follow-up for benign abdominal lesions
- **406** — No follow-up for incidental thyroid nodules <1 cm (inverse measure)
- **QMM23** — LDCT lung cancer screening recommendation in emphysema patients 50–80 y

Full classification rules are in `analysis/MIPS_CONTEXT.md`.

## When grading new reports with radpeer

Load `analysis/MIPS_CONTEXT.md` as context so the grader can output:
- `mips_related: true/false`
- `mips_measure: "364" | "405" | "406" | "ACRad44" | "QMM23" | null`

## Adding new findings data

1. Run grading via the `xaid-shared-skills:radpeer-grade` skill
2. Export results to `analysis/data/dv_findings.json`
3. Re-run `analysis/classify_2b_mips.py` to regenerate `dv_findings_2b_classified.json`
4. Copy both JSON files to `dashboard/data/`
5. Rebuild dashboard: `cd dashboard && npm run build`

## Dashboard dev

```bash
cd dashboard
npm install
npm run dev     # localhost:3000
npm run build   # production build
```

## Key decisions

- `dv_findings_2b_classified.json` is a separate file (not merged into dv_findings.json)
  so existing pages are unaffected and the MIPS page reads its own source
- MIPS classification is rule-based (keyword + notes analysis), not LLM-based, for reproducibility
- Measure 360 (prior CT count) is excluded from 2b-MIPS because it applies at study level
