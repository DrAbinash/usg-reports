# CARE ERP ↔ Reporting Studio Bridge — Server-Side Endpoints

> **STATUS: SHIPPED** — implemented in the ERP as **PR #639** (commit `568f866d`,
> merged 30 Aug 2026): `artifacts/api-server/src/routes/internal-reporting-studio.ts`.
> This document is kept as the contract reference for the Studio side.
>
> Highlights of the shipped implementation:
> - Auth via `x-api-key` + `REPORTING_STUDIO_API_KEY` (503 when unset, 401 on mismatch).
> - Mounted **before** the `/internal` radiology catch-all so staff auth doesn't intercept.
> - `POST /finalize` is idempotent (repeat finalize → `{ ok: true, idempotent: true }`),
>   creates `patient_reports` rows, sets `REPORT_FINAL`, writes a `REPORT_FINAL` audit log entry,
>   and guards on Match Center identity + PCPNDT Form F (obstetric USG) with clear 409 messages.
> - `GET /billing-status` resolves accessions on both the worklist and billed-studies tables.
>
> Ops to connect: set `REPORTING_STUDIO_API_KEY` in the ERP compose/.env, paste the same
> key into Studio Settings → Integrations. 11/11 Vitest bridge tests passed at merge.

---

## Context

CARE Reporting Studio (deployed separately on Synology) needs read access to the
radiology worklist and a notification hook when a report is finalized. The Studio
authenticates with a single static API key sent as the `x-api-key` header.

**Rules:**
- Read `src/routes/internalAuth.ts` first and reuse its guard pattern exactly — do NOT invent a new auth scheme.
- The endpoints are read-mostly; only `finalize` writes, and it must reuse the existing billing-link logic (`src/lib/pacs/worklistBillingLink.ts`), never duplicate it.
- No new tables. No UI. No migration.

---

## TASK — Add `src/routes/internalReportingStudio.ts`

Create one route file exposing four endpoints. Mount it wherever `internal-radiology.ts`
is mounted (same router prefix style).

### 0. Guard

```ts
// Reuse the existing internal-auth helper; if it doesn't support static keys,
// add this minimal guard (env REPORTING_STUDIO_API_KEY must be set):
function requireStudioKey(req, res, next) {
  const key = process.env.REPORTING_STUDIO_API_KEY;
  if (!key) return res.status(503).json({ error: "REPORTING_STUDIO_API_KEY not configured" });
  if (req.header("x-api-key") !== key) return res.status(401).json({ error: "unauthorized" });
  next();
}
```

Generate the key once: `openssl rand -hex 24`. Add to the ERP's env/compose:
`REPORTING_STUDIO_API_KEY=<that value>`.

### 1. `GET /api/internal/reporting-studio/ping`

Returns `{ ok: true, version }`. `version` = the ERP's package version.
Use this exact shape — the Studio's Test button expects it.

### 2. `GET /api/internal/reporting-studio/worklist?status=pending&since=<iso>`

Returns the studies that are ordered but not yet reported. Discover the real
worklist table by reading the existing handlers in `src/routes/radiology.ts` and
`src/lib/pacs/worklistBillingLink.ts`; map their ACTUAL columns into this shape:

```json
[
  {
    "worklistId": "row id (string)",
    "accessionNumber": "the study accession",
    "patientName": "…", "patientAge": "54/F" | "54", "patientGender": "F",
    "referringDoctor": "Dr. …",
    "testName": "MRI Lumbosacral Spine",
    "modality": "MR" | "CT",
    "studyDate": "2026-08-29T04:30:00.000Z",
    "studyInstanceUid": "1.2.840… (nullable)",
    "billingStatus": "PAID" | "DUE" | "UPI_PENDING" | null
  }
]
```

- `status=pending` = the worklist states that mean "awaiting report" in this ERP.
  Exclude finalized/reported rows.
- Billing status requires the join the billing-link helper already performs — call it,
  don't re-implement it.
- `since` is optional: return only rows updated after it (Studio sends its last sync time).
  If the table lacks an updatedAt column, ignore the param and return everything pending.

### 3. `POST /api/internal/reporting-studio/finalize`

Body:
```json
{
  "accessionNumber": "CARE-24081",
  "worklistId": "…",
  "reportText": { "technique": "…", "findings": "…", "impression": "…", "recommendation": "…" },
  "radiologistName": "Dr. Abinash",
  "radiologistRegNumber": "…",
  "finalizedAt": "2026-08-29T10:30:00.000Z",
  "pdfUrl": "https://reports.caredeoghar.com/… (optional)"
}
```

Behavior — find the existing "report finalized → billing row created" flow inside
the radiology worklist handlers and invoke THE SAME internal function:
1. Mark the worklist row reported/finalized (set whatever status/columns the ERP's
   own finalize path sets).
2. Create or link the billing row exactly as the ERP does when a report is
   finalized from its own UI (this is the worklistBillingLink flow).
3. If `pdfUrl` is present, store it on the worklist row so the ERP's report view
   can deep-link to the Studio's print page.
4. Respond `{ ok: true }` on success, `{ ok: false, error }` with a clear message otherwise.

The Studio retries this call automatically on every worklist sync until it succeeds —
the endpoint must therefore be idempotent: a repeat finalize for an already-reported
accession returns `{ ok: true }` without creating a duplicate billing row.

### 4. `GET /api/internal/reporting-studio/billing-status?accessions=A,B,C`

Returns `{ "A": "PAID", "B": "DUE" }` — a map for the accession list. Reuse the same
billing-status lookup as #2. Unknown accessions may be omitted from the map.

---

## Wiring the Studio

In the Studio (already built): Settings → Integrations →
- API base URL = the ERP's scheme+host+port, WITHOUT a trailing `/api`
  (LAN: `http://172.16.1.139:8888` — the Studio appends `/api/internal/...` itself)
- API key = the generated key

Press **Test connection** — it calls `ping` and shows a green/red inline result.
Error bodies from the ERP (Match Center 409, PCPNDT 409, 503 key-not-configured)
are surfaced verbatim in the Studio's sync banner.

## Security notes

- The key is stored server-side in the Studio DB and never returned to the browser (masked).
- The ERP endpoints must NOT be behind the ERP's browser session auth — the Studio has
  no session, only the key. If `internalAuth.ts` already does header-key auth, align with it.
- Revoke and rotate the key if it ever leaks.

---

## USG Studio v6 addendum

This studio (usg-reports) consumes the SAME bridge as the MRI studio:

- `GET /worklist?status=pending` — ultrasound rows only (USG/US/Doppler
  substring rule); each row is upserted into `UsgCareOrder` by accession.
- `POST /finalize` — fired at local finalization and retried on every
  worklist sync until the ERP accepts (idempotent server-side). A PCPNDT
  409 means: complete Form F in the ERP (this studio's own Form F module
  mirrors that record for printing, but the ERP's `form_f_records` row is
  the gate the ERP enforces).
- `GET /billing-status` — refreshes the PAID/DUE badges of open rows.

The ERP worklist rows additionally carry (additive, optional — ERP PR
"reporting-studio worklist carries bill-desk demographics"):
`patientId`, `patientPhone`, `patientAddress`, `billNumber`. Older ERP
builds omit them; this studio simply prefills less.

Ops: on the ERP side set `REPORTING_STUDIO_API_KEY=<openssl rand -hex 24>`;
in this studio paste the same key under Settings → Integrations together
with the ERP base URL (no `/api`), then press Test connection.
