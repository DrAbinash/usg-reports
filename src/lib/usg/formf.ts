/**
 * formf.ts — PC-PNDT Form F, ported from the CARE ERP's FormF.tsx flow:
 * fixed clinic details pre-filled (centre, registration no, doctor, place),
 * demographics auto-populated from the bill-desk order, GA/result liftable
 * from the composer, the ERP's four-predicate completeness rule, and the
 * statutory A4 print sheet (same layout the ERP prints).
 *
 * Pure functions — the route stores the UsgFormF row, the UI prints the
 * string this module builds through the studio's hidden print iframe.
 */
import type { HospitalSettingsRow } from "@/lib/settings";
import type { UsgComposerState } from "./types";

export type UsgFormFData = {
  centreName: string;
  registrationNo: string;
  billNumber: string;
  accessionNumber: string;
  patientName: string;
  age: string;
  boyCount: string;
  girlCount: string;
  husbandFatherName: string;
  address: string;
  mobile: string;
  referredBy: "Self" | "Doctor";
  referredByName: string;
  lmpWeeks: string;
  geneticHistory: "none" | "specify";
  geneticHistoryDetail: string;
  basisDiagnosisClinical: boolean;
  basisDiagnosisUsg: boolean;
  basisDiagnosisOther: string;
  indicationType: "routine" | "age" | "genetic" | "previous" | "other";
  indicationDetail: string;
  previousChildIssue: string;
  doctorName: string;
  doctorRegNo: string;
  procedure: string;
  procedurePurpose: string;
  invasiveProcedure: "notdone" | "done";
  invasiveProcedureDetail: string;
  complication: "nil" | "specify";
  complicationDetail: string;
  labTests: "notadvised" | "advised";
  labTestsDetail: string;
  gestationalAgeWeeks: string;
  gestationalAgeDays: string;
  ultrasoundResult: "normal" | "abnormal";
  abnormality: string;
  procedureDate: string;
  consentDate: string;
  resultConveyed: string;
  mtpAdvised: "no" | "yes";
  mtpDate: string;
  date: string;
  place: string;
  /** The ERP's four-predicate rule gates finalize on this. */
  idCardVerified: boolean;
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** The doctor's own fixed Form F details, resolved from Settings (ERP hard
 *  defaults as fallback so a fresh install still prints a sane form). */
export function defaultFormF(s: Pick<
  HospitalSettingsRow,
  "pcpndtCentreName" | "pcpndtRegistrationNo" | "pcpndtPlace" | "usgDoctorName" | "usgDoctorRegNo"
>): UsgFormFData {
  return {
    centreName: s.pcpndtCentreName || "CARE DIAGNOSTICS\nSubhash Chowk, Castair's Town, Near Bajla Mahila College, Deoghar\u2013814112",
    registrationNo: s.pcpndtRegistrationNo || "34/2020",
    billNumber: "",
    accessionNumber: "",
    patientName: "",
    age: "",
    boyCount: "",
    girlCount: "",
    husbandFatherName: "",
    address: "",
    mobile: "",
    referredBy: "Self",
    referredByName: "",
    lmpWeeks: "",
    geneticHistory: "none",
    geneticHistoryDetail: "",
    basisDiagnosisClinical: true,
    basisDiagnosisUsg: true,
    basisDiagnosisOther: "",
    indicationType: "routine",
    indicationDetail: "",
    previousChildIssue: "",
    doctorName: s.usgDoctorName || "Dr. Sugandha Priyadarshini",
    doctorRegNo: s.usgDoctorRegNo || "MCI/27962",
    procedure: "Ultrasound - ULTRASONOGRAPHY",
    procedurePurpose: "Obstetric ultrasonography",
    invasiveProcedure: "notdone",
    invasiveProcedureDetail: "",
    complication: "nil",
    complicationDetail: "",
    labTests: "notadvised",
    labTestsDetail: "",
    gestationalAgeWeeks: "",
    gestationalAgeDays: "",
    ultrasoundResult: "normal",
    abnormality: "",
    procedureDate: today(),
    consentDate: "",
    resultConveyed: "Patient / attendant — same day",
    mtpAdvised: "no",
    mtpDate: "",
    date: today(),
    place: s.pcpndtPlace || "DEOGHAR",
    idCardVerified: false,
  };
}

/** Bill-desk order demographics → the form (the openFromQueue prefill). */
export function prefillFormFFromOrder(
  form: UsgFormFData,
  order: {
    accessionNumber: string;
    patientName: string;
    patientAge: string;
    patientPhone: string;
    patientAddress: string;
    billNumber: string;
    referringDoctor: string;
    testName: string;
    studyDate: Date | null;
  },
): UsgFormFData {
  const referred = (order.referringDoctor ?? "").trim();
  const isDoctor = /^dr\.?\s/i.test(referred) || referred.length > 0;
  return {
    ...form,
    accessionNumber: order.accessionNumber,
    billNumber: order.billNumber,
    patientName: order.patientName,
    age: order.patientAge,
    address: order.patientAddress,
    mobile: order.patientPhone,
    referredBy: referred ? "Doctor" : "Self",
    referredByName: referred,
    procedurePurpose: order.testName || form.procedurePurpose,
    procedureDate: order.studyDate ? order.studyDate.toISOString().slice(0, 10) : form.procedureDate,
    date: order.studyDate ? order.studyDate.toISOString().slice(0, 10) : form.date,
  };
}

/**
 * Lift the objective facts from a composer state into the form — the SAME
 * policy as the ERP's applyPrefillSummary: the Gestational Age figure is
 * objective and safe to lift automatically; Normal/Abnormal is suggested
 * from the selected pathologies but the doctor confirms it.
 */
export function applyComposerToFormF(
  form: UsgFormFData,
  state: UsgComposerState,
): UsgFormFData {
  const biometry = state.organs.find((o) => o.organ === "biometry");
  const gravid = state.organs.find((o) => o.organ === "gravid-uterus");
  const gaw = biometry?.vars?.gaw ?? gravid?.vars?.gaw ?? "";
  const gad = biometry?.vars?.gad ?? gravid?.vars?.gad ?? "";
  const hasPathology = state.organs.some(
    (o) => (o.pathologies?.length ?? 0) > 0 || o.pathology != null || o.custom,
  );
  return {
    ...form,
    gestationalAgeWeeks: gaw ? String(Math.round(Number(gaw)) || gaw) : form.gestationalAgeWeeks,
    gestationalAgeDays: gad ? String(Math.round(Number(gad)) || gad) : form.gestationalAgeDays,
    ultrasoundResult: hasPathology ? "abnormal" : form.ultrasoundResult,
  };
}

/** The ERP's four-predicate completeness rule — same wording, same logic
 *  (see CARE pcpndtCompliance.evaluateFormFCompleteness). */
export function evaluateFormFCompleteness(record: {
  idCardVerified: boolean | null;
  husbandFatherName: string | null;
  address: string | null;
  consentDate: string | null;
  procedureDate: string | null;
}): { complete: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!record.idCardVerified) missing.push("ID Card must be verified.");
  if (!record.husbandFatherName?.trim()) missing.push("Husband/Father Name is required.");
  if (!record.address?.trim()) missing.push("Address is required.");
  if (!record.consentDate?.trim() && !record.procedureDate?.trim()) {
    missing.push("Consent Date or Procedure Date is required.");
  }
  return { complete: missing.length === 0, missing };
}

// ── Statutory A4 print sheet ────────────────────────────────────────────────

function esc(v: string): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function blankLine(val: string, width = 120): string {
  return `<span style="display:inline-block;border-bottom:1px solid #333;min-width:${width}px;font-size:10px;font-weight:800;padding-left:2px;vertical-align:bottom">${esc(val) || "&nbsp;"}</span>`;
}

function tick(checked: boolean): string {
  return `<span style="display:inline-block;width:11px;height:11px;border:1px solid #333;margin-right:3px;text-align:center;line-height:11px;font-size:8px;vertical-align:middle">${checked ? "✓" : ""}</span>`;
}

function row(label: string, children: string): string {
  return `<tr style="border-bottom:1px solid #ccc"><td style="padding:2px 4px;font-weight:700;font-size:10px;width:30%;vertical-align:top;white-space:nowrap">${label}</td><td style="padding:2px 4px;font-size:10px;font-weight:700;vertical-align:top">${children}</td></tr>`;
}

function boxCell(val: string): string {
  return `<span style="display:inline-block;border:1px solid #333;width:26px;height:18px;text-align:center;font-size:11px;line-height:18px;vertical-align:middle">${esc(val)}</span>`;
}

function fmtDate(v: string): string {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** Build the complete printable statutory Form F document. */
export function buildFormFPrintHtml(data: UsgFormFData): string {
  const centre = esc(data.centreName.replace(/\n/g, ", "));
  return `<!doctype html><html><head><meta charset="utf-8"><title>Form F — PCPNDT</title>
<style>
@page { size: A4; margin: 0; }
html, body { margin: 0; padding: 0; }
#formf-print {
  width: 210mm; max-width: 210mm; min-height: 297mm;
  padding: 10mm 12mm; box-sizing: border-box;
  font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #000;
  background: #fff; line-height: 1.5;
}
</style></head><body>
<div id="formf-print">
  <div style="text-align:center;border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:8px">
    <div style="font-size:18px;font-weight:700;text-decoration:underline;letter-spacing:1px">FORM F</div>
    <div style="font-size:9px;color:#444;margin-top:2px">[See Proviso to Section 4(3), Rule 9(4) and Rule 10(1A)]</div>
    <div style="font-size:11px;font-weight:600;margin-top:3px">
      FORM FOR MAINTENANCE OF RECORD IN RESPECT OF PREGNANT WOMAN<br/>
      BY GENETIC CLINIC / ULTRASOUND CLINIC / IMAGING CENTRE
    </div>
  </div>

  <table style="width:100%;border-collapse:collapse;margin-bottom:8px"><tbody>
    <tr style="border-bottom:1px solid #ccc">
      <td style="width:55%;padding:4px 6px;vertical-align:top;font-size:10px">
        <span style="font-weight:600">1. Name &amp; address of Centre:&nbsp;</span>
        <span style="font-size:11px;font-weight:700">${centre}</span>
      </td>
      <td style="padding:4px 6px;vertical-align:top;font-size:10px">
        <span style="font-weight:600">2. Reg. No.:&nbsp;</span>${blankLine(data.registrationNo, 120)}
      </td>
    </tr>
    <tr style="border-bottom:1px solid #ccc">
      <td style="padding:4px 6px;font-size:10px"><span style="font-weight:600">3. Patient Name: </span>${blankLine(data.patientName, 200)}</td>
      <td style="padding:4px 6px;font-size:10px"><span style="font-weight:600">Age: </span>${blankLine(data.age, 70)}<span style="font-weight:600"> Yrs</span></td>
    </tr>
    <tr style="border-bottom:1px solid #ccc">
      <td style="padding:4px 6px;font-size:10px"><span style="font-weight:600">5. Husband's/Father's name: </span>${blankLine(data.husbandFatherName, 180)}</td>
      <td style="padding:4px 6px;font-size:10px"><span style="font-weight:600">4. Children:&nbsp;</span>
        <span style="margin-right:10px">Boy:&nbsp;${boxCell(data.boyCount)}</span>
        <span>Girl:&nbsp;${boxCell(data.girlCount)}</span>
      </td>
    </tr>
    <tr style="border-bottom:1px solid #ccc">
      <td style="padding:4px 6px;font-size:10px"><span style="font-weight:600">6. Address: </span>${blankLine(data.address, 240)}</td>
      <td style="padding:4px 6px;font-size:10px"><span style="font-weight:600">Tel: </span>${blankLine(data.mobile, 120)}</td>
    </tr>
    <tr style="border-bottom:1px solid #ccc">
      <td style="padding:4px 6px;font-size:10px"><span style="font-weight:600">7. Referred by:&nbsp;</span>
        ${tick(data.referredBy === "Self")} Self&nbsp;&nbsp;${tick(data.referredBy === "Doctor")} Doctor: ${blankLine(data.referredBy === "Doctor" ? data.referredByName : "", 100)}
      </td>
      <td style="padding:4px 6px;font-size:10px"><span style="font-weight:600">8. LMP/weeks: </span>${blankLine(data.lmpWeeks, 120)}</td>
    </tr>
    <tr style="border-bottom:1px solid #ccc">
      <td colspan="2" style="padding:4px 6px;font-size:10px"><span style="font-weight:600">9. Genetic/medical history:&nbsp;</span>
        ${tick(data.geneticHistory === "none")} No significant history&nbsp;&nbsp;
        ${tick(data.geneticHistory === "specify")} Specify: ${blankLine(data.geneticHistory === "specify" ? data.geneticHistoryDetail : "", 160)}
        &nbsp;&nbsp;<span style="font-weight:600">Basis:&nbsp;</span>
        ${tick(data.basisDiagnosisClinical)} Clinical&nbsp;${tick(data.basisDiagnosisUsg)} USG&nbsp;
        ${tick(!!data.basisDiagnosisOther)} Other: ${blankLine(data.basisDiagnosisOther, 80)}
      </td>
    </tr>
  </tbody></table>

  <div style="font-weight:700;font-size:10px;text-decoration:underline;margin-bottom:4px">10. Indication for pre-natal diagnosis</div>
  <div style="font-size:10px;margin-bottom:6px">
    ${tick(data.indicationType === "routine")} Routine antenatal / clinical indication&nbsp;&nbsp;
    ${tick(data.indicationType === "age")} Advanced maternal age&nbsp;&nbsp;
    ${tick(data.indicationType === "genetic")} Genetic disease&nbsp;&nbsp;
    ${tick(data.indicationType === "previous")} Previous child issue: ${blankLine(data.indicationType === "previous" ? data.previousChildIssue : "", 100)}
    &nbsp;&nbsp;${tick(data.indicationType === "other")} Other: ${blankLine(data.indicationType === "other" ? data.indicationDetail : "", 100)}
  </div>

  <div style="font-weight:700;font-size:10px;text-decoration:underline;margin-bottom:4px">11. Procedures carried out</div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:6px"><tbody>
    <tr style="border-bottom:1px solid #ccc">
      <td style="padding:4px 6px;font-size:10px;width:50%"><span style="font-weight:600">Doctor/Radiologist: </span>${blankLine(data.doctorName, 180)}</td>
      <td style="padding:4px 6px;font-size:10px"><span style="font-weight:600">Non-invasive procedure: </span>${blankLine(data.procedure, 140)}</td>
    </tr>
    <tr style="border-bottom:1px solid #ccc">
      <td style="padding:4px 6px;font-size:10px"><span style="font-weight:600">Purpose: </span>${blankLine(data.procedurePurpose, 200)}</td>
      <td style="padding:4px 6px;font-size:10px"><span style="font-weight:600">Invasive procedure:&nbsp;</span>
        ${tick(data.invasiveProcedure === "notdone")} Not done&nbsp;${tick(data.invasiveProcedure === "done")} Done: ${blankLine(data.invasiveProcedure === "done" ? data.invasiveProcedureDetail : "", 80)}
      </td>
    </tr>
  </tbody></table>

  <table style="width:100%;border-collapse:collapse;margin-bottom:6px"><tbody>
    ${row("12. Complication", `${tick(data.complication === "nil")} Nil&nbsp;&nbsp;${tick(data.complication === "specify")} Specify: ${blankLine(data.complication === "specify" ? data.complicationDetail : "", 140)}`)}
    ${row("13. Lab tests recommended", `${tick(data.labTests === "notadvised")} Not advised&nbsp;&nbsp;${tick(data.labTests === "advised")} Advised: ${blankLine(data.labTests === "advised" ? data.labTestsDetail : "", 140)}`)}
    ${row("14(a). Gestational Age", `<span style="font-size:11px">${esc(data.gestationalAgeWeeks) || "___"} weeks,&nbsp;${esc(data.gestationalAgeDays) || "___"} days</span>`)}
    ${row("14(b). USG result", `${tick(data.ultrasoundResult === "normal")} Normal&nbsp;&nbsp;${tick(data.ultrasoundResult === "abnormal")} Abnormal: ${blankLine(data.ultrasoundResult === "abnormal" ? data.abnormality : "", 160)}`)}
    ${row("15. Date of procedure", blankLine(fmtDate(data.procedureDate), 100))}
    ${row("16. Consent date (invasive)", blankLine(data.consentDate ? fmtDate(data.consentDate) : "N/A", 100))}
    ${row("17. Result conveyed to/date", blankLine(data.resultConveyed, 240))}
    ${row("18. MTP advised/conducted", `${tick(data.mtpAdvised === "no")} No&nbsp;&nbsp;${tick(data.mtpAdvised === "yes")} Yes`)}
    ${row("19. Date MTP carried out", blankLine(data.mtpDate ? fmtDate(data.mtpDate) : "N/A", 100))}
  </tbody></table>

  <div style="display:flex;gap:20px;margin-bottom:6px;font-size:10px">
    <div><span style="font-weight:600">Date: </span>${blankLine(fmtDate(data.date), 90)}</div>
    <div><span style="font-weight:600">Place: </span>${blankLine(data.place, 100)}</div>
    <div style="flex:1;text-align:right"><span style="font-weight:600">Signature &amp; Reg. No. of Doctor: </span>${blankLine(
      data.doctorRegNo ? `${data.doctorName} (Reg. ${data.doctorRegNo})` : data.doctorName,
      180,
    )}</div>
  </div>

  <div style="display:flex;gap:12px;border-top:1.5px solid #666;padding-top:8px">
    <div style="flex:1;border:1px solid #aaa;padding:6px 8px;border-radius:3px">
      <div style="font-weight:700;font-size:10px;text-align:center;text-decoration:underline;margin-bottom:5px">DECLARATION OF PREGNANT WOMAN</div>
      <p style="font-size:9px;line-height:1.5;margin:0">
        I, Ms. ${blankLine(data.patientName, 120)} declare that by undergoing
        ultrasonography/image scanning etc. I do not want to know the sex of my foetus.
      </p>
      <div style="margin-top:14px;font-size:9px">Signature / Thumb impression: ______________________</div>
    </div>
    <div style="flex:1;border:1px solid #aaa;padding:6px 8px;border-radius:3px">
      <div style="font-weight:700;font-size:10px;text-align:center;text-decoration:underline;margin-bottom:5px">DECLARATION OF DOCTOR / PERSON CONDUCTING USG</div>
      <p style="font-size:9px;line-height:1.5;margin:0">
        I, ${blankLine(data.doctorName, 110)} declare that while conducting
        ultrasonography on Ms. ${blankLine(data.patientName, 110)}, I have neither
        detected nor disclosed the sex of her foetus to anybody in any manner.
      </p>
      <div style="margin-top:6px;font-size:9px;font-weight:700;text-align:center">${esc(data.doctorName)}</div>
    </div>
  </div>

  <div style="font-size:8px;color:#666;text-align:center;margin-top:4px">
    *Strike out whichever is not applicable or not necessary*&nbsp;|&nbsp;Reg. No. ${esc(data.registrationNo)}
    ${data.billNumber ? ` | Bill No. ${esc(data.billNumber)}` : ""}
    ${data.accessionNumber ? ` | ${esc(data.accessionNumber)}` : ""}
  </div>
</div>
</body></html>`;
}
