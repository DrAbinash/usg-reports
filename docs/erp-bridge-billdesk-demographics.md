# ERP Bridge Patch — Bill-Desk Demographics Fallback (age / sex / referring doctor)

> **STATUS: PATCH REQUIRED ON THE ERP** (repo `care-on-synology1`,
> `artifacts/api-server/src/routes/internal-reporting-studio.ts`).
> This is an ERP-side change — it is applied on the NAS with the ERP repo, NOT
> with the USG Studio token. The Studio side of this fix already shipped in
> v6.2 (worklist blank-guard + patient-history fallback at report start).

---

## Symptom

The bill desk registers the patient's **age** and the **referring doctor**, but
the USG Studio's final report prints `—` for both. The CARE ping is green and
the worklist imports fine — only the demographics are blank.

## Root cause (verified in the ERP source)

`GET /api/internal/reporting-studio/worklist` (PR #639, lines ~179–235) selects

```
age             → radiology_worklist.age
sex             → radiology_worklist.sex
referringDoctor → radiology_worklist.referring_doctor
```

`radiology_worklist` is the **PACS-pushed mirror** — those three columns come
from the USG machine's DICOM tags (PatientAge / PatientSex /
ReferringPhysicianName). On a USG machine without demographics loaded they are
blank, so the bridge answers `patientAge: ""`, `patientGender: ""`,
`referringDoctor: ""` even though the bill desk knows both:

- **age / sex** live in `patients.age_value` + `age_unit` / `patients.gender`
  (and `patients.date_of_birth` as text) — the bridge query **already joins
  `patientsTable`** (for phone/address).
- **referring doctor** lives in `radiology_studies.referring_doctor` (set at
  bill-desk registration / MWL) — the bridge query **already joins
  `radiologyStudiesTable`** (for billId/testName).

Nothing else needs to change: same tables, same key — only the SELECT list and
the response mapping.

## The patch

### 1) Widen the SELECT (add three columns; keep existing aliases untouched)

```ts
    const rows = await db
      .select({
        id: radiologyWorklistTable.id,
        accessionNumber: radiologyWorklistTable.accessionNumber,
        patientId: radiologyWorklistTable.patientId,
        patientName: radiologyWorklistTable.patientName,
        patientPhone: patientsTable.phone,
        patientAddress: patientsTable.address,
        patientDob: patientsTable.dateOfBirth,        // ← ADD
        patientAgeValue: patientsTable.ageValue,      // ← ADD
        patientAgeUnit: patientsTable.ageUnit,        // ← ADD
        patientGender: patientsTable.gender,          // ← ADD
        age: radiologyWorklistTable.age,
        sex: radiologyWorklistTable.sex,
        referringDoctor: radiologyWorklistTable.referringDoctor,
        studyReferringDoctor: radiologyStudiesTable.referringDoctor,  // ← ADD
        studyDescription: radiologyWorklistTable.studyDescription,
        modality: radiologyWorklistTable.modality,
        studyDate: radiologyWorklistTable.studyDate,
        studyInstanceUID: radiologyWorklistTable.studyInstanceUID,
        studyId: radiologyWorklistTable.studyId,
        testName: testsTable.name,
        billId: radiologyStudiesTable.billId,
        billNumber: billsTable.billNumber,
        billedTestName: testsTable.name,
      })
```

### 2) Add one helper next to the endpoint

```ts
/** "34" + "YEARS" → "34"; DOB "1992-04-11" → "34" (approx, bill-desk intent). */
function ageFor(r: { age: string | null; patientDob: string | null; patientAgeValue: number | null; patientAgeUnit: string | null }): string {
  if (r.age && r.age.trim()) return r.age.trim();               // 1. PACS said it — trust it
  if (r.patientAgeValue != null && Number.isFinite(r.patientAgeValue)) {
    const unit = (r.patientAgeUnit ?? "").toLowerCase();
    if (unit.startsWith("month")) return `${r.patientAgeValue}M`;
    if (unit.startsWith("day")) return `${r.patientAgeValue}D`;
    return String(r.patientAgeValue);                            // 2. bill desk knows it
  }
  const dob = (r.patientDob ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(dob)) {                          // 3. derive from DOB
    const years = Math.floor((Date.now() - new Date(dob).getTime()) / 31_557_600_000);
    if (years > 0 && years < 130) return String(years);
  }
  return "";
}
```

### 3) Change three lines of the response mapping

```ts
        patientAge: ageFor(r),                                          // was: r.age ?? ""
        patientGender: (r.sex ?? "") || (r.patientGender ?? ""),        // was: r.sex ?? ""
        referringDoctor: (r.referringDoctor ?? "") || (r.studyReferringDoctor ?? ""),  // was: r.referringDoctor ?? ""
```

The USG Studio's `splitAgeSex` already accepts `"34"`, `"34/F"` and the
`"34M"` / `"34D"` paediatric forms; the blank-guard shipped in v6.2 means a
blank never erases a previously stored value, and the patient-history fallback
fills blanks from the studio's own registry.

## Rollout

1. Apply the patch on the ERP repo, rebuild the `care-api` container.
2. Trigger a worklist sync in the USG Studio (Settings → Integrations → Sync,
   or the worklist refresh) — existing PENDING/REPORTING orders pick the
   demographics up on the next sync; REPORTED rows stay frozen (by design).
3. Reports already started keep their stored header — the doctor can retype
   the age/referrer in the composer strip, or re-start from a fresh order.

## Guardrails (unchanged)

- No new tables, no migration, no auth change — read-only SELECT widening.
- PACS/DICOM values still win when present; patients/studies are FALLBACK only.
- No patient data in logs; the bridge contract (PR #639) is additive keys only.
