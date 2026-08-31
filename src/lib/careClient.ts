/**
 * CARE ERP bridge (server-only). One HTTPS call with API key.
 * Never throws to the UI — every failure is { ok: false, error }.
 */
import { getSettings } from "@/lib/settings";

export type CareResult<T> = { ok: true; data: T } | { ok: false; error: string };

const TIMEOUT_MS = 10_000;

async function careFetch<T>(path: string, init?: RequestInit): Promise<CareResult<T>> {
  const s = await getSettings();
  if (!s.careApiBase || !s.careApiKey) {
    return { ok: false, error: "CARE integration not configured (Settings → Integrations)" };
  }
  const base = s.careApiBase.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(base)) {
    return { ok: false, error: "CARE unreachable (base URL must start with http:// or https:// — e.g. http://172.16.1.139:8888)" };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        "x-api-key": s.careApiKey,
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      // Surface the ERP's own message (e.g. Match Center 409, PCPNDT 409,
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
  worklistId: string;
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
};

export function fetchWorklist() {
  return careFetch<CareWorklistItem[]>("/api/internal/reporting-studio/worklist?status=pending");
}

export type FinalizePayload = {
  accessionNumber: string;
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
