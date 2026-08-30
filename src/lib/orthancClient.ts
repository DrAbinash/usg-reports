/**
 * Orthanc client (server-only, basic auth, 10s timeout, never throws).
 */
import { getSettings } from "@/lib/settings";

export type OrthancResult<T> = { ok: true; data: T } | { ok: false; error: string };

const TIMEOUT_MS = 10_000;

async function orthancFetch<T>(path: string): Promise<OrthancResult<T>> {
  const s = await getSettings();
  if (!s.orthancUrl) return { ok: false, error: "Orthanc not configured (Settings → Integrations)" };
  const base = s.orthancUrl.trim().replace(/\/+$/, "");
  const headers: Record<string, string> = {};
  // Only send Authorization when a username is configured. This Orthanc has
  // no auth — an empty credential pair must mean "anonymous", never a bogus
  // Basic header that some proxies reject with 401.
  if (s.orthancUsername) {
    headers.Authorization = `Basic ${Buffer.from(`${s.orthancUsername}:${s.orthancPassword}`).toString("base64")}`;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${base}${path}`, { headers, signal: controller.signal, cache: "no-store" });
    if (!res.ok) return { ok: false, error: `Orthanc responded ${res.status}` };
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") return { ok: false, error: `Orthanc timed out (${TIMEOUT_MS / 1000}s)` };
    if (e instanceof TypeError && /invalid url|failed to parse/i.test(e.message)) {
      return { ok: false, error: "Orthanc unreachable (invalid URL — expected like http://172.16.1.139:8042)" };
    }
    return { ok: false, error: "Orthanc unreachable" };
  } finally {
    clearTimeout(timer);
  }
}

export type OrthancStudy = {
  ID: string;
  MainDicomTags: { StudyInstanceUID?: string; AccessionNumber?: string; StudyDate?: string; StudyDescription?: string };
  PatientMainTags?: { PatientName?: string; PatientID?: string };
};

/**
 * List studies with their MainDicomTags (AccessionNumber, StudyInstanceUID).
 *
 * Orthanc 1.12.x core REST API (NO /api prefix):
 *   1. GET /studies            → array of study IDs (no metadata)
 *   2. GET /studies/{id}       → full study resource incl. MainDicomTags
 *
 * PatientMainTags lives on the patient resource and nothing in the app
 * consumes it today, so we deliberately do NOT spend one extra request per
 * study fetching it — the field stays optional on the type.
 *
 * Studies are fetched with bounded concurrency (6); a study that fails to
 * resolve is skipped so one bad row can never fail the whole sync.
 */
const STUDY_CONCURRENCY = 6;

export async function listStudies(): Promise<OrthancResult<OrthancStudy[]>> {
  const ids = await orthancFetch<string[]>("/studies");
  if (!ids.ok) return ids;
  if (!Array.isArray(ids.data)) {
    return { ok: false, error: "Orthanc /studies returned an unexpected response" };
  }
  const out: OrthancStudy[] = [];
  let next = 0;
  const worker = async () => {
    while (next < ids.data.length) {
      const id = String(ids.data[next++]);
      const r = await orthancFetch<OrthancStudy>(`/studies/${encodeURIComponent(id)}`);
      if (r.ok && r.data?.ID && r.data.MainDicomTags) out.push(r.data);
    }
  };
  const workers = Array.from({ length: Math.min(STUDY_CONCURRENCY, ids.data.length) }, worker);
  await Promise.all(workers);
  return { ok: true, data: out };
}

export function testOrthanc() {
  return orthancFetch<{ Name?: string; Version?: string; DatabaseVersion?: number; StorageAreaName?: string }>("/system");
}

// ── DICOMweb (the premium-report image selector soul from CARE R1.3) ─────

/** DICOM JSON attribute reader: "0020000E" → first value. */
function attr(o: Record<string, unknown>, tag: string): string {
  const v = (o[tag] as { Value?: unknown[] } | undefined)?.Value;
  return v && v.length ? String(v[0]) : "";
}

const UID_RE = /^[0-9.]+$/;

export type DicomSeries = { uid: string; description: string; modality: string; number: string };
export type DicomInstance = { sopUid: string; instanceNumber: string };

async function dicomWebJson<T>(path: string): Promise<OrthancResult<T>> {
  const s = await getSettings();
  if (!s.orthancUrl) return { ok: false, error: "Orthanc not configured (Settings → Integrations)" };
  const base = s.orthancUrl.replace(/\/+$/, "");
  const headers: Record<string, string> = { Accept: "application/dicom+json" };
  if (s.orthancUsername) {
    headers.Authorization = `Basic ${Buffer.from(`${s.orthancUsername}:${s.orthancPassword}`).toString("base64")}`;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/dicom-web${path}`, { headers, signal: controller.signal, cache: "no-store" });
    if (!res.ok) return { ok: false, error: `Orthanc DICOMweb responded ${res.status}` };
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Orthanc unreachable" };
  } finally {
    clearTimeout(timer);
  }
}

export async function listDicomSeries(studyUid: string): Promise<OrthancResult<DicomSeries[]>> {
  if (!UID_RE.test(studyUid)) return { ok: false, error: "Invalid Study UID" };
  const r = await dicomWebJson<Record<string, unknown>[]>(`/studies/${encodeURIComponent(studyUid)}/series`);
  if (!r.ok) return r;
  return {
    ok: true,
    data: r.data
      .map((o) => ({
        uid: attr(o, "0020000E"),
        description: attr(o, "0008103E"),
        modality: attr(o, "00080060"),
        number: attr(o, "00200011"),
      }))
      .filter((x) => x.uid)
      .sort((a, b) => Number(a.number || 999) - Number(b.number || 999)),
  };
}

export async function listDicomInstances(studyUid: string, seriesUid: string): Promise<OrthancResult<DicomInstance[]>> {
  if (!UID_RE.test(studyUid) || !UID_RE.test(seriesUid)) return { ok: false, error: "Invalid UID" };
  const r = await dicomWebJson<Record<string, unknown>[]>(
    `/studies/${encodeURIComponent(studyUid)}/series/${encodeURIComponent(seriesUid)}/instances`,
  );
  if (!r.ok) return r;
  return {
    ok: true,
    data: r.data
      .map((o) => ({
        sopUid: attr(o, "00080018"),
        instanceNumber: attr(o, "00200013"),
      }))
      .filter((x) => x.sopUid)
      .sort((a, b) => Number(a.instanceNumber || 99999) - Number(b.instanceNumber || 99999)),
  };
}

/**
 * Fetch a server-rendered JPEG of a DICOM instance (Orthanc WADO-RS /rendered).
 * Returns a base64 data URL so the report snapshot is self-contained forever.
 */
export async function fetchRenderedInstance(opts: {
  studyUid: string;
  seriesUid: string;
  sopUid: string;
  frame?: number | null;
  size?: number;
  quality?: number;
}): Promise<OrthancResult<string>> {
  const { studyUid, seriesUid, sopUid, frame, size = 900, quality = 88 } = opts;
  if (!UID_RE.test(studyUid) || !UID_RE.test(seriesUid) || !UID_RE.test(sopUid)) {
    return { ok: false, error: "Invalid UID" };
  }
  const s = await getSettings();
  if (!s.orthancUrl) return { ok: false, error: "Orthanc not configured (Settings → Integrations)" };
  const base = s.orthancUrl.replace(/\/+$/, "");
  const headers: Record<string, string> = { Accept: "image/jpeg" };
  if (s.orthancUsername) {
    headers.Authorization = `Basic ${Buffer.from(`${s.orthancUsername}:${s.orthancPassword}`).toString("base64")}`;
  }
  const framePath = frame && frame >= 2 ? `/frames/${Math.floor(frame)}` : "";
  const path = `/dicom-web/studies/${encodeURIComponent(studyUid)}/series/${encodeURIComponent(seriesUid)}` +
    `/instances/${encodeURIComponent(sopUid)}${framePath}/rendered?viewport=${size},${size}&quality=${quality}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(`${base}${path}`, { headers, signal: controller.signal, cache: "no-store" });
    if (!res.ok) return { ok: false, error: `Orthanc render responded ${res.status}` };
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 500) return { ok: false, error: "Orthanc returned an empty render" };
    return { ok: true, data: `data:image/jpeg;base64,${buf.toString("base64")}` };
  } catch {
    return { ok: false, error: "Orthanc unreachable" };
  } finally {
    clearTimeout(timer);
  }
}
