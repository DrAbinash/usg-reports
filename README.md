# CARE Reporting Studio

A single-radiologist MRI/CT reporting workspace for **CARE Diagnostics** —
built for speed: pick a report format, adjust with phrase chips or voice,
select key images from DICOM, print a premium A4 report in seconds.

- **Worklist** — CARE orders joined with Orthanc studies by accession
  (To report / Awaiting images / Unlinked, one-click match)
- **One-tap complete reports** — “MRI Brain Normal” or
  “Fazekas Gr 1 + Senile Changes” fills study, technique, findings,
  impression & recommendation instantly
- **Findings composer** — phrase chips with level/side/severity,
  same-slot replacement (never duplicated), auto-compiled impression
- **Voice to text** — dictate findings & impression (Chrome/Edge)
- **Key images in the report** — pick from DICOM (rendered by Orthanc),
  capture the viewer, or upload/paste; images print inside the report
- **Premium print** — bright bold A4 report with hospital masthead,
  numbered section bands and image grid (glossy-paper grade)
- **Billing link** — finalize creates the billing row in CARE ERP
  (local-first: the report is never lost if CARE is down)

The study heading stays short (**MRI BRAIN**) — the composed phrase
(*“MRI BRAIN WITH FAZEKAS GRADE 1 CHANGES AND SENILE CHANGES”*) prints as
the bold opening line of the Findings section.

---

## Deploy on Synology (Container Manager)

1. Copy this folder to the NAS, e.g. `/volume1/docker/care-studio`
2. `cp .env.example .env` — set `STUDIO_PORT` and `OHIF_UPSTREAM`
3. SSH in, then:

   ```bash
   cd /volume1/docker/care-studio
   sudo docker compose up -d --build
   ```

4. Open `http://<NAS-IP>:3090` → first run asks you to **create a PIN**
   and fill Settings → Identity (hospital name, address, radiologist).

The SQLite database lives in `./data/db` — it survives every rebuild.
Back up that folder and you have every report ever printed.

### Connect the hospital

**Settings → Integrations** (all tested with one click from the same screen):

| Setting | Example | For |
|---|---|---|
| CARE API base | `http://172.16.1.139:8888` | Worklist + finalize billing |
| CARE internal API key | *(from CARE ERP .env)* | Authorises the bridge |
| Orthanc URL | `http://172.16.1.139:8042` | Study matching + DICOM image picker |
| Orthanc user / password | `admin` / … | DICOMweb rendering |
| OHIF LAN URL | `http://172.16.1.139:3010` | Embedded viewer (hospital) |
| OHIF Tailscale URL | `https://…ts.net` | Embedded viewer (from home) |

**CARE ERP side**: the studio needs the three bridge endpoints from
`docs/care-erp-bridge.md` (ping / worklist / finalize). Paste that spec
into Cursor on the CARE repo once — everything else is already in place.

### Key images — three ways

1. **From DICOM** (recommended) — browse the study’s series, tap image
   numbers, add. Orthanc renders the slice; the report freezes it forever.
2. **Capture** — the camera button in the viewer panel grabs the current
   OHIF viewport (needs OHIF served under `/ohif` on the studio origin —
   see the Caddyfile note; otherwise use From DICOM).
3. **Upload / paste** — any screenshot or image file, Ctrl+V works too.

### Voice to text

Works in Chrome and Edge over **HTTPS or localhost** (microphone security
rule). On the hospital LAN open the studio through Tailscale
(`https://…ts.net`) for dictation, or use the plain HTTP address for
everything else.

### Print

Always tick **“Background graphics”** in the print dialog — that switch
carries the blue masthead and section bands onto paper. Use A4, and for
the glossy look: photo paper + “Best” quality.

---

## Daily flow

1. **PIN in** → Worklist shows CARE orders (billing badge on each)
2. Tap a study → **Report format** → *Normal* or a variant (e.g. Fazekas)
3. Adjust: phrase chips, dictated findings, key images
4. **Preview & Print A4** → **Finalize & bill** → back to the worklist

Drafts save themselves. The finalized report is frozen — reprintable from
the **Library** forever, even if CARE or Orthanc change.

---

## Repository layout

```
src/app/api/…        PIN auth, worklist sync, findings, formats, images, DICOM proxy
src/components/studio/  Lock screen, worklist, editor, viewer, picker, print overlay
src/lib/             compile/slot logic, print engine, CARE & Orthanc clients, seeds
prisma/schema.prisma SQLite schema (reports, findings, formats, key images)
Dockerfile           Synology ARM-ready build (node:20-alpine multi-arch)
Caddyfile            Studio + optional same-origin /ohif viewer
```

*For the previous MRI Report Manager app, see the `legacy-mri-reports` tag.*
