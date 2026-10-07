# CARE USG Studio

A standalone sonography (USG) reporting studio for **CARE Diagnostics** —
built for Dr Sugandha: pick a study, tap the findings the probe found,
print a premium report in seconds. Ultrasound only — the MRI/CT/X-ray
radiologist workspace lives in the separate
[`DrAbinash/mri-reports`](https://github.com/DrAbinash/mri-reports) repo.

- **Organ-based composer** — 8 study profiles (male / female / child whole
  abdomen, upper, male/female lower, antenatal, early pregnancy) with the
  doctor's own wording per organ
- **Quick-select pathologies** — one tap per finding; chips toggle so an
  organ can carry several pathologies at once (combined findings, merged
  paragraphs, unioned impression + title)
- **Auto impression + PC-PNDT declaration** on obstetric reports
- **LMP calculator** — enter LMP, GA (weeks + days) and EDD (Naegele)
  autofill the biometry slots
- **Register discipline** — every finalized report gets a sequential
  **USG-0001, USG-0002…** number that is never renumbered; back-dated
  scan dates print as performed
- **Follow-up drafts** — one click duplicates a finalized report as a
  fresh editable draft with today's scan date
- **Premium print** — A4 or A5 (half-sheet), premium gradient letterhead
  or classic B/W, scanned signature over the name line, PROVISIONAL
  watermark on drafts
- **Print layout fine-tuning (v6.2)** — Settings → USG Studio: body font
  size, gaps between lines, section spacing (tight/normal/relaxed),
  Technique-row and referral-tagline toggles, letter-pad logo + signature
  image upload. The signature, declaration and footer move to a second
  page only as one block — a lone signature never spills — and the shipped
  defaults keep a full antenatal report (PC-PNDT included) on one A4 page
- **Backup & restore** — one JSON file carries the whole personalisation
  (letterhead, sonologist block, print preferences, custom findings)
- **PIN lock** — no usernames, no reset email; the studio is yours alone

## v5 — the clinical upgrade

- **Patient registry & history** — every report links to a patient
  (name + phone); the Patients tab shows each person's scans, last visit
  and a one-click "New scan" that prefills her details. Blank-phone saves
  never merge into phone'd same-name patients — strangers stay separate.
- **Follow-up diff** — follow-up drafts open with a "Δ vs previous scan"
  panel: measurement moves (14.2 → 15.6 cm), pathologies new/resolved,
  wording changes — no noise ("14.2" = "14.20").
- **Hadlock biometry** — BPD/HC/AC/FL in mm → per-parameter GA, mean GA,
  EFW ± 15% and the scan-implied EDD; one click fills every biometry slot
  (published Hadlock 1984/1985 equations).
- **Bedside calculators** — ovarian/ellipsoid + bladder (PVR) + prostate
  volumes, AFI with oligo/poly categories, ACR TI-RADS 2017 scoring with
  size-based FNA guidance — every result copies to the clipboard.
- **Machine stills** — paste (Ctrl+V), drop or pick 2–4 USG images onto a
  report; they print as a captioned 2-up grid and travel in backups.
- **Crash recovery** — the composer autosaves to this device every ~1.2 s;
  after a crash the banner offers Restore. Ctrl+S saves, Ctrl+Enter
  finalizes, Ctrl+K switches study, "/" jumps to search.
- **Voice dictation** — mic buttons on technique, impression and organ
  findings (Chrome/Edge, en-IN).
- **Audit trail** — every save, finalization, deletion, image change,
  backup and login attempt, append-only, in Settings → Data & activity.
- **Full-clinic backup** — one JSON file with settings, findings, patients,
  every report and still; optional nightly rotation (after 02:00, newest
  14 kept in data/backups/).
- **Editable builtin normals** — retune any organ's normal wording once;
  every future report uses it (reset to builtin anytime).
- **PC-PNDT register export** — the sequential register as CSV or a
  printable A4-landscape page.
- **Insights** — monthly volume, study mix, most frequent findings and top
  referrers (counts only).
- **PDF + WhatsApp** — download any report as a real vector PDF; share it
  via the mobile share sheet or wa.me.
- **QR verification** — finalized reports print a signed QR
  (HMAC over serial + name + date); scanning it opens /verify, which
  confirms the signature and the register entry.
- **Worklist (v6)** — the CARE ERP bill desk's ultrasound orders sync in
  with their demographics (patient, age, sex, phone, address, referral
  doctor, billing status); one click starts a pre-filled report, and
  finalize reports back to the ERP (REPORT_FINAL + billing link),
  retrying automatically until it is accepted.
  **Identity (v6.1):** ERP rows with a blank accession number — the
  normal bill-desk case — import by **careWorklistId** (order identity)
  and **StudyInstanceUID** (imaging identity); accession matching stays
  as the legacy bridge where the ERP populates it. Orthanc links by
  exact StudyInstanceUID first, exact single-hit accession second —
  never patient names, never "first match". Orders without images yet
  stay listed as *Awaiting images*; every skip is counted with a safe
  reason (no patient data) in the sync response and audit log.
  **Demographics (v6.2):** when the ERP bridge sends a blank age or
  referring doctor (the PACS columns are empty on machines without
  demographics loaded), a blank never erases a stored value, and starting
  a report falls back to the patient's most recent local report — a
  repeat patient's age and referral doctor carry forward instead of
  printing "—". The full bill-desk fallback (patients table + billed
  studies) is a small ERP-side patch:
  `docs/erp-bridge-billdesk-demographics.md`.
- **Form F (v6)** — PC-PNDT statutory form with the clinic's fixed details
  pre-filled, demographics auto-populated from the bill desk, GA + result
  lifted from the composer, and the ERP's four-predicate completeness rule
  before print.
- **PACS pull (v6)** — key images picked from the Orthanc study and frozen
  into the report; **“Pull from machine”** fills the biometry slots from the
  machine's DICOM SR (with optional Vision OCR as fallback).
- **Sonologist's Day (v6.1)** — once a year, on the sonologist's birthday
  (Settings → USG Studio, MM-DD, default 01 Sept), the studio opens with a
  small birthday card: her real numbers from the register — reports signed,
  patients cared for, busiest month. Dismissable once per year; a cake icon
  stays in the header for the rest of the day. Clear the field to turn it
  off. Screen-only — never printed.

`formats-usg/` — the doctor's original Word report library, preserved
verbatim — remains the canonical wording reference for curation.

---

## Deploy on Synology (Container Manager)

1. Copy this folder to the NAS, e.g. `/volume1/docker/usg-studio`
2. `cp .env.example .env` — set `STUDIO_PORT` (default **3040**; the MRI
   studio on the same NAS keeps 3090) and, if you want the integrations
   pre-filled on first boot, `CARE_API_BASE`, `CARE_API_KEY`, `ORTHANC_URL`
3. SSH in, then:

   ```bash
   cd /volume1/docker/usg-studio
   sudo docker compose up -d --build
   ```

4. Open `http://<NAS-IP>:3040` → log in with the starter PIN **123456**
   (demo value — change it in Settings → Security immediately) and fill
   Settings → USG Studio (sonologist name, qualification, registration) and
   Settings → Integrations (CARE API key, Orthanc URL — use the Test buttons).

The SQLite database lives in `./data/db` — it survives every rebuild.
Back up that folder and you have every report ever printed. Without the
CARE/Orthanc integrations the studio still works fully standalone; with
them, the bill desk's worklist lands here and the USG machine's images and
measurements flow in from Orthanc.

> **v6 deploy note:** the containers renamed to `usg-reporting-studio` /
> `usg-reporting-caddy` and the default port moved to **3040**. If an older
> deployment is running, stop it (`docker compose down`) before `up -d` so
> the old `usg-studio`/`usg-studio-caddy` containers are replaced cleanly.
> The ERP side needs the one-line `REPORTING_STUDIO_API_KEY=` in its
> `.env`/compose (same key as Settings → Integrations).

### Upgrading from the v1–v3 shared app

If this machine previously ran the synced full radiology app from this
repo, the first boot of v4 runs a one-time cleanup: the unused radiology
tables and MRI/PACS settings columns are dropped, while **every USG
report, custom finding, PIN and setting is preserved** (the migration is
idempotent and runs before the schema push; the entrypoint still refuses
destructive prisma changes as a final guard). Real MRI/CT reports were
never stored here — they belong to the mri-reports deployment.

### If the worklist fills up with "Self/Walk-in · USG Study"

Every order on the worklist is bill-desk truth joined to a scan, so the
referring doctor and the test name only exist on rows CARE sent. Rows that came
from Orthanc alone carry neither — they read `Self/Walk-in` and `USG Study`, and
the composer cannot pick a format from a title like that. A whole clinic day can
appear as 1,300 of these against a handful of real rows.

Two things cause it, and both are now bounded in code:

1. **The sync cursor outran the writes.** A Studio whose `UsgCareOrder` inserts
   are failing still moves `lastSyncAt` forward, so CARE never serves those rows
   again — a gap no error message shows. The cursor now advances only to CARE's
   own serve clock, and only when every row landed; otherwise it holds and the
   rows arrive on the next cycle (after ten held cycles it advances and says so
   in the banner).
2. **The Orthanc fallback swept the archive.** It now imports studies from the
   last three days only, and never a second row for a patient who already has a
   CARE row on that scanning day.

To clear a list that is already flooded (dry run first, it prints the counts):

```
docker exec -w /app usg-reporting-studio node scripts/usg-prune-orthanc-orphans.mjs
docker exec -w /app usg-reporting-studio node scripts/usg-prune-orthanc-orphans.mjs --execute
```

It deletes only rows CARE never sent and that no report or Form F points at.
Then press **Deep sync** in the worklist: it re-reads the backlog page by page
and brings the bill-desk rows — with doctors and test names — back. Every 20
hours the ordinary sync does a bounded version of this on its own.

The same PACS-first ordering used to leave the *format* wrong: a study that
arrives before its bill opens as a draft while its billed procedure is still
blank, so the draft keeps whatever the fallback guessed, and re-opening it
returned that draft untouched even after CARE named the test. Opening a row now
re-resolves the billed format and applies it **only while the draft is
untouched** — no organ tapped, no note typed, no measurement entered, never a
finalized report. If you had already started typing, the format stays as you
left it and the header chip shows what the bill actually says.

### If you forget your PIN

There is deliberately no "forgot my PIN" link on the login screen: this studio
is reachable from outside the clinic, and an unauthenticated reset endpoint
would be a second door into every patient record. The person who can reach the
server shell already owns the studio, so recovery lives there:

```bash
docker exec -w /app usg-reporting-studio node scripts/pin-reset.mjs            # default clinic
docker exec -w /app usg-reporting-studio node scripts/pin-reset.mjs <clinicId> # any other clinic
```

That clears one column (`HospitalSettings.pinHash`) on one row and writes an
`auth.pin_reset` audit entry. Live sessions are left alone, so resetting from
the desk cannot interrupt a report being written on the studio PC. Reload the
browser: the studio asks for a new PIN and logs you straight in.

A studio still on the built-in demo PIN is treated as "setup not finished", so
the setup screen is shown and is allowed to replace it. A PIN you chose yourself
is never replaced by setup — that path is Settings → change PIN, which asks for
the current one first.

### Print

Always tick **“Background graphics”** in the print dialog — that switch
carries the gradient masthead and section bands onto paper. A4 for full
reports, A5 (Settings → USG Studio → Paper size) for short studies.

**Fitting one page (v6.2).** The shipped defaults (10 pt · 1.4 line
height · tight spacing) keep a typical study — even an antenatal scan
with the PC-PNDT declaration — on a single sheet, signature included.
If a long study (echo, twins, many stills) still spills, Settings →
USG Studio → *Print layout — fine-tuning* has the dials: font size,
gaps between lines, section spacing, and the Technique-row toggle.
The trailing block (signature + declaration + footer) always moves to
page two **together**, so a sheet never ends with a lone signature.
Uploading the clinic logo / scanned signature from a file (Settings →
Hospital / USG Studio) stores it inside the studio — no hosting needed.

---

## Daily flow

1. **PIN in** → USG Studio shows the report list (drafts + finalized with
   their register badges)
2. **New Report** → patient strip → pick the study → tap findings per organ
3. **Preview & Print** → **Finalize** → the register number is stamped and
   announced; the report freezes but stays reprintable forever
4. Follow-up visit? **↻ on the list row** → the full report returns as an
   editable draft with today's scan date

Drafts save themselves. Finalized reports are frozen snapshots —
reprintable from the list even years later.

---

## Repository layout

```
src/app/api/…          PIN auth, USG reports & pathologies, backup, settings
src/components/studio/  Lock screen, USG composer (organ cards, chips), settings
src/lib/usg/           studies, composer, pathologies, print engine, LMP, backup
prisma/schema.prisma   SQLite schema (USG reports, custom pathologies, settings)
scripts/usg-v4-cleanup.mjs  idempotent v3→v4 legacy-structure migration
formats-usg/           the doctor's original Word format library (verbatim)
Dockerfile             Synology ARM-ready build (node:20-alpine multi-arch)
Caddyfile              front proxy for the studio
```
