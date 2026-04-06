# xAID Internal QA Dashboard — CLAUDE.md

Internal radiology QA dashboard comparing doctor vs validator reports at SimonMed.
Grades discrepancies using a RADPEER-adapted scale (1, 2a, 2b, 3, 4).

---

## Repo layout

```
internal_dashboard/
├── dashboard/                  # Next.js 14 app (App Router, Tailwind, shadcn/ui, recharts)
│   ├── app/
│   │   ├── doctors/            # Doctor leaderboard + per-doctor detail pages
│   │   ├── svod/               # Grade trend over time (week/month/year)
│   │   ├── mips/               # MIPS compliance metrics page
│   │   ├── studies/            # Study list + per-study detail with Visual Diff tab
│   │   └── methodology/        # Grading methodology reference
│   ├── components/
│   │   ├── doctors/            # DoctorGradeBar (split 2b/2b-MIPS), GradeDistributionChart
│   │   ├── mips/               # MIPSClient — summary cards, measure chart, doctor table
│   │   ├── study-detail/       # DVStudyTabs, ReportDiff (EN visual diff)
│   │   ├── svod/               # SvodClient — trend chart with target lines
│   │   └── layout/             # TopNav, DashboardShell, Footer
│   ├── data -> ../analysis/data  # SYMLINK — do not move or recreate
│   └── lib/
│       ├── data.ts             # All data functions — only file that reads JSON
│       ├── types.ts            # TypeScript interfaces
│       └── utils.ts            # pct(), cn()
└── analysis/
    ├── MIPS_CONTEXT.md         # MIPS classification rules for radpeer LLM grader
    ├── classify_2b_mips.py     # Regenerates dv_findings_2b_classified.json
    ├── extract_from_db.py      # Extracts findings from the production database
    ├── analyze_reports.py      # Ad-hoc analysis helpers
    └── data/                   # Source of truth for all dashboard data
        ├── dv_findings.json               # All graded findings (949 records, all grades)
        ├── dv_findings_2b_classified.json # Grade 2b only + mips_related + mips_measure
        └── doctor_validator_pairs.json    # Report texts per study (113 pairs)
                                           # Includes doc_findings_en / doc_impression_en
                                           # for Visual Diff tab (EN translations)
```

---

## Dashboard dev

```bash
cd dashboard
npm install
npm run dev     # localhost:3000 (falls back to :3001 if occupied)
npm run build   # verify production build before committing
```

Always run `npm run build` before pushing — catches TypeScript errors.

---

## Data flow

```
[radpeer-grade skill]
  └─ grades doctor vs validator findings
       └─ export to analysis/data/dv_findings.json

[classify_2b_mips.py]
  └─ reads dv_findings.json
       └─ writes dv_findings_2b_classified.json (adds mips_related + mips_measure)

[dashboard/data symlink → analysis/data]
  └─ Next.js reads all three JSON files at build/request time
```

**dashboard/data is a symlink** — it points to `../analysis/data`. Never copy files manually between `analysis/data/` and `dashboard/data/`. They are the same directory.

---

## Adding new findings data (full cycle)

1. Grade reports using the `xaid-shared-skills:radpeer-grade` skill  
   — load `analysis/MIPS_CONTEXT.md` as context so grader outputs `mips_related` + `mips_measure`
2. Append new records to `analysis/data/dv_findings.json`
3. Re-run MIPS classifier:
   ```bash
   python3 analysis/classify_2b_mips.py
   ```
   This regenerates `analysis/data/dv_findings_2b_classified.json`
4. For Visual Diff to work: populate `doc_findings_en` / `doc_impression_en` in `doctor_validator_pairs.json`  
   (these are English translations of the Russian doctor reports — needed by the diff component)
5. Verify dashboard builds:
   ```bash
   cd dashboard && npm run build
   ```
6. Commit and push:
   ```bash
   git add analysis/data/ && git commit -m "data: add N new findings from [date] batch"
   git push origin main
   ```

---

## MIPS classification

Grade 2b discrepancies are split into:
- **2b-MIPS** — finding falls under an active MIPS/QCDR measure AND the omission involves a required documentation element
- **2b-non-MIPS** — all other grade 2b discrepancies

Active measures (Measure 360 excluded — study-level, not finding-level):

| ID | Measure | Key requirement |
|----|---------|-----------------|
| ACRad44 | Coronary artery calcification on chest CT | Document CAC presence/absence + severity + PCP recommendation |
| 364 | Incidental pulmonary nodules — Fleischner | State follow-up interval + modality OR "no follow-up" |
| 405 | No follow-up for benign abdominal lesions | Explicit "no follow-up" for Bosniak I-II cysts, adrenal adenomas |
| 406 | No follow-up for thyroid nodules <1 cm (inverse) | Do NOT recommend ultrasound for sub-threshold nodules |
| QMM23 | LDCT screening in emphysema patients 50–80 y | State emphysema = independent lung cancer risk + recommend LDCT |

Full rules with examples: `analysis/MIPS_CONTEXT.md`.  
Classification logic (keyword + notes matching): `analysis/classify_2b_mips.py`.

Current stats (as of last data batch):
- Total findings: 949 | Grade 2b: 241 | 2b-MIPS: 62 (6.5% of all)
- Top measure: 364 (45 findings, 72.6% of MIPS-2b)

---

## Component architecture — what lives where

### Adding a new metric to the dashboard

1. Add data function to `dashboard/lib/data.ts` (reads from JSON, no direct fetch calls elsewhere)
2. Add types to `dashboard/lib/types.ts`
3. Create a server page in `dashboard/app/<route>/page.tsx` — call data functions here, pass results to client component
4. Create client component in `dashboard/components/<route>/` — use `"use client"`, recharts for charts, shadcn/ui Card/Table for layout
5. Add nav link to `dashboard/components/layout/TopNav.tsx`

### Key components to know

| Component | What it does |
|-----------|-------------|
| `DoctorGradeBar` | Horizontal stacked bar — splits Grade 2b into 2b (amber-400) and 2b-MIPS (amber-600) |
| `SvodClient` | Trend chart with settable target lines (saved to localStorage) |
| `MIPSClient` | MIPS page — summary cards, bar chart by measure, doctor compliance table |
| `ReportDiff` | Side-by-side word diff — 2-way (Doctor EN vs Validator) or 3-way (+ SimonMed final) |
| `DVStudyTabs` | Tabs on study detail: Findings table + Report Diff |

---

## Git workflow

```
main  ← everyone pushes here (small team, no PRs required)
```

Commit message format:
```
feat(scope): description       # new feature
fix(scope): description        # bug fix
data: description              # data file updates
refactor(scope): description   # code changes without behaviour change
```

Examples:
- `feat(doctors): add 2b-MIPS column to leaderboard`
- `data: add Q1 2026 findings batch`
- `fix(mips): correct ACRad44 keyword matching`

Always pull before starting work:
```bash
git pull origin main
```

---

## Key decisions (don't undo these)

- `dashboard/data` is a **symlink** to `../analysis/data` — one source of truth, no duplication
- `dv_findings_2b_classified.json` is separate from `dv_findings.json` — MIPS page has its own source, existing pages unaffected
- MIPS classification is **rule-based** (not LLM) — deterministic, fast, free to re-run
- Measure 360 excluded from 2b-MIPS — it's a study-level counter, not a per-finding documentation element
- `doc_findings_en` falls back to Russian if empty — Visual Diff still works without translations, just shows RU
- Data files **are committed** to the repo (`.gitignore` no longer excludes `analysis/data/*.json`)
