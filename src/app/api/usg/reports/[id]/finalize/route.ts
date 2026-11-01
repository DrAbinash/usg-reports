import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { normaliseState, makeLookup, resolve, selectedPathologies } from "@/lib/usg/composer";
import { needsCommunication, scanForCriticalFindings } from "@/lib/usg/criticalFindings";
import { loadAllPathologies, loadNormalOverrides } from "@/lib/usg/server";
import { buildUsgReportHtml, formatUsgSerial, toUsgPrintSettings } from "@/lib/usg/print";
import { audit } from "@/lib/usg/audit";
import { payloadInputFor, qrDataUrlFor } from "@/lib/usg/qrServer";
import { careFinalizeEnabled, finalizeReport } from "@/lib/usg/careClient";

type Ctx = { params: Promise<{ id: string }> };

function fmtDate(d: Date | null | undefined): string {
  if (!d) return new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export async function POST(req: Request, ctx: Ctx) {
  const guard = await requireSession();
  if (guard) return guard;
  const { id } = await ctx.params;

  const report = await db.usgReport.findUnique({ where: { id } });
  if (!report) return Response.json({ error: "Not found" }, { status: 404 });

  // Re-finalize allowed: rebuilds the snapshot from the CURRENT state + settings.
  const settings = await getSettings();
  const all = await loadAllPathologies();
  const lookup = makeLookup(all);
  const overrides = await loadNormalOverrides();
  const state = normaliseState(safeParse(report.stateJson), report.studyKey, overrides);
  const resolved = resolve(state, lookup, report.technique, overrides);

  // A critical finding is a phone call, not a page in a file. PCPNDT/NMC and
  // ACR guidance expects the referring clinician to be told — and for that to be
  // documented — before the report is signed. The studio already carries the
  // log (the red banner's "Log call"), so this is not a new chore: it is the one
  // place where signing waits for the record, and the composer opens that same
  // form on this refusal so the doctor finishes it in one step and signs. The
  // draft is saved either way.
  //
  // `critical` severity only, and only while the clinic keeps the communication
  // log switched on — an urgent or significant finding never blocks a signature,
  // because a gate that cries wolf gets worked around rather than respected.
  const criticalAlerts = needsCommunication(
    scanForCriticalFindings(
      state.organs.flatMap((o) =>
        selectedPathologies(o).map((key) => ({ key, label: lookup(key)?.label ?? key, organ: o.organ })),
      ),
    ),
  );
  if (criticalAlerts.length && settings.enableCriticalComm !== false) {
    const logged = await db.usgCriticalCommunication.count({ where: { reportId: id } });
    if (logged === 0) {
      const names = criticalAlerts.map((a) => a.pathologyLabel).join(", ");
      await audit({
        action: "report.finalizeBlocked",
        reportId: id,
        patientName: report.patientName,
        detail: `critical finding not yet communicated (${names}) — signing held until the call is logged`,
      });
      return Response.json(
        {
          error: `Critical finding — ${names}. Log the call to the referring doctor, then finalize.`,
          code: "critical_comm_required",
          findings: criticalAlerts.map((a) => ({
            key: a.pathologyKey,
            label: a.pathologyLabel,
            organ: a.organ,
            message: a.message,
          })),
        },
        { status: 409 },
      );
    }
  }

  // Register discipline: the sequential number is stamped at FIRST
  // finalization and never changes afterwards — re-finalize rebuilds the
  // snapshot but keeps the same register number (no renumbering, ever, even
  // if an earlier report is deleted — the max+1 rule leaves gaps, never
  // reuses a printed number).
  //
  // It is taken AFTER the critical gate. The transaction below only reads the
  // high-water mark, so a refusal spent nothing even when it stood above the
  // gate — but `serialNo` is what the toolbar, the PDF filename, the PACS
  // return and a duplicate all read as "this one was signed", so the shape
  // that cannot put a number on an unsigned report is the one to keep, and a
  // test pins the order.
  let serialNo = report.serialNo;
  if (serialNo == null) {
    serialNo = await db.$transaction(async (tx) => {
      const fresh = await tx.usgReport.findUnique({ where: { id }, select: { serialNo: true } });
      if (fresh?.serialNo != null) return fresh.serialNo; // raced finalize already stamped it
      const max = await tx.usgReport.aggregate({ _max: { serialNo: true } });
      return (max._max.serialNo ?? 0) + 1;
    });
  }

  // Machine stills embed into the frozen snapshot at finalization.
  const images = await db.usgReportImage.findMany({
    where: { reportId: id },
    orderBy: { sortOrder: "asc" },
  });

  // Verification QR — signed against the install secret, URL form when the
  // request origin is known so scanning opens the verify page directly.
  const origin =
    req.headers.get("x-forwarded-proto") ?? "http", reqHost = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const qr = await qrDataUrlFor(
    payloadInputFor({ ...report, serialNo }),
    reqHost ? `${origin}://${reqHost}` : null,
  );

  // The sheet is rendered from this object, so storing it is what lets the PDF
  // and any later reprint reproduce the document that was actually signed.
  const printSettings = toUsgPrintSettings({
    ...(settings as unknown as Record<string, unknown>),
    studioId: (settings as { clinicId?: string }).clinicId ?? "default",
  });

  const html = buildUsgReportHtml(
    printSettings,
    {
      name: report.patientName,
      age: report.patientAge,
      sex: report.patientSex,
      referredBy: report.referredBy,
      // The printed date is the day the scan was DONE (back-datable), falling
      // back to the finalization/creation day for older rows.
      date: fmtDate(report.scanDate ?? report.finalizedAt ?? report.createdAt),
      serial: formatUsgSerial(serialNo),
      // Finalized snapshot must never carry the PROVISIONAL watermark.
      provisional: false,
    },
    resolved,
    images.map((i) => ({ dataUrl: i.dataUrl, caption: i.caption })),
    qr ? { dataUrl: qr } : null,
  );

  // An amendment keeps the text it replaces. Re-finalizing used to overwrite
  // reportHtml, findings and impression in place, so the words that were on the
  // paper the first time survived nowhere except in whoever kept a printout —
  // and the signed record then looked as if it had always said this. The
  // superseded version is written in the SAME transaction as its replacement: a
  // version cannot go missing while the new page is being saved, and the new
  // page cannot be saved without the old one being kept.
  // A report is superseded when there is a signed page to supersede — not when
  // its status says FINALIZED, because the normal amendment path is Reopen (which
  // keeps reportHtml and clears status + finalizedAt) then sign again. Keying on
  // the page is what catches that path; keying on the status would silently drop
  // the text of every report amended the way the studio actually amends one.
  const superseded = report.reportHtml != null;
  // What is kept is the text AS SIGNED, which after a Reopen is not what the
  // columns hold any more: every draft save rewrites findings/impression/state,
  // so reading them here would file the new words as the old version and leave
  // the superseded text nowhere. The signed mirror is written at finalize and
  // draft saves cannot touch a signed report; rows signed before it existed fall
  // back to the columns, which were accurate at that signature.
  const keptText = {
    findings: report.signedFindings ?? report.findings,
    impression: report.signedImpression ?? report.impression,
    stateJson: report.signedStateJson ?? report.stateJson,
  };
  const updated = await db.$transaction(async (tx) => {
    if (superseded) {
      const max = await tx.usgReportVersion.aggregate({ where: { reportId: id }, _max: { versionNo: true } });
      await tx.usgReportVersion.create({
        data: {
          reportId: id,
          versionNo: (max._max.versionNo ?? 0) + 1,
          findings: keptText.findings,
          impression: keptText.impression,
          stateJson: keptText.stateJson,
          reportHtml: report.reportHtml,
          printSettingsJson: report.printSettingsJson,
          serialNo: report.serialNo,
          signedAt: report.lastSignedAt ?? report.finalizedAt,
        },
      });
    }
    return tx.usgReport.update({
      where: { id },
      data: {
        status: "FINALIZED",
        reportHtml: html,
        printSettingsJson: JSON.stringify(printSettings),
        finalizedAt: new Date(),
        lastSignedAt: new Date(),
        signedFindings: resolved.sections.map((s) => `${s.label}: ${s.text}`).join("\n\n"),
        signedImpression: resolved.impression.join("\n"),
        signedStateJson: JSON.stringify(state),
        serialNo,
        studyTitle: resolved.title,
        findings: resolved.sections.map((s) => `${s.label}: ${s.text}`).join("\n\n"),
        impression: resolved.impression.join("\n"),
      },
    });
  });
  const keptVersion = await db.usgReportVersion.count({ where: { reportId: id } });
  await audit({
    action: superseded ? "report.amended" : "report.finalize",
    reportId: updated.id,
    serialNo,
    patientName: updated.patientName,
    detail: superseded
      ? `register no. ${formatUsgSerial(serialNo)} re-signed — version ${keptVersion} of the earlier text kept`
      : `register no. ${formatUsgSerial(serialNo)} frozen — reprint only`,
  });

  // v6 CARE bridge: if this report came from a bill-desk order, tell the ERP
  // (REPORT_FINAL + patient_reports + billing link) right away. Failures are
  // non-blocking — the sync route retries every run until the ERP accepts,
  // surfacing its own message (e.g. PCPNDT Form F 409) in the worklist banner.
  //
  // CARE_FINALIZE_ENABLED=0 skips the ERP call entirely (see careClient): the
  // order is still marked REPORTED locally, which is workflow state, not a
  // claim about the ERP. careSyncedAt is left NULL on purpose — that column
  // means "the ERP accepted our finalize" and must never be stamped without
  // an acceptance.
  let careSync: "none" | "sent" | "queued" | "disabled" = "none";
  const order = await db.usgCareOrder.findFirst({ where: { reportId: id } });
  if (order) {
    await db.usgCareOrder.update({ where: { id: order.id }, data: { status: "REPORTED" } });
    if (!careFinalizeEnabled()) {
      careSync = "disabled";
    } else {
      const r = await finalizeReport({
        accessionNumber: order.accessionNumber,
        worklistId: order.careWorklistId,
        reportText: {
          technique: updated.technique ?? "",
          findings: updated.findings ?? "",
          impression: updated.impression ?? "",
          recommendation: "",
        },
        radiologistName: settings.usgDoctorName || "USG Studio",
        radiologistRegNumber: settings.usgDoctorRegNo || undefined,
        finalizedAt: (updated.finalizedAt ?? new Date()).toISOString(),
      });
      if (r.ok) {
        careSync = "sent";
        await db.usgCareOrder.update({ where: { id: order.id }, data: { careSyncedAt: new Date() } });
        await audit({
          action: "worklist.careSync",
          reportId: id,
          serialNo,
          patientName: updated.patientName,
          detail: `ERP accepted finalize for ${order.accessionNumber ?? `WL ${order.careWorklistId ?? "?"}`}`,
        });
      } else {
        careSync = "queued";
        await audit({
          action: "worklist.careSyncQueued",
          reportId: id,
          serialNo,
          patientName: updated.patientName,
          detail: `ERP finalize queued (${r.error}) — retries on every worklist sync`,
        });
      }
    }
  }

  return Response.json({
    report: updated,
    html,
    serialNo,
    careSync,
    // So the composer can say what actually happened: a re-signature that keeps
    // the earlier text is an amendment, not the same save again.
    amendedFrom: superseded
      ? {
          versionNo: keptVersion,
          previousSignedAt: (report.lastSignedAt ?? report.finalizedAt)?.toISOString() ?? null,
        }
      : null,
  });
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
