import { requireSession, getActiveClinicId } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { getStudy } from "@/lib/usg/studies";
import { normaliseState } from "@/lib/usg/composer";
import { resolveColumns } from "@/lib/usg/server";
import { linkPatient, latestKnownDemographics } from "@/lib/usg/patients";
import { audit } from "@/lib/usg/audit";
import { guessStudyKey, isObStudyKey, orderSex, testSuggestsChild } from "@/lib/usg/orderStudy";
import { applyRushNormalStudy, applyRushPreset, studyAllowsRushNormals, type RushPreset } from "@/lib/usg/quickActions";
import { USG_PATHOLOGIES } from "@/lib/usg/pathologies";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Start a report from a bill-desk order — the typist-less entry point.
 * Creates the DRAFT with every demographic the bill desk already knows
 * (name, age, sex, referral doctor, scan date) plus the guessed study, so
 * the doctor's first keystroke is a pathology chip, not a patient header.
 * Idempotent: a second call opens the SAME draft, never a duplicate.
 *
 * Body `{ rushNormal: true }` (or `?rush=1`): pre-fill measurement-free
 * NP normals when the study allows it (abdomen/KUB/TVS…). Obstetric/echo
 * ignore the flag and open with measured normals.
 *
 * Body `{ rushPreset: "fatty-g1" }`: NP + Fatty Gr I · no size (abdomen studies).
 */
export async function POST(req: Request, ctx: Ctx) {
  const guard = await requireSession();
  if (guard) return guard;
  const { id } = await ctx.params;

  const order = await db.usgCareOrder.findUnique({ where: { id } });
  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });
  if (order.ignored) return Response.json({ error: "This order is ignored" }, { status: 400 });

  const url = new URL(req.url);
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const rushPreset = (body.rushPreset === "fatty-g1" ? "fatty-g1" : null) as RushPreset | null;
  const rushNormal =
    body.rushNormal === true ||
    body.rush === true ||
    !!rushPreset ||
    url.searchParams.get("rush") === "1";

  // v6.18 — Orthanc DICOM Fallback for missing demographics
  let orthancAge = order.patientAge;
  let orthancRef = order.referringDoctor;
  if ((!orthancAge || !orthancRef) && order.studyInstanceUid) {
    try {
      const s = await getSettings();
      if (s.orthancUrl) {
        const base = s.orthancUrl.replace(/\/+$/, "");
        const headers: Record<string, string> = { "Content-Type": "text/plain" };
        if (s.orthancUsername) {
          headers.Authorization = `Basic ${Buffer.from(`${s.orthancUsername}:${s.orthancPassword ?? ""}`).toString("base64")}`;
        }
        const lookup = await fetch(`${base}/tools/lookup`, { method: "POST", headers, body: order.studyInstanceUid });
        if (lookup.ok) {
          const ids = await lookup.json();
          if (Array.isArray(ids) && ids.length > 0) {
            const study = await fetch(`${base}/studies/${ids[0]}`, { headers }).then((r) => r.json());
            const tags = study.MainDicomTags || {};
            if (!orthancAge && tags.PatientAge) orthancAge = tags.PatientAge.replace(/^0+/, "");
            if (!orthancRef && tags.ReferringPhysicianName) orthancRef = tags.ReferringPhysicianName;
          }
        }
      }
    } catch {
      /* silent fail */
    }
  }

  // Already started? Open the same draft (rush flag does not rewrite it).
  if (order.reportId) {
    const existing = await db.usgReport.findUnique({ where: { id: order.reportId } });
    if (existing) return Response.json({ report: existing, ob: isObStudyKey(existing.studyKey), rushApplied: false });
  }

  const child = testSuggestsChild(order.testName);
  const studyKey = guessStudyKey(order.testName, order.patientSex === "M" ? "M" : "F", child);
  const study = getStudy(studyKey);
  if (!study) return Response.json({ error: "Unknown study" }, { status: 400 });

  let state = normaliseState({}, studyKey);
  let rushApplied = false;
  let rushPresetApplied: RushPreset | null = null;
  if (rushNormal && studyAllowsRushNormals(study)) {
    const lookup = (key: string) => USG_PATHOLOGIES.find((p) => p.key === key);
    if (rushPreset) {
      const next = applyRushPreset(state, study, rushPreset, lookup);
      if (next) {
        state = next;
        rushApplied = true;
        rushPresetApplied = rushPreset;
      }
    } else {
      const rushed = applyRushNormalStudy(state, study);
      if (rushed) {
        state = rushed;
        rushApplied = true;
      }
    }
  }

  const cols = await resolveColumns(JSON.stringify(state), study.technique);

  const clinicId = await getActiveClinicId();
  const patientId = await linkPatient(order.patientName, order.patientPhone, clinicId);

  // v6.17: Always try latestKnownDemographics as fallback — the CARE ERP
  // may send age but not referringDoctor (or vice versa). We fill whatever
  // is blank from the patient's last local report.
  const prior = await latestKnownDemographics(patientId, order.patientName, clinicId);
  const report = await db.usgReport.create({
    data: {
      clinicId,
      patientName: order.patientName,
      patientAge: orthancAge || order.patientAge || prior.age,
      patientSex: orderSex(order.patientSex, child) === "M" ? "M" : orderSex(order.patientSex, child) === "CHILD" ? "CHILD" : "F",
      referredBy: order.referringDoctor || prior.referredBy || "Self/Walk-in",
      patientId,
      technique: study.technique,
      stateJson: JSON.stringify(state),
      scanDate: order.studyDate,
      ...cols,
    },
  });

  // Keep the ORDER's demographics in step — fill blanks from the fallback.
  if (prior.age || prior.referredBy) {
    await db.usgCareOrder.update({
      where: { id: order.id },
      data: {
        patientAge: orthancAge || order.patientAge || prior.age,
        referringDoctor: orthancRef || order.referringDoctor || prior.referredBy,
      },
    });
  }

  await db.usgCareOrder.update({
    where: { id: order.id },
    data: { reportId: report.id, status: "REPORTING" },
  });
  await audit({
    action: "report.create",
    reportId: report.id,
    patientName: report.patientName,
    detail: `started from bill-desk order ${order.accessionNumber ?? `WL ${order.careWorklistId ?? order.id}`} — ${study.label}${rushPresetApplied === "fatty-g1" ? " (NP + Fatty Gr I)" : rushApplied ? " (NP · no sizes)" : ""}`,
  });

  return Response.json({ report, ob: isObStudyKey(studyKey), rushApplied, rushPreset: rushPresetApplied });
}
