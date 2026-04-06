# MIPS Context for Grade 2b Classification

Radiology reports at SimonMed must satisfy MIPS/QCDR quality measures.
A Grade 2b discrepancy is classified as **2b-MIPS** when the finding falls under
one of the active measures below AND the omission/difference involves a documentation
element required by that measure.

All other Grade 2b discrepancies are classified as **2b-non-MIPS**.

---

## Active MIPS Measures (ACRad44, 364, 405, 406, QMM23)

> Measure 360 (prior CT count) is excluded from 2b-MIPS classification —
> it applies at the study level, not at the finding level.

---

### ACRad44 — Coronary Artery Calcification on Chest CT

**Applies to:** Non-cardiac chest CT, patients ≥18 years.

**Required documentation:**
1. Presence OR absence of coronary artery calcification (CAC)
2. If CAC present: qualitative severity grade (mild / moderate / severe) **plus** recommendation for PCP consultation for cardiovascular risk assessment  
   OR quantitative ordinal assessment for all four arteries (LAD, LCx, RCA, LM)

**2b-MIPS triggers:**
- CAC present but no severity grade documented
- CAC present but no PCP/cardiovascular risk recommendation added
- CAC assessment omitted entirely (if still graded 2b due to no management change)
- Severity grade differs between reports (e.g., mild vs moderate) when both are plausible

**Non-MIPS examples:**
- Coronary artery bypass graft (CABG) noted by one report only — surgical history, not a CAC measure item

---

### 364 — Incidental Pulmonary Nodules (Fleischner Society)

**Applies to:** CT scans with incidental pulmonary nodules, patients ≥35 years.

**Required documentation:**
1. Specific follow-up interval AND modality (e.g., "CT in 6 months")  
   OR explicit statement: "No follow-up required per Fleischner Society 2017"
2. Recommendation basis: nodule size, morphology (solid / ground-glass / part-solid), count, patient risk

**Fleischner thresholds (solid nodules):**
| Size | Low risk | High risk |
|------|----------|-----------|
| <6 mm | No follow-up | No follow-up |
| 6–8 mm | CT 6–12 months | CT 6–12 months, then 18–24 months |
| >8 mm | CT 3 months / PET-CT / biopsy | CT 3 months / PET-CT / biopsy |

Sub-6 mm micronodules: no follow-up recommended in most patients.

**2b-MIPS triggers:**
- Nodule present but no follow-up recommendation stated (neither follow-up nor "no follow-up")
- Nodule documented but wrong Fleischner interval cited (e.g., 12 months for a stable 6 mm nodule)
- Micronodule omitted but below Fleischner threshold — 2b because the finding omission touches Measure 364 scope even if no follow-up was needed
- Follow-up recommended when not required (e.g., for <6 mm in low-risk patient) — touches inverse-compliance aspect
- Oncology context not recognized: Fleischner cited when oncology protocol applies instead

**Non-MIPS examples:**
- Pure size measurement difference (<1 mm) with same follow-up conclusion
- Different morphology language (e.g., "centrilobular" vs "peribronchial") with no follow-up change

---

### 405 — No Follow-up for Benign Abdominal Lesions

**Applies to:** CT/MRI studies, patients ≥18 years, with incidental benign lesions.

**Covered lesion types:**
- Simple renal cysts (Bosniak I or II): homogenous, -10 to +20 HU, no septations/nodules/calcifications
- Adrenal lesions ≤1.0 cm: automatically benign
- Adrenal lesions 1.0–4.0 cm: benign if ≤10 HU on non-contrast CT, or MRI signal loss, or washout protocol confirms adenoma

**Required documentation:**
- Explicit phrase: "No follow-up imaging recommended" or equivalent clear statement

**2b-MIPS triggers:**
- Benign lesion described correctly but no explicit "no follow-up" statement
- Benign lesion omitted entirely (but graded 2b because no clinical impact)
- Doctor notes thickening/finding without characterizing it as benign adenoma and without a no-follow-up recommendation

**Non-MIPS examples:**
- Minor descriptive difference in a lesion that both reports characterize the same way with same recommendation

---

### 406 — No Follow-up for Incidental Thyroid Nodules <1 cm (INVERSE measure)

**Applies to:** CT/MRI of neck or chest with incidental thyroid nodules, no known thyroid disease.

**This is an INVERSE measure: the correct outcome is NOT recommending follow-up.**

**Age-based thresholds:**
- Patients <35 years: follow-up only if nodule ≥1.0 cm
- Patients ≥35 years: follow-up only if nodule ≥1.5 cm
- Exception: pathological lymph nodes, invasion, or suspicious morphology → then workup is appropriate

**2b-MIPS triggers:**
- Thyroid nodule <1 cm documented but recommendation appropriately absent in one report (correct per measure)
- Thyroid nodule omitted but size is below follow-up threshold (no management change = 2b, not 3)
- Discrepancy in whether to recommend ultrasound for a nodule near the threshold

**Non-MIPS examples:**
- Description of thyroid lobectomy/surgical absence (anatomical variant, not a nodule)
- Substernal extension of a known lesion — anatomical detail, not a nodule follow-up decision

---

### QMM23 — LDCT Lung Cancer Screening Recommendation in Emphysema

**Applies to:** Chest CT with emphysema, patients 50–80 years.

**Required documentation:**
1. Statement that pulmonary emphysema is an independent risk factor for lung cancer
2. Recommendation to consider the patient for low-dose CT (LDCT) lung cancer screening
3. Note that current CT may serve as baseline

**2b-MIPS triggers:**
- Emphysema documented but no LDCT screening recommendation added
- LDCT recommendation present in one report but absent in the other (without management change)

**Non-MIPS examples:**
- Different emphysema severity grading (mild vs moderate) with no difference in LDCT recommendation
- Emphysema characterization difference (centrilobular vs paraseptal) without recommendation difference
- One report mentions emphysema, the other doesn't, but neither provides LDCT recommendation — both are non-compliant, discrepancy is not about the MIPS element specifically

---

## Classification Decision Rule

```
For a Grade 2b record:

1. Does the finding_category involve:
   - Coronary artery calcification → check ACRad44
   - Pulmonary nodule / micronodule / Fleischner → check 364
   - Renal cyst / adrenal lesion → check 405
   - Thyroid nodule / thyroid finding → check 406
   - Emphysema → check QMM23

   If NO → classify as 2b-non-MIPS

2. Does the specific discrepancy involve:
   - A missing or incorrect required documentation element (follow-up statement,
     recommendation, severity grade, guideline citation)?

   If YES → classify as 2b-MIPS, tag measure ID
   If NO (pure characterization/wording difference, same documentation) → 2b-non-MIPS
```

---

## Output Fields

When classifying a finding, add:
- `mips_related`: `true` / `false`
- `mips_measure`: `"ACRad44"` / `"364"` / `"405"` / `"406"` / `"QMM23"` / `null`
