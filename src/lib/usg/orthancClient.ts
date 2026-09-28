/**
 * Orthanc client (server-only, basic auth, timeouts, never throws) — the
 * same REST/DICOMweb contract the MRI Reporting Studio uses. Orthanc 1.12.x
 * core REST has NO /api prefix; DICOMweb lives under /dicom-web.
 *
 * v6 additions over the MRI port:
 *   - fetchInstanceMetadata() — full DICOM-JSON of one instance, which is
 *     how a DICOM SR's ContentSequence measurement tree is read.
 */
import { getSettings } from "@/lib/settings";

export type OrthancResult<T> = { ok: true; data: T } | { ok: false; error: string };

const TIMEOUT_MS = 10_000;

async function orthancFetch<T>(path: string, timeoutMs = TIMEOUT_MS): Promise<OrthancResult<T>> {
  const s = await getSettings();
  if (!s.orthancUrl) return { ok: false, error: "Orthanc not configured (Settings → Integrations)" };
  const base = s.orthancUrl.trim().replace(/\/+$/, "");
  const headers: Record<string, string> = {};
  // Only send Authorization when a username is configured. This Orthanc has
  // no auth — an empty credential pair must mean "anonymous", never a bogus
  // Basic header that some proxies reject with 401.
  if (s.orthancUsername) {
    headers.Authorization = `Basic ${Buffer.from(`${s.orthancUsername}:${s.orthancPassword ?? ""}`).toString("base64")}`;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}${path}`, { headers, signal: controller.signal, cache: "no-store" });
    if (!res.ok) return { ok: false, error: `Orthanc responded ${res.status}` };
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") return { ok: false, error: `Orthanc timed out (${timeoutMs / 1000}s)` };
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
  MainDicomTags: { StudyInstanceUID?: string; AccessionNumber?: string; StudyDate?: string; StudyTime?: string; StudyDescription?: string };
  /** Orthanc REST spelling */
  PatientMainDicomTags?: { PatientName?: string; PatientID?: string; PatientSex?: string };
  /** Legacy alias kept for older callers/tests */
  PatientMainTags?: { PatientName?: string; PatientID?: string };
};

/** Normalised US study row from DICOMweb (ModalitiesInStudy-aware). */
export type OrthancUsStudyRow = {
  studyInstanceUid: string;
  accessionNumber: string | null;
  patientName: string;
  patientSex: "F" | "M" | "";
  patientAge: string;
  referringDoctor: string;
  testName: string;
  /** YYYY-MM-DD when StudyDate present */
  studyDate: string | null;
  /** HHMMSS when StudyTime present */
  studyTime: string | null;
};

/**
 * List studies with their MainDicomTags (AccessionNumber, StudyInstanceUID).
 *
 * 1. GET /studies            → array of study IDs (no metadata)
 * 2. GET /studies/{id}       → full study resource incl. MainDicomTags
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

const US_MODALITY_TOKENS = new Set(["US", "USG", "OB US", "OBUS", "DOPPLER"]);

function dicomPn(pn: { Value?: unknown[] } | undefined): string {
  const v = pn?.Value?.[0];
  if (!v) return "";
  if (typeof v === "string") return v.replace(/\^+/g, " ").trim();
  const alphabetic = (v as { Alphabetic?: string }).Alphabetic;
  return (alphabetic || "").replace(/\^+/g, " ").trim();
}

function isUsStudyDicomWeb(st: Record<string, { Value?: unknown[] }>): boolean {
  const mods = (st["00080061"]?.Value ?? []).map((m) => String(m).toUpperCase());
  if (mods.some((m) => US_MODALITY_TOKENS.has(m) || m.includes("US") || m.includes("DOPPLER"))) return true;
  const desc = String(st["00081030"]?.Value?.[0] ?? "").toUpperCase();
  return /USG|ULTRASOUND|SONOGRAPH|DOPPLER|OBSTETRIC|ANTENATAL|FETAL|GROWTH/.test(desc);
}

/**
 * Recent ultrasound studies via DICOMweb (sees ModalitiesInStudy).
 * Used to import Orthanc-only US rows into the Studio worklist when CARE
 * has not (yet) billed/linked them — the ERP PACS Worklist shows these as
 * "Unlinked / Study Received", but the reporting-studio bill-desk feed may
 * omit or fail to surface them, leaving Sync as a no-op.
 *
 * The window is queried in closed 3-day chunks with a server-side
 * Modality=US filter. QIDO returns studies in unspecified order and
 * truncates at `limit` — a single open-ended all-modality query let CT/MR
 * studies (or merely older ones) consume the entire budget, so the newest
 * US work never arrived (NAS-verified: 145 US of a 200-limit fetch while
 * ≥200 US studies existed in the window, 123 dated the last two days).
 * Chunks, not `offset` pagination: closed StudyDate ranges + Modality are
 * the two query keys this Orthanc build is proven to accept.
 */
export async function listRecentUltrasoundStudies(
  daysBack = 14,
  limit = 500,
): Promise<OrthancResult<OrthancUsStudyRow[]>> {
  const s = await getSettings();
  if (!s.orthancUrl) return { ok: false, error: "Orthanc not configured (Settings → Integrations)" };

  // Lazy import avoids a dates↔orthanc cycle at module init.
  const { clinicTodayIST, addCalendarDaysYmd } = await import("./dates");
  const todayYmd = clinicTodayIST();
  const fromYmd = addCalendarDaysYmd(todayYmd, -Math.max(0, daysBack));

  const base = s.orthancUrl.trim().replace(/\/+$/, "");
  const headers: Record<string, string> = { Accept: "application/dicom+json" };
  if (s.orthancUsername) {
    headers.Authorization = `Basic ${Buffer.from(`${s.orthancUsername}:${s.orthancPassword ?? ""}`).toString("base64")}`;
  }

  const CHUNK_DAYS = 3;
  const perChunk = Math.min(500, Math.max(1, limit));
  const ranges: { from: string; to: string }[] = [];
  for (let to = todayYmd; ; ) {
    const from = addCalendarDaysYmd(to, -(CHUNK_DAYS - 1));
    ranges.push({ from: from < fromYmd ? fromYmd : from, to });
    if (from <= fromYmd) break;
    to = addCalendarDaysYmd(from, -1);
  }

  const chunks = await Promise.all(
    ranges.map(async ({ from, to }) => {
      const url =
        `${base}/dicom-web/studies?StudyDate=${from.replace(/-/g, "")}-${to.replace(/-/g, "")}` +
        `&Modality=US` +
        `&includefield=00080061,00100010,00100020,00080050,00080090,00081030,0020000D,00100040,00101010,00080030` +
        `&limit=${perChunk}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS * 2);
      try {
        const res = await fetch(url, { headers, signal: controller.signal, cache: "no-store" });
        if (!res.ok) return { ok: false as const, error: `Orthanc DICOMweb responded ${res.status}` };
        const studies = (await res.json()) as Record<string, { Value?: unknown[] }>[];
        if (!Array.isArray(studies)) {
          return { ok: false as const, error: "Orthanc DICOMweb returned an unexpected response" };
        }
        return { ok: true as const, data: studies };
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
          return { ok: false as const, error: "Orthanc DICOMweb timed out" };
        }
        return { ok: false as const, error: "Orthanc unreachable" };
      } finally {
        clearTimeout(timer);
      }
    }),
  );
  const failed = chunks.find((r) => !r.ok);
  if (failed && !failed.ok) return failed;
  const studies = chunks.flatMap((r) => (r.ok ? r.data : []));

  const rows: OrthancUsStudyRow[] = [];
  const seenUid = new Set<string>();
  for (const st of studies) {
    // Server-side Modality=US protects the fetch budget; this client-side
    // check stays the authority on what counts as ultrasound.
    if (!isUsStudyDicomWeb(st)) continue;
    const uid = String(st["0020000D"]?.Value?.[0] ?? "").trim();
    if (!uid || seenUid.has(uid)) continue;
    seenUid.add(uid);
    const rawDate = String(st["00080020"]?.Value?.[0] ?? "").replace(/[^0-9]/g, "");
    const rawTime = String(st["00080030"]?.Value?.[0] ?? "").replace(/[^0-9.]/g, "").split(".")[0] ?? "";
    const accession = String(st["00080050"]?.Value?.[0] ?? "").trim();
    const name = dicomPn(st["00100010"]) || "UNKNOWN";
    const sexRaw = String(st["00100040"]?.Value?.[0] ?? "").toUpperCase();
    rows.push({
      studyInstanceUid: uid,
      accessionNumber: accession || null,
      patientName: name,
      patientSex: sexRaw === "M" ? "M" : sexRaw === "F" ? "F" : "",
      patientAge: String(st["00101010"]?.Value?.[0] ?? "").replace(/[^0-9]/g, ""),
      referringDoctor: dicomPn(st["00080090"]),
      testName: String(st["00081030"]?.Value?.[0] ?? "").trim() || "USG Study",
      studyDate:
        rawDate.length >= 8
          ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
          : null,
      studyTime: rawTime.length >= 4 ? rawTime.slice(0, 6) : null,
    });
  }
  return { ok: true, data: rows };
}

// ── DICOMweb (series/instance browsing + rendered JPEGs) ───────────────────

/** DICOM JSON attribute reader: "0020000E" → first value. */
function attr(o: Record<string, unknown>, tag: string): string {
  const v = (o[tag] as { Value?: unknown[] } | undefined)?.Value;
  return v && v.length ? String(v[0]) : "";
}

const UID_RE = /^[0-9.]+$/;

export type DicomSeries = { uid: string; description: string; modality: string; number: string };
export type DicomInstance = { sopUid: string; instanceNumber: string };

async function dicomWebJson<T>(path: string, timeoutMs = TIMEOUT_MS): Promise<OrthancResult<T>> {
  const s = await getSettings();
  if (!s.orthancUrl) return { ok: false, error: "Orthanc not configured (Settings → Integrations)" };
  const base = s.orthancUrl.replace(/\/+$/, "");
  const headers: Record<string, string> = { Accept: "application/dicom+json" };
  if (s.orthancUsername) {
    headers.Authorization = `Basic ${Buffer.from(`${s.orthancUsername}:${s.orthancPassword ?? ""}`).toString("base64")}`;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
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
 * Full DICOM-JSON of ONE instance via WADO-RS "Retrieve Instance Metadata".
 * This is where a DICOM SR's ContentSequence (0040,A730) measurement tree
 * lives — the tag-level endpoint Orthanc serves for the whole dataset.
 */
export async function fetchInstanceMetadata(
  studyUid: string,
  seriesUid: string,
  sopUid: string,
): Promise<OrthancResult<Record<string, unknown>>> {
  if (!UID_RE.test(studyUid) || !UID_RE.test(seriesUid) || !UID_RE.test(sopUid)) {
    return { ok: false, error: "Invalid UID" };
  }
  const r = await dicomWebJson<Record<string, unknown>>(
    `/studies/${encodeURIComponent(studyUid)}/series/${encodeURIComponent(seriesUid)}/instances/${encodeURIComponent(sopUid)}/metadata`,
    15_000,
  );
  if (!r.ok) return r;
  if (!r.data || typeof r.data !== "object") {
    return { ok: false, error: "Orthanc returned no instance metadata" };
  }
  return r;
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
    headers.Authorization = `Basic ${Buffer.from(`${s.orthancUsername}:${s.orthancPassword ?? ""}`).toString("base64")}`;
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

/** Binary JPEG fetch for streaming through the API to the browser (preview). */
export async function fetchRenderedBuffer(opts: {
  studyUid: string;
  seriesUid: string;
  sopUid: string;
  size?: number;
}): Promise<{ ok: true; buf: Buffer; contentType: string } | { ok: false; error: string }> {
  const r = await fetchRenderedInstance({ ...opts, size: opts.size ?? 700 });
  if (!r.ok) return r;
  const b64 = r.data.slice(r.data.indexOf(",") + 1);
  return { ok: true, buf: Buffer.from(b64, "base64"), contentType: "image/jpeg" };
}
