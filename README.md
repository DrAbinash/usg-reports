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

### Print

Always tick **“Background graphics”** in the print dialog — that switch
carries the gradient masthead and section bands onto paper. A4 for full
reports, A5 (Settings → USG Studio → Paper size) for short studies.

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
