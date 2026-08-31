/**
 * USG report — A4 print document, version 2.
 *
 * Two letterhead styles, switchable in Settings → USG Studio:
 *   • premium — the studio's gradient masthead and banded sections (default);
 *   • classic — plain black-and-white serif letterhead that behaves like a
 *     traditional printed radiology report (ink-saver, thermal-printer safe).
 *
 * Plus a compact density toggle for long studies (echocardiography, whole
 * abdomen with many findings) so a report fits one sheet where possible.
 *
 * Layout upgrades over v1:
 *   • measurement sections (organ kind "table", e.g. echo M-mode) render as
 *     real bordered measurement tables with normal ranges in grey;
 *   • the doctor's "Thanks For Your Referral." tagline under the patient strip;
 *   • a USG serial number cell (filled once the report is saved);
 *   • multi-line findings keep line breaks and print with hanging indents.
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
  /** "premium" (default) or "classic" (plain B/W letterhead). */
  usgPrintStyle?: string;
  /** Compact density — smaller type + tighter spacing for long reports. */
  usgPrintCompact?: boolean;
};

export type UsgPrintPatient = {
  name: string;
  age: string;
  sex: string;
  referredBy: string;
  date: string; // pre-formatted
  /** Report serial (e.g. "USG-0012") — printed in the patient strip. */
  serial?: string;
};

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** A measurement line "Label : value ( Normal ... )" → table row HTML. */
function measurementRow(line: string): string {
  const idx = line.indexOf(":");
  if (idx === -1) return `<tr><td class="m-full" colspan="2">${esc(line)}</td></tr>`;
  const label = line.slice(0, idx).trim();
  const value = line.slice(idx + 1).trim();
  const m = value.match(/^(.*?)(\(\s*Normal[^)]*\))$/i);
  if (m) {
    return `<tr><th>${esc(label)}</th><td>${esc(m[1].trim())} <span class="norm">${esc(m[2])}</span></td></tr>`;
  }
  return `<tr><th>${esc(label)}</th><td>${esc(value)}</td></tr>`;
}

/** Section blocks in organ order; table sections render as measurement tables. */
function renderSections(resolved: UsgResolved): string {
  const parts: string[] = [];
  const rows: string[] = [];
  const flushRows = () => {
    if (!rows.length) return;
    parts.push(`<table class="organs">${rows.join("\n")}</table>`);
    rows.length = 0;
  };
  for (const s of resolved.sections) {
    if (s.kind === "table") {
      flushRows();
      const body = s.text
        .split(/\n+/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map(measurementRow)
        .join("\n");
      parts.push(`<div class="meas-block"><div class="meas-cap">${esc(s.label)}</div><table class="meas"><tbody>${body}</tbody></table></div>`);
    } else {
      rows.push(`<tr class="organ"><th>${esc(s.label)}</th><td>${esc(s.text).replace(/\n/g, "<br/>")}</td></tr>`);
    }
  }
  flushRows();
  return parts.join("\n");
}

const PREMIUM_CSS = `
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

  .thanks { text-align: center; font-style: italic; font-weight: 600; color: #4A6581; font-size: 9.5pt; margin-top: 6px; }

  .study { margin-top: 12px; text-align: center; page-break-after: avoid; }
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

  .meas-block { margin-top: 2px; page-break-inside: avoid; }
  .meas-cap { font-size: 8.5pt; font-weight: 800; color: #1B4F8A; text-transform: uppercase; letter-spacing: .8px; padding: 5px 0 4px; border-bottom: 1px solid #AFCDE8; }
  table.meas { width: 100%; border-collapse: collapse; }
  table.meas th { text-align: left; vertical-align: top; width: 62%; font-weight: 700; color: #16222E; font-size: 9.5pt; padding: 3.5px 8px 3.5px 0; border-bottom: 1px solid #E1ECF7; }
  table.meas td { vertical-align: top; font-weight: 600; font-size: 9.5pt; padding: 3.5px 0; border-bottom: 1px solid #E1ECF7; }
  table.meas tr:last-child th, table.meas tr:last-child td { border-bottom: none; }
  table.meas .norm { color: #7A93A8; font-weight: 500; font-size: 8.5pt; }
  table.meas td.m-full { font-weight: 700; }

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

  .pcpndt { margin-top: 18px; border: 1.5px solid #1B4F8A; border-radius: 8px; padding: 8px 12px; background: #F4F8FC; page-break-inside: avoid; }
  .pcpndt-title { font-size: 9pt; font-weight: 800; letter-spacing: 1.2px; color: #143E6E; text-transform: uppercase; margin-bottom: 4px; }
  .pcpndt p { font-size: 8.5pt; font-weight: 600; color: #16222E; text-align: justify; line-height: 1.55; }

  .footer { margin-top: 22px; border-top: 2.5px solid #1B4F8A; padding-top: 5px; font-size: 8pt; font-weight: 600; color: #61788C; display: flex; justify-content: space-between; }
`;

const CLASSIC_CSS = `
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: "Georgia", "Times New Roman", "Noto Serif", serif; color: #000; font-size: 10.5pt; line-height: 1.55; }
  .sheet { max-width: 182mm; margin: 0 auto; }

  .masthead { text-align: center; border-bottom: 3px double #000; padding: 2px 0 9px; }
  .logo { width: 46px; height: 46px; object-fit: contain; margin: 0 auto 2px; display: block; }
  .logo-fallback { display: none; }
  .masthead .hospital { font-size: 17pt; font-weight: 700; letter-spacing: 2px; line-height: 1.2; text-transform: uppercase; }
  .masthead .addr { font-size: 9pt; margin-top: 3px; }
  .masthead .brand { display: none; }

  table.patient { width: 100%; border-collapse: collapse; margin-top: 10px; border: 1px solid #000; font-size: 9.5pt; }
  table.patient td { padding: 4px 8px; border: 1px solid #000; }
  table.patient td.k { font-weight: 700; width: 15%; white-space: nowrap; font-size: 8.5pt; text-transform: uppercase; letter-spacing: .5px; background: #f2f2f2; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  table.patient td.v { font-weight: 600; }

  .thanks { text-align: center; font-style: italic; font-size: 9.5pt; margin-top: 7px; }

  .study { margin-top: 13px; text-align: center; page-break-after: avoid; }
  .study .name { font-size: 13.5pt; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 4px 0; }
  .study .rule { display: none; }

  .machine { text-align: center; font-size: 9pt; font-weight: 600; font-style: italic; margin-top: 6px; }

  h2.band { font-size: 10pt; font-weight: 700; letter-spacing: 2.5px; text-transform: uppercase; border-bottom: 1.5px solid #000; padding-bottom: 2px; margin: 16px 0 7px; page-break-after: avoid; }
  h2.band .n { margin-right: 7px; }

  p.technique { margin: 3px 0; text-align: justify; }

  table.organs { width: 100%; border-collapse: collapse; margin-top: 2px; }
  table.organs tr.organ { page-break-inside: avoid; }
  table.organs th { width: 24mm; text-align: left; vertical-align: top; font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; padding: 4.5px 8px 4.5px 0; border-bottom: 1px solid #999; }
  table.organs td { vertical-align: top; text-align: justify; padding: 4.5px 0; border-bottom: 1px solid #999; }
  table.organs tr:last-child th, table.organs tr:last-child td { border-bottom: none; }

  .meas-block { margin-top: 2px; page-break-inside: avoid; }
  .meas-cap { font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; padding: 4.5px 0 3px; border-bottom: 1.5px solid #000; }
  table.meas { width: 100%; border-collapse: collapse; }
  table.meas th { text-align: left; vertical-align: top; width: 62%; font-weight: 700; font-size: 9.5pt; padding: 3px 8px 3px 0; border-bottom: 1px solid #999; }
  table.meas td { vertical-align: top; font-weight: 600; font-size: 9.5pt; padding: 3px 0; border-bottom: 1px solid #999; }
  table.meas tr:last-child th, table.meas tr:last-child td { border-bottom: none; }
  table.meas .norm { color: #555; font-weight: 400; font-size: 8.5pt; font-style: italic; }
  table.meas td.m-full { font-weight: 700; }

  .impression-box { border: 1.5px solid #000; padding: 8px 12px; margin-top: 2px; page-break-inside: avoid; }
  .impression-box ol { margin-left: 20px; }
  .impression-box li { font-weight: 700; margin: 4px 0; }

  .suggestions { margin-top: 7px; font-weight: 700; }
  .suggestions p { margin: 3px 0; }

  .sig-block { margin-top: 28px; display: flex; justify-content: flex-end; page-break-inside: avoid; }
  .sig { text-align: center; min-width: 62mm; }
  .sig .line { border-bottom: 1.5px solid #000; height: 22px; margin-bottom: 5px; }
  .sig .name { font-weight: 700; font-size: 11pt; }
  .sig .sub { font-size: 9pt; font-weight: 600; }

  .declaration { margin-top: 14px; font-size: 8pt; font-weight: 600; border: 1px solid #000; padding: 6px 10px; text-align: justify; }

  .pcpndt { margin-top: 16px; border: 1.5px solid #000; padding: 8px 12px; page-break-inside: avoid; }
  .pcpndt-title { font-size: 9pt; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; margin-bottom: 4px; }
  .pcpndt p { font-size: 8.5pt; font-weight: 600; text-align: justify; line-height: 1.55; }

  .footer { margin-top: 20px; border-top: 1.5px solid #000; padding-top: 5px; font-size: 8pt; font-weight: 600; display: flex; justify-content: space-between; }
`;

const COMPACT_CSS = `
  body { font-size: 9.5pt; line-height: 1.38; }
  .masthead { padding-top: 9px; padding-bottom: 8px; }
  .masthead .hospital { font-size: 14pt; }
  .logo { width: 44px; height: 44px; }
  table.patient { margin-top: 6px; }
  table.patient td { padding: 2.5px 7px; }
  .study { margin-top: 8px; }
  .study .name { font-size: 12.5pt; }
  h2.band { margin: 9px 0 5px; padding: 3.5px 11px; }
  table.organs th, table.organs td { padding-top: 3px; padding-bottom: 3px; }
  table.meas th, table.meas td { padding-top: 2px; padding-bottom: 2px; }
  .meas-cap { padding-top: 3px; }
  .impression-box li { margin: 2.5px 0; }
  .sig-block { margin-top: 16px; }
  .sig .line { height: 16px; }
  .pcpndt { margin-top: 10px; }
  .footer { margin-top: 12px; }
`;

export function buildUsgReportHtml(
  settings: UsgPrintSettings,
  patient: UsgPrintPatient,
  resolved: UsgResolved,
): string {
  const classic = settings.usgPrintStyle === "classic";
  const compact = settings.usgPrintCompact === true;
  const css = (classic ? CLASSIC_CSS : PREMIUM_CSS) + (compact ? COMPACT_CSS : "");

  const logo = settings.logoUrl
    ? `<img src="${esc(settings.logoUrl)}" alt="logo" class="logo" />`
    : `<div class="logo logo-fallback">USG</div>`;

  const machineLine =
    settings.usgShowMachine && settings.usgMachineLine?.trim()
      ? `<p class="machine">${esc(settings.usgMachineLine.trim())}</p>`
      : "";

  const sectionsHtml = renderSections(resolved);

  const impressionHtml = resolved.impression.length
    ? `<div class="impression-box"><ol class="impression">${resolved.impression
        .map((l) => `<li>${esc(l)}</li>`)
        .join("")}</ol></div>`
    : "";

  const suggestionsHtml = resolved.suggestions.length
    ? `<div class="suggestions">${resolved.suggestions.map((s) => `<p>${esc(s)}</p>`).join("")}</div>`
    : "";

  const doctor = settings.usgDoctorName?.trim() || "Sonologist";

  const declaration = settings.usgDeclarationLine?.trim()
    ? `<p class="declaration">${esc(settings.usgDeclarationLine.trim())}</p>`
    : "";

  // PC-PNDT Act: every obstetric scan carries the doctor's statutory
  // declaration that the sex of the foetus was neither detected nor disclosed.
  const pcpndt = resolved.study.pcpndt
    ? `<div class="pcpndt">
      <div class="pcpndt-title">DECLARATION OF DOCTOR PERFORMING ULTRA SONOGRAPHY</div>
      <p>I ${esc(doctor)}${settings.usgDoctorQual ? `, ${esc(settings.usgDoctorQual)}` : ""} declare that while conducting USG on above patient, I have neither detected nor disclosed the sex of the foetus to anybody in any manner.</p>
    </div>`
    : "";

  const serial = patient.serial?.trim();

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<title>${esc(settings.hospitalName || settings.appTitle)} — ${esc(patient.name)} — ${esc(resolved.title)}</title>
<style>${css}</style></head>
<body>
<div class="sheet">
  <div class="masthead">
    ${logo}
    <div>
      <div class="hospital">${esc(settings.hospitalName || settings.appTitle)}</div>
      <div class="addr">${esc(settings.addressLine)}${settings.phone ? ` &nbsp;·&nbsp; ${esc(settings.phone)}` : ""}${settings.email ? ` &nbsp;·&nbsp; ${esc(settings.email)}` : ""}</div>
    </div>
    ${classic ? "" : `<div class="brand"><div class="t">ULTRASOUND REPORT</div></div>`}
  </div>

  <table class="patient">
    <tr>
      <td class="k">Patient</td><td class="v">${esc(patient.name || "—")}</td>
      <td class="k">Age / Sex</td><td class="v">${esc(patient.age || "—")} / ${esc(patient.sex || "—")}</td>
      ${serial ? `<td class="k">USG No.</td><td class="v">${esc(serial)}</td>` : ""}
    </tr>
    <tr>
      <td class="k">Referred by</td><td class="v">${esc(patient.referredBy || "—")}</td>
      <td class="k">Date</td><td class="v">${esc(patient.date)}</td>
      ${serial ? `<td class="k"></td><td class="v"></td>` : ""}
    </tr>
  </table>

  <p class="thanks">Thanks For Your Referral.</p>

  <div class="study">
    <div class="name">${esc(resolved.title)}</div>
    <div class="rule"></div>
  </div>
  ${machineLine}

  ${resolved.technique?.trim() ? `<h2 class="band"><span class="n">1</span>Technique</h2>
  <p class="technique">${esc(resolved.technique).replace(/\n/g, "<br/>")}</p>` : ""}

  <h2 class="band"><span class="n">${resolved.technique?.trim() ? 2 : 1}</span>Findings</h2>
  ${sectionsHtml}

  <h2 class="band"><span class="n">${resolved.technique?.trim() ? 3 : 2}</span>Impression</h2>
  ${impressionHtml}
  ${suggestionsHtml}

  <div class="sig-block"><div class="sig">
    <div class="line"></div>
    <div class="name">${esc(doctor)}</div>
    ${settings.usgDoctorQual ? `<div class="sub">${esc(settings.usgDoctorQual)}</div>` : ""}
    ${settings.usgDoctorRegNo ? `<div class="sub">Reg. No: ${esc(settings.usgDoctorRegNo)}</div>` : ""}
    ${classic ? "" : `<div class="sub">Sonologist</div>`}
  </div></div>

  ${pcpndt}
  ${declaration}

  <div class="footer">
    <span>${esc(settings.usgFooterLine || settings.footerMessage)}</span>
    <span>${esc(settings.appTitle)}</span>
  </div>
</div>
</body></html>`;
}
