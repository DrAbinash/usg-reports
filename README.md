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

`formats-usg/` — the doctor's original Word report library, preserved
verbatim — remains the canonical wording reference for curation.

---

## Deploy on Synology (Container Manager)

1. Copy this folder to the NAS, e.g. `/volume1/docker/usg-studio`
2. `cp .env.example .env` — set `STUDIO_PORT`
3. SSH in, then:

   ```bash
   cd /volume1/docker/usg-studio
   sudo docker compose up -d --build
   ```

4. Open `http://<NAS-IP>:3090` → log in with the starter PIN **123456**
   (demo value — change it in Settings → Security immediately) and fill
   Settings → USG Studio (sonologist name, qualification, registration).

The SQLite database lives in `./data/db` — it survives every rebuild.
Back up that folder and you have every report ever printed. Nothing else
to configure: no ERP bridge, no PACS, no viewer.

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
