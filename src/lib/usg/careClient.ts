/**
 * CARE ERP bridge (server-only) — the same one-HTTPS-call client the MRI
 * Reporting Studio uses against the ERP's internal reporting-studio
 * endpoints (PR #639, `artifacts/api-server/src/routes/internal-reporting-studio.ts`):
 *
 *   GET  {base}/api/internal/reporting-studio/ping
 *   GET  {base}/api/internal/reporting-studio/worklist?status=pending
 *   GET  {base}/api/internal/reporting-studio/billing-status?accessions=A,B
 *   POST {base}/api/internal/reporting-studio/finalize
 *
 * v6.14: trial-mode relaxation — when careApiBase is set but careApiKey is
 * NOT set, the bridge still connects, but WITHOUT the x-api-key header.
 * The ERP can be configured to accept requests without a key during
 * trial (REPORTING_STUDIO_API_KEY="" on the ERP side). This lets trial
 * clinics sync without configuring an API key.
 * Never throws to the UI — every failure is { ok: false, error }.
 */
import { getSettings } from "@/lib/settings";

export type CareResult<T> = { ok: true; data: T } | { ok: false; error: string };

const TIMEOUT_MS = 10_000;

async function careFetch<T>(path: string, init?: RequestInit): Promise<CareResult<T>> {
  const s = await getSettings();
  // v6.14: only the base URL is required — the API key is optional during trial.
  if (!s.careApiBase) {
    return { ok: false, error: "CARE integration not configured (Settings → Integrations)" };
  }
  const base = s.careApiBase.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(base)) {
    return { ok: false, error: "CARE unreachable (base URL must start with http:// or https:// — e.g. http://172.16.1.139:8888)" };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      ...(init?.headers as Record<string, string> ?? {}),
    };
    // v6.14: only add the API key header when one is configured.
    // During trial, the ERP may accept requests without it.
    if (s.careApiKey) {
      headers["x-api-key"] = s.careApiKey;
    }
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      // Surface the ERP's own message (Match Center 409, PCPNDT 409,
      // 503 key-not-configured) so the doctor knows exactly what to fix.
      let detail = "";
      try {
        const body = (await res.json()) as { error?: string; message?: string };
        detail = body?.error ?? body?.message ?? "";
      } catch {
        /* non-JSON error body */
      }
      const brief = detail ? `: ${detail}` : "";
      return { ok: false, error: `CARE responded ${res.status}${brief}` };
    }
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") return { ok: false, error: "CARE timed out (10s)" };
    if (e instanceof TypeError && /invalid url|failed to parse/i.test(e.message)) {
      return { ok: false, error: "CARE unreachable (invalid base URL — check Settings → Integrations)" };
    }
    return { ok: false, error: "CARE unreachable" };
  } finally {
    clearTimeout(timer);
  }
}

export function pingCare() {
  return careFetch<{ ok: boolean; version?: string }>("/api/internal/reporting-studio/ping");
}

export type CareWorklistItem = {
  /** The ERP-side worklist entry ID. Required in the canonical v6.1+ flow,
   *  but optional so the test for legacy accession-only rows (and any
   *  pre-v6.1 ERP build) keeps compiling. `careSync.normalizeCareRow`
   *  handles a missing worklistId by falling back to accessionNumber. */
  worklistId?: string | null;
  accessionNumber: string;
  patientName: string;
  patientAge?: string | null;
  patientGender?: string | null;
  referringDoctor?: string | null;
  testName?: string | null;
  modality?: string | null;
  studyDate?: string | null;
  studyInstanceUid?: string | null;
  billingStatus?: string | null;
  // v6 bridge extension (ERP PR adds these; older ERP builds omit them)
  patientId?: number | string | null;
  patientPhone?: string | null;
  patientAddress?: string | null;
  billNumber?: string | null;
};

export function fetchWorklist() {
  // v6.14: fetch ALL statuses, not just pending. The ERP's ?status=pending
  // only returned new orders; the doctor needs to see reported/completed
  // orders too (for the day's record, billing follow-up, etc.). The
  // careSync importCareRows function handles status correctly — REPORTED
  // rows are frozen (never updated), PENDING rows are imported/updated.
  // If the ERP doesn't support ?status=all, it will just return pending
  // (which is the current behaviour — no regression).
  return careFetch<CareWorklistItem[]>("/api/internal/reporting-studio/worklist?status=all");
}

export type FinalizePayload = {
  /** The ERP resolves the order by worklistId FIRST, accession second —
   *  blank-accession orders finalize via worklistId alone. Never synthesized. */
  accessionNumber?: string | null;
  worklistId?: string | null;
  reportText: { technique: string; findings: string; impression: string; recommendation?: string };
  radiologistName?: string;
  radiologistRegNumber?: string;
  finalizedAt: string;
  pdfUrl?: string;
};

export function finalizeReport(payload: FinalizePayload) {
  return careFetch<{ ok: boolean }>("/api/internal/reporting-studio/finalize", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchBillingStatus(accessions: string[]) {
  const q = accessions.map(encodeURIComponent).join(",");
  return careFetch<Record<string, string>>(`/api/internal/reporting-studio/billing-status?accessions=${q}`);
}

/**
 * Ultrasound modality filter — mirrors the ERP's isUltrasoundModality()
 * substring rule (USG / US / Ultrasound / Doppler / OB US / Echo / Fetal),
 * applied to the rows the bridge returns. Non-ultrasound rows are simply
 * not this app's business: the MRI studio and this studio each keep their
 * own worklist.
 *
 * v6.14: expanded to catch more modality strings that ERP systems send:
 * - "USG", "US", "Ultrasound", "Sonography", "Sonograph"
 * - "Doppler", "Color Doppler", "Colour Doppler", "Doppler Study"
 * - "Echo", "Echocardiography", "Fetal Echo", "2D Echo"
 * - "OB US", "Obstetric", "Antenatal", "Growth Scan"
 * - "4D US", "3D US", "3D/4D"
 * - Null/empty modality → ACCEPT (some ERPs don't fill modality but the
 *   testName contains "USG"/"Ultrasound"; the importCareRows function
 *   also checks testName as a fallback)
 */
export function isUltrasoundModality(modality: string | null | undefined): boolean {
  if (!modality || !modality.trim()) return true; // v6.14: accept null modality (testName will be checked)
  const m = modality.trim().toLowerCase();
  if (!m) return true;
  // Exact matches
  if (/^(us|usg|ob us|4d us|3d us)$/.test(m)) return true;
  // Substring matches
  if (/ultrasound|sonograph|doppler|echo|fetal|obstetric|antenatal|growth scan/.test(m)) return true;
  return false;
}

/** Normalise the ERP's patientAge ("54/F", "54") into age + sex. */
export function splitAgeSex(raw: string | null | undefined): { age: string; sex: "" | "F" | "M" } {
  const s = String(raw ?? "").trim();
  if (!s) return { age: "", sex: "" };
  const m = s.match(/^(\d{1,3})\s*\/?\s*([FM])$/i);
  if (m) return { age: m[1], sex: m[2].toUpperCase() as "F" | "M" };
  const only = s.match(/^(\d{1,3})$/);
  if (only) return { age: only[1], sex: "" };
  return { age: s, sex: "" };
}
