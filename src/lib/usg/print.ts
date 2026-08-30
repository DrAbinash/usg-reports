/**
 * USG report — PREMIUM A4 print document.
 *
 * Same letterhead language as the MRI report (blue gradient masthead, banded
 * sections, impression highlight box) with the sonography report structure
 * the doctor has used for years: patient strip → machine line → organ-wise
 * findings → impression → suggestions → sonologist signature → declaration.
 */
import type { UsgResolved } from "./types";

export type UsgPrintSettings = {
  appTitle: string;
  hospitalName: string;
  addressLine: string;
  phone: string;
  email: string;
  logoUrl: string;
  footerMessage: string;
  usgDoctorName: string;
  usgDoctorQual: string;
  usgDoctorRegNo: string;
  usgMachineLine: string;
  usgShowMachine: boolean;
  usgFooterLine: string;
  usgDeclarationLine: string;
};

export type UsgPrintPatient = {
  name: string;
  age: string;
  sex: string;
  referredBy: string;
  date: string; // pre-formatted
};

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildUsgReportHtml(
  settings: UsgPrintSettings,
  patient: UsgPrintPatient,
  resolved: UsgResolved,
): string {
  const logo = settings.logoUrl
    ? `<img src="${esc(settings.logoUrl)}" alt="logo" class="logo" />`
    : `<div class="logo logo-fallback">USG</div>`;

  const machineLine =
    settings.usgShowMachine && settings.usgMachineLine?.trim()
      ? `<p class="machine">${esc(settings.usgMachineLine.trim())}</p>`
      : "";

  const sectionsHtml = resolved.sections
    .map(
      (s) =>
        `<tr class="organ"><th>${esc(s.label)}</th><td>${esc(s.text).replace(/\n/g, "<br/>")}</td></tr>`,
    )
    .join("\n");

  const impressionHtml = resolved.impression.length
    ? `<div class="impression-box"><ol class="impression">${resolved.impression
        .map((l) => `<li>${esc(l)}</li>`)
        .join("")}</ol></div>`
    : "";

  const suggestionsHtml = resolved.suggestions.length
    ? `<div class="suggestions">${resolved.suggestions.map((s) => `<p>${esc(s)}</p>`).join("")}</div>`
    : "";

  const declaration = settings.usgDeclarationLine?.trim()
    ? `<p class="declaration">${esc(settings.usgDeclarationLine.trim())}</p>`
    : "";

  const doctor = settings.usgDoctorName?.trim() || "Sonologist";

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<title>${esc(settings.hospitalName || settings.appTitle)} — ${esc(patient.name)} — ${esc(resolved.title)}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif; color: #16222E; font-size: 10.5pt; line-height: 1.5; }
  .sheet { max-width: 186mm; margin: 0 auto; }

  .masthead { background: linear-gradient(120deg, #143E6E 0%, #1B4F8A 45%, #2E6DA4 100%); color: #fff; border-radius: 12px; padding: 13px 18px 11px; display: flex; align-items: center; gap: 14px; box-shadow: 0 2px 6px rgba(20,62,110,.25); }
  .logo { width: 54px; height: 54px; background: #fff; border-radius: 11px; padding: 4px; object-fit: contain; flex-shrink: 0; }
  .logo-fallback { display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 12pt; color: #1B4F8A; letter-spacing: 1px; }
  .masthead .hospital { font-size: 16.5pt; font-weight: 800; letter-spacing: .4px; line-height: 1.15; text-shadow: 0 1px 2px rgba(0,0,0,.2); }
  .masthead .addr { font-size: 8.5pt; font-weight: 500; opacity: .95; margin-top: 2px; }
  .masthead .brand { margin-left: auto; text-align: right; flex-shrink: 0; }
  .masthead .brand .t { font-size: 8.5pt; font-weight: 800; letter-spacing: 2px; border: 1.5px solid rgba(255,255,255,.75); border-radius: 20px; padding: 3px 10px; }

  table.patient { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 9px; border: 1.5px solid #AFCDE8; border-radius: 9px; overflow: hidden; font-size: 9.5pt; }
  table.patient td { padding: 4px 9px; border-bottom: 1px solid #E1ECF7; }
  table.patient tr:last-child td { border-bottom: none; }
  table.patient td.k { background: #E8F1FA; font-weight: 800; color: #1B4F8A; width: 15%; white-space: nowrap; font-size: 8pt; text-transform: uppercase; letter-spacing: .5px; border-right: 1px solid #E1ECF7; }
  table.patient td.v { font-weight: 600; }

  .study { margin-top: 13px; text-align: center; page-break-after: avoid; }
  .study .name { font-size: 14.5pt; font-weight: 800; color: #143E6E; letter-spacing: 2px; text-transform: uppercase; }
  .study .rule { height: 3.5px; background: linear-gradient(90deg, transparent 4%, #2E6DA4 25%, #3E86C4 50%, #2E6DA4 75%, transparent 96%); border-radius: 3px; margin: 5px 18px 0; }

  .machine { text-align: center; font-size: 9.5pt; font-weight: 700; color: #2E6DA4; font-style: italic; margin-top: 7px; }

  h2.band { display: flex; align-items: center; gap: 9px; background: linear-gradient(90deg, #143E6E, #2E6DA4); color: #fff; font-size: 10pt; font-weight: 800; letter-spacing: 1.8px; text-transform: uppercase; padding: 5.5px 13px; border-radius: 7px; margin: 15px 0 8px; page-break-after: avoid; }
  h2.band .n { background: #fff; color: #1B4F8A; border-radius: 5px; min-width: 17px; height: 17px; display: inline-flex; align-items: center; justify-content: center; font-size: 9pt; font-weight: 800; }

  p.technique { margin: 3.5px 0; text-align: justify; }

  table.organs { width: 100%; border-collapse: collapse; margin-top: 2px; }
  table.organs tr.organ { page-break-inside: avoid; }
  table.organs th { width: 22mm; text-align: left; vertical-align: top; font-size: 8.5pt; font-weight: 800; color: #1B4F8A; text-transform: uppercase; letter-spacing: .8px; padding: 5px 8px 5px 0; border-bottom: 1px solid #E1ECF7; }
  table.organs td { vertical-align: top; text-align: justify; padding: 5px 0; border-bottom: 1px solid #E1ECF7; }
  table.organs tr:last-child th, table.organs tr:last-child td { border-bottom: none; }

  .impression-box { background: #E8F1FA; border-left: 4.5px solid #1B4F8A; border-radius: 0 8px 8px 0; padding: 9px 14px; margin-top: 2px; page-break-inside: avoid; }
  .impression-box ol { margin-left: 19px; }
  .impression-box li { font-weight: 700; margin: 4.5px 0; color: #16222E; }

  .suggestions { margin-top: 7px; font-weight: 700; color: #143E6E; }
  .suggestions p { margin: 3px 0; }

  .sig-block { margin-top: 30px; display: flex; justify-content: flex-end; page-break-inside: avoid; }
  .sig { text-align: center; min-width: 62mm; }
  .sig .line { border-bottom: 2px solid #143E6E; height: 24px; margin-bottom: 5px; }
  .sig .name { font-weight: 800; color: #143E6E; font-size: 11.5pt; }
  .sig .sub { font-size: 9pt; font-weight: 600; color: #40586D; }

  .declaration { margin-top: 16px; font-size: 8pt; font-weight: 600; color: #61788C; border: 1px solid #AFCDE8; border-radius: 7px; padding: 6px 10px; text-align: justify; }

  .footer { margin-top: 22px; border-top: 2.5px solid #1B4F8A; padding-top: 5px; font-size: 8pt; font-weight: 600; color: #61788C; display: flex; justify-content: space-between; }
</style></head>
<body>
<div class="sheet">
  <div class="masthead">
    ${logo}
    <div>
      <div class="hospital">${esc(settings.hospitalName || settings.appTitle)}</div>
      <div class="addr">${esc(settings.addressLine)}${settings.phone ? ` &nbsp;·&nbsp; ${esc(settings.phone)}` : ""}${settings.email ? ` &nbsp;·&nbsp; ${esc(settings.email)}` : ""}</div>
    </div>
    <div class="brand"><div class="t">ULTRASOUND REPORT</div></div>
  </div>

  <table class="patient">
    <tr>
      <td class="k">Patient</td><td class="v">${esc(patient.name || "—")}</td>
      <td class="k">Age / Sex</td><td class="v">${esc(patient.age || "—")} / ${esc(patient.sex || "—")}</td>
    </tr>
    <tr>
      <td class="k">Referred by</td><td class="v">${esc(patient.referredBy || "—")}</td>
      <td class="k">Date</td><td class="v">${esc(patient.date)}</td>
    </tr>
  </table>

  <div class="study">
    <div class="name">${esc(resolved.title)}</div>
    <div class="rule"></div>
  </div>
  ${machineLine}

  ${resolved.technique?.trim() ? `<h2 class="band"><span class="n">1</span>Technique</h2>\n  <p class="technique">${esc(resolved.technique).replace(/\n/g, "<br/>")}</p>` : ""}

  <h2 class="band"><span class="n">${resolved.technique?.trim() ? 2 : 1}</span>Findings</h2>
  <table class="organs">
    ${sectionsHtml}
  </table>

  <h2 class="band"><span class="n">${resolved.technique?.trim() ? 3 : 2}</span>Impression</h2>
  ${impressionHtml}
  ${suggestionsHtml}

  <div class="sig-block"><div class="sig">
    <div class="line"></div>
    <div class="name">${esc(doctor)}</div>
    ${settings.usgDoctorQual ? `<div class="sub">${esc(settings.usgDoctorQual)}</div>` : ""}
    ${settings.usgDoctorRegNo ? `<div class="sub">Reg. No: ${esc(settings.usgDoctorRegNo)}</div>` : ""}
  </div></div>

  ${declaration}

  <div class="footer">
    <span>${esc(settings.usgFooterLine || settings.footerMessage)}</span>
    <span>${esc(settings.appTitle)}</span>
  </div>
</div>
</body></html>`;
}
