/**
 * USG report — print document, version 3.
 *
 * Two letterhead styles, switchable in Settings → USG Studio:
 *   • premium — the studio's gradient masthead and banded sections (default);
 *   • classic — plain black-and-white serif letterhead that behaves like a
 *     traditional printed radiology report (ink-saver, thermal-printer safe).
 *
 * Paper: A4 (default) or A5 half-sheet — the same document scaled for the
 * clinic's A5 stock, ideal for short studies and quick prints.
 *
 * Density: compact toggle for long studies (echocardiography, whole abdomen).
 *
 * v6.2 print fine-tuning (Settings → USG Studio → Print layout):
 *   • body font size + line-height dials (gaps between lines);
 *   • section-gap preset — tight / normal / relaxed;
 *   • Technique band and "Thanks For Your Referral." tagline toggles;
 *   • the trailing block (signature + PC-PNDT + declaration + footer) moves
 *     to a new page as ONE unit with tighter default gaps — a report that
 *     is close to fitting no longer strands a lone signature on page two.
 *
 * Register & legal discipline:
 *   • a USG serial number cell (USG-0001 from the sequential register);
 *   • drafts print with a diagonal PROVISIONAL watermark and a red tag — a
 *     glance shows the sheet is not the frozen final record;
 *   • a scanned signature image can print over the name line.
 *
 * Layout upgrades over v1:
 *   • measurement sections (organ kind "table", e.g. echo M-mode) render as
 *     real bordered measurement tables with normal ranges in grey;
 *   • the doctor's "Thanks For Your Referral." tagline under the patient strip;
 *   • multi-line findings keep line breaks and print with hanging indents.
 */
import type { UsgResolved } from "./types";

export type UsgPrintImage = { dataUrl: string; caption?: string };

/** Verification QR printed bottom-right on finalized reports (v5). */
export type UsgPrintQr = { dataUrl: string };

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
  /** "a4" (default) or "a5" — half-sheet print for short studies. */
  usgPrintPaper?: string;
  /** Scanned signature image (URL/data-URL) printed above the name line. */
  usgSignatureUrl?: string;
  /** v6.2 print fine-tuning — body font size in pt (clamped 8.5–13). */
  usgPrintFontSize?: number;
  /** v6.2 — line-height multiplier, the "gaps between lines" dial (1.15–1.9). */
  usgPrintLineHeight?: number;
  /** v6.2 — section spacing preset: "tight" | "normal" (default) | "relaxed". */
  usgPrintSpacing?: string;
  /** v6.2 — print the Technique band (default true). */
  usgPrintShowTechnique?: boolean;
  /** v6.2 — print the "Thanks For Your Referral." tagline (default true). */
  usgPrintShowThanks?: boolean;
  /** v6.7 — image sidebar position: "right" (default) | "left". */
  usgSidebarPosition?: string;
  /** v6.7 — logo position: "left" (default) | "right" | "center". */
  usgLogoPosition?: string;
  /** v6.7 — address position: "right" (default) | "left" | "center". */
  usgAddressPosition?: string;
  /** v6.7 — font family: "sans-serif" (default) | "serif" | "system". */
  usgPrintFontFamily?: string;
  /** v6.20 Print Layout Studio — logo height in mm (8–30). */
  usgLogoSizeMm?: number;
  /** v6.20 — hospital name font size in pt (10–22). */
  usgNameSizePt?: number;
  /** v6.20 — address font size in pt (6–12). */
  usgAddressSizePt?: number;
  /** v6.20 — signature height in mm (12–40). */
  usgSignatureSizeMm?: number;
  // ── v6.10 feature toggles (per-clinic) ──────────────────────────
  // Optional — when undefined, the feature is treated as enabled.
  enableCriticalComm?: boolean;
  enableFollowUps?: boolean;
  enableAiDraft?: boolean;
  enableBirads?: boolean;
  enableDicomSr?: boolean;
};

export type UsgPrintPatient = {
  name: string;
  age: string;
  sex: string;
  referredBy: string;
  date: string; // pre-formatted
  /** Report serial (e.g. "USG-0012") — printed in the patient strip. */
  serial?: string;
  /** True while the report is still a draft — prints the PROVISIONAL
   *  watermark so an unfinalized sheet can never be mistaken for the record. */
  provisional?: boolean;
};

/** Sequential register number → printed form: 1 → "USG-0001", 12345 → "USG-12345". */
export function formatUsgSerial(n: number): string {
  return `USG-${String(Math.max(0, Math.floor(n))).padStart(4, "0")}`;
}

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Defense-in-depth URL sanitizer for <img src=...> attributes.
 *  The esc() helper already neutralizes attribute-breakout characters,
 *  so a `javascript:` URL stored as `src="javascript:alert(1)"` would
 *  render as inert text in modern browsers — but if the value ever
 *  leaks into an <a href>, an inline style, or a non-escaped context,
 *  the scheme could execute. Reject anything that isn't http(s):, data:
 *  (for embedded images), or a relative URL. Returns "" for unsafe. */
function safeImgUrl(raw: string | undefined | null): string {
  const v = (raw ?? "").trim();
  if (!v) return "";
  // Relative URL — always fine.
  if (/^\/[^/].*$/.test(v) || v.startsWith("./") || v.startsWith("../")) return v;
  // Allow only http(s): and data:image/...;base64,...
  if (/^https?:\/\//i.test(v)) return v;
  if (/^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/i.test(v)) return v;
  return "";
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
  @page { size: A4; margin: 10mm; }
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

  p.technique { margin: 3.5px 0; text-align: left; }

  table.organs { width: 100%; border-collapse: collapse; margin-top: 2px; }
  table.organs tr.organ { page-break-inside: avoid; }
  table.organs th { width: 22mm; text-align: left; vertical-align: top; font-size: 8.5pt; font-weight: 800; color: #1B4F8A; text-transform: uppercase; letter-spacing: .8px; padding: 5px 8px 5px 0; border-bottom: 1px solid #E1ECF7; }
  table.organs td { vertical-align: top; text-align: left; padding: 5px 0; border-bottom: 1px solid #E1ECF7; }
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

  .images-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 4px; }
  .img-cell { border: 1px solid #AFCDE8; border-radius: 8px; padding: 5px; text-align: center; page-break-inside: avoid; }
  .img-cell img { max-width: 100%; max-height: 45mm; object-fit: contain; }
  .img-cell figcaption { font-size: 8pt; font-weight: 600; color: #61788C; margin-top: 2px; min-height: 1em; }

  .suggestions { margin-top: 7px; font-weight: 700; color: #143E6E; }
  .suggestions p { margin: 3px 0; }

  .sig-block { margin-top: 16px; display: flex; justify-content: flex-end; page-break-inside: avoid; }
  .sig { text-align: center; min-width: 62mm; }
  .sig .line { border-bottom: 2px solid #143E6E; height: 18px; margin-bottom: 5px; }
  .sig .name { font-weight: 800; color: #143E6E; font-size: 11.5pt; }
  .sig .sub { font-size: 9pt; font-weight: 600; color: #40586D; }

  .declaration { margin-top: 10px; font-size: 8pt; font-weight: 600; color: #61788C; border: 1px solid #AFCDE8; border-radius: 7px; padding: 6px 10px; text-align: left; }

  .pcpndt { margin-top: 10px; border: 1.5px solid #1B4F8A; border-radius: 8px; padding: 8px 12px; background: #F4F8FC; page-break-inside: avoid; }
  .pcpndt-title { font-size: 9pt; font-weight: 800; letter-spacing: 1.2px; color: #143E6E; text-transform: uppercase; margin-bottom: 4px; }
  .pcpndt p { font-size: 8.5pt; font-weight: 600; color: #16222E; text-align: left; line-height: 1.55; }

  .footer { margin-top: 10px; border-top: 2.5px solid #1B4F8A; padding-top: 5px; font-size: 8pt; font-weight: 600; color: #61788C; display: flex; justify-content: space-between; align-items: center; }
  .qr-wrap { display: flex; flex-direction: column; align-items: center; gap: 1px; }
  .qr { width: 20mm; height: 20mm; }
  .qr-cap { font-size: 6.5pt; font-weight: 700; letter-spacing: .5px; }
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

  p.technique { margin: 3px 0; text-align: left; }

  table.organs { width: 100%; border-collapse: collapse; margin-top: 2px; }
  table.organs tr.organ { page-break-inside: avoid; }
  table.organs th { width: 24mm; text-align: left; vertical-align: top; font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; padding: 4.5px 8px 4.5px 0; border-bottom: 1px solid #999; }
  table.organs td { vertical-align: top; text-align: left; padding: 4.5px 0; border-bottom: 1px solid #999; }
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

  .images-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 4px; }
  .img-cell { border: 1px solid #000; padding: 4px; text-align: center; page-break-inside: avoid; }
  .img-cell img { max-width: 100%; max-height: 45mm; object-fit: contain; }
  .img-cell figcaption { font-size: 8pt; font-weight: 600; margin-top: 2px; min-height: 1em; }

  .suggestions { margin-top: 7px; font-weight: 700; }
  .suggestions p { margin: 3px 0; }

  .sig-block { margin-top: 16px; display: flex; justify-content: flex-end; page-break-inside: avoid; }
  .sig { text-align: center; min-width: 62mm; }
  .sig .line { border-bottom: 1.5px solid #000; height: 18px; margin-bottom: 5px; }
  .sig .name { font-weight: 700; font-size: 11pt; }
  .sig .sub { font-size: 9pt; font-weight: 600; }

  .declaration { margin-top: 10px; font-size: 8pt; font-weight: 600; border: 1px solid #000; padding: 6px 10px; text-align: left; }

  .pcpndt { margin-top: 10px; border: 1.5px solid #000; padding: 8px 12px; page-break-inside: avoid; }
  .pcpndt-title { font-size: 9pt; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; margin-bottom: 4px; }
  .pcpndt p { font-size: 8.5pt; font-weight: 600; text-align: left; line-height: 1.55; }

  .footer { margin-top: 10px; border-top: 1.5px solid #000; padding-top: 5px; font-size: 8pt; font-weight: 600; display: flex; justify-content: space-between; align-items: center; }
  .qr-wrap { display: flex; flex-direction: column; align-items: center; gap: 1px; }
  .qr { width: 20mm; height: 20mm; }
  .qr-cap { font-size: 6.5pt; font-weight: 700; }
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
  .sig-img { height: 14mm; }
  .pcpndt { margin-top: 10px; }
  .footer { margin-top: 12px; }
`;

/** A5 half-sheet — the full report scaled onto 148 × 210 mm stock. Applied
 *  AFTER the style sheet so both premium and classic shrink consistently. */
const A5_CSS = `
  @page { size: A5; margin: 8mm; }
  .sheet { max-width: 132mm; }
  body { font-size: 8.5pt; line-height: 1.4; }
  .masthead { padding: 8px 11px 7px; gap: 9px; border-radius: 9px; }
  .logo { width: 34px; height: 34px; border-radius: 8px; }
  .masthead .hospital { font-size: 11.5pt; }
  .masthead .addr { font-size: 6.5pt; margin-top: 1px; }
  .masthead .brand .t { font-size: 6.5pt; letter-spacing: 1.2px; padding: 2px 7px; }
  table.patient { margin-top: 6px; border-radius: 6px; border-width: 1px; font-size: 7.5pt; }
  table.patient td { padding: 2.5px 6px; }
  table.patient td.k { font-size: 6.5pt; }
  .thanks { font-size: 7.5pt; margin-top: 4px; }
  .study { margin-top: 8px; }
  .study .name { font-size: 10.5pt; letter-spacing: 1.5px; }
  .study .rule { margin: 3px 10px 0; }
  .machine { font-size: 7.5pt; margin-top: 4px; }
  h2.band { font-size: 8pt; letter-spacing: 1.2px; padding: 3.5px 9px; border-radius: 5px; margin: 9px 0 5px; }
  h2.band .n { min-width: 13px; height: 13px; font-size: 7pt; }
  p.technique { margin: 2.5px 0; }
  table.organs th { font-size: 7pt; width: 18mm; letter-spacing: .5px; padding: 3.5px 5px 3.5px 0; }
  table.organs td { padding: 3.5px 0; }
  .meas-cap { font-size: 7pt; padding: 3px 0 2px; }
  table.meas th, table.meas td { font-size: 8pt; padding-top: 2.5px; padding-bottom: 2.5px; }
  .impression-box { padding: 6px 10px; border-left-width: 3.5px; border-radius: 0 6px 6px 0; }
  .impression-box ol { margin-left: 15px; }
  .impression-box li { font-size: 8.5pt; margin: 3px 0; }
  .images-grid { gap: 5px; }
  .img-cell img { max-height: 32mm; }
  .img-cell figcaption { font-size: 6.5pt; }
  .suggestions { margin-top: 5px; font-size: 8pt; }
  .sig-block { margin-top: 14mm; }
  .sig { min-width: 46mm; }
  .sig .line { height: 14px; margin-bottom: 3px; }
  .sig-img { height: 13mm; }
  .sig .name { font-size: 9.5pt; }
  .sig .sub { font-size: 7pt; }
  .declaration { margin-top: 8px; font-size: 6.5pt; padding: 4px 7px; }
  .pcpndt { margin-top: 9px; padding: 5px 8px; border-radius: 6px; }
  .pcpndt-title { font-size: 7pt; margin-bottom: 2px; }
  .pcpndt p { font-size: 7pt; }
  .footer { margin-top: 8px; padding-top: 3px; font-size: 6.5pt; }
  .qr { width: 14mm; height: 14mm; }
  .qr-cap { font-size: 5.5pt; }
`;

/** Draft discipline — big diagonal watermark on every printed page plus a
 *  red tag under the masthead. `position: fixed` repeats on each sheet. */
const PROVISIONAL_CSS = `
  .watermark {
    position: fixed; top: 45%; left: 50%;
    transform: translate(-50%, -50%) rotate(-28deg);
    font-size: 44pt; font-weight: 800; letter-spacing: 10px;
    color: rgba(180, 40, 60, 0.10); z-index: 999; pointer-events: none;
  }
  .provisional-tag {
    text-align: center; margin-top: 6px;
  }
  .provisional-tag span {
    display: inline-block; border: 1.5px solid #B4283C; color: #B4283C;
    border-radius: 4px; font-size: 8pt; font-weight: 800; letter-spacing: 2px;
    padding: 2px 10px; text-transform: uppercase;
  }
`;
const PROVISIONAL_CSS_CLASSIC = `
  .watermark {
    position: fixed; top: 45%; left: 50%;
    transform: translate(-50%, -50%) rotate(-28deg);
    font-size: 44pt; font-weight: 800; letter-spacing: 10px;
    color: rgba(0, 0, 0, 0.08); z-index: 999; pointer-events: none;
  }
  .provisional-tag { text-align: center; margin-top: 6px; }
  .provisional-tag span {
    display: inline-block; border: 1.5px solid #000; color: #000;
    font-size: 8pt; font-weight: 800; letter-spacing: 2px;
    padding: 2px 10px; text-transform: uppercase;
  }
`;

/** Scanned signature image styling — identical for both letterhead styles. */
const SIGNATURE_CSS = `
  .sig-img { height: 18mm; max-width: 64mm; object-fit: contain; display: block; margin: 0 auto; }
`;

/**
 * v6.2 — the trailing block (signature + PC-PNDT + declaration + footer)
 * moves to a new page as ONE unit: a report that does not quite fit never
 * strands a lone signature on sheet two. Applied for both letterhead styles.
 */
const TAIL_CSS = `
  .tail { page-break-inside: avoid; }
`;

/** Clamp a numeric setting to a safe range (bad/absent values fall back). */
function clampNum(v: unknown, min: number, max: number, dflt: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt;
}

/** Resolve the v6.2 spacing preset to a known value ("normal" default). */
function spacingPreset(v: unknown): "tight" | "normal" | "relaxed" {
  return v === "tight" || v === "relaxed" ? v : "normal";
}

/**
 * v6.2 — print fine-tuning CSS. Generated LAST (after style/paper/compact)
 * so the doctor's dials always win:
 *   • body font size + line-height (the gaps between lines);
 *   • section-gap preset (tight keeps short studies to one page, relaxed
 *     airs out long ones);
 *   • element sizes expressed in em so the font dial scales the whole
 *     letterhead proportionally (A4 only — the A5 sheet keeps its own tuned
 *     proportions, but still honours line-height).
 */
function tuningCss(settings: UsgPrintSettings, a5: boolean): string {
  const fs = clampNum(settings.usgPrintFontSize, 8.5, 13, 10.5);
  const lh = clampNum(settings.usgPrintLineHeight, 1.15, 1.9, 1.5);
  const sp = spacingPreset(settings.usgPrintSpacing);

  let css = a5
    ? `body { line-height: ${lh}; }\n`
    : `body { font-size: ${fs}pt; line-height: ${lh}; }
  table.patient { font-size: 0.9em; }
  h2.band { font-size: 0.95em; }
  table.meas th, table.meas td { font-size: 0.9em; }
  table.organs th { font-size: 0.81em; }
  .sig .name { font-size: 1.1em; }
  .suggestions { font-size: 0.95em; }
`;

  if (sp === "tight") {
    css += `
  .study { margin-top: 8px; }
  .thanks { margin-top: 3px; }
  h2.band { margin-top: 8px; margin-bottom: 5px; }
  p.technique { margin: 2px 0; }
  table.organs th, table.organs td { padding-top: 3px; padding-bottom: 3px; }
  .impression-box li { margin: 2px 0; }
  .sig-block { margin-top: 10px; }
  .declaration { margin-top: 7px; }
  .pcpndt { margin-top: 7px; }
  .footer { margin-top: 7px; }
`;
  } else if (sp === "relaxed") {
    css += `
  .study { margin-top: 16px; }
  .thanks { margin-top: 10px; }
  h2.band { margin-top: 20px; margin-bottom: 11px; }
  p.technique { margin: 6px 0; }
  table.organs th, table.organs td { padding-top: 7px; padding-bottom: 7px; }
  .impression-box li { margin: 7px 0; }
  .sig-block { margin-top: 34px; }
  .declaration { margin-top: 20px; }
  .pcpndt { margin-top: 22px; }
  .footer { margin-top: 26px; }
`;
  }
  return css;
}

export function buildUsgReportHtml(
  settings: UsgPrintSettings,
  patient: UsgPrintPatient,
  resolved: UsgResolved,
  images: UsgPrintImage[] = [],
  qr?: UsgPrintQr | null,
): string {
  // v6.7 — route to the two-column sidebar layout when selected
  if (settings.usgPrintStyle === "premium_sidebar") {
    if (String((settings as any)?.usgPrintStyle ?? "").toLowerCase() === "couture") return buildPremiumReportHtml(settings, patient, resolved, images, qr);
    return buildSidebarReportHtml(settings, patient, resolved, images, qr);
  }

  const classic = settings.usgPrintStyle === "classic";
  const compact = settings.usgPrintCompact === true;
  const a5 = settings.usgPrintPaper === "a5";
  const provisional = patient.provisional === true;
  // v6.2 dials: the Technique band and referral tagline are switchable, and
  // the section numbering follows whatever actually prints.
  const showTechnique = settings.usgPrintShowTechnique !== false && !!resolved.technique?.trim();
  const showThanks = settings.usgPrintShowThanks !== false;
  const css =
    (classic ? CLASSIC_CSS : PREMIUM_CSS) +
    SIGNATURE_CSS +
    TAIL_CSS +
    (a5 ? A5_CSS : "") +
    (compact ? COMPACT_CSS : "") +
    tuningCss(settings, a5) +
    (provisional ? (classic ? PROVISIONAL_CSS_CLASSIC : PROVISIONAL_CSS) : "");

  const safeLogo = safeImgUrl(settings.logoUrl);
  const logo = safeLogo
    ? `<img src="${esc(safeLogo)}" alt="logo" class="logo" />`
    : `<div class="logo logo-fallback">USG</div>`;

  const machineLine =
    settings.usgShowMachine && settings.usgMachineLine?.trim()
      ? `<p class="machine">${esc(settings.usgMachineLine.trim())}</p>`
      : "";

  const provisionalTag = provisional
    ? `<div class="provisional-tag"><span>Provisional — not the final record</span></div>`
    : "";

  const watermark = provisional ? `<div class="watermark">PROVISIONAL</div>` : "";

  // Scanned signature replaces the empty signature line; the name prints
  // under the image exactly as before.
  const safeSig = safeImgUrl(settings.usgSignatureUrl);
  const sigVisual = safeSig
    ? `<img class="sig-img" src="${esc(safeSig)}" alt="signature" />`
    : `<div class="line"></div>`;

  const sectionsHtml = renderSections(resolved);

  // Machine stills — 2-up grid with captions, printed after the findings.
  const imagesHtml = images.length
    ? `<div class="images-grid">${images
        .map(
          (img) =>
            `<figure class="img-cell"><img src="${esc(img.dataUrl)}" alt="USG still" /><figcaption>${esc(img.caption ?? "")}</figcaption></figure>`,
        )
        .join("")}</div>`
    : "";
  const imagesBand = images.length
    ? `<h2 class="band"><span class="n">${showTechnique ? 3 : 2}</span>USG Images</h2>`
    : "";

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
<style>${css}
/* v6.17 sig-pin — signature block anchored to page-1 bottom-right */
.page { position: relative; }
.tail { position: absolute !important; right: 8mm; bottom: 6mm; margin: 0 !important; padding: 0 !important; text-align: right; break-inside: avoid; page-break-inside: avoid; }}
.page { min-height: 277mm; }

/* v6.17 two-line demography strip */
.patient-strip { display: flex; flex-direction: column; gap: 4px; margin: 4mm 0 3mm; }
.strip-row { display: flex; justify-content: space-between; align-items: center; }
.strip-row .field { flex: 1; display: flex; justify-content: space-between; align-items: baseline; }
.strip-row .field:first-child { padding-right: 8mm; }
.strip-row .label { font-size: 8.5pt; font-weight: 600; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
.strip-row .value { font-size: 9.5pt; font-weight: 500; text-align: right; }
.strip-row .field:first-child .value { text-align: left; }
/* v6.17 signature pin to bottom-right of page 1 */
.sig-block { position: absolute !important; right: 8mm; bottom: 6mm; margin: 0 !important; text-align: right; }
.page { position: relative; min-height: 277mm; }

/* v6.20 — honour size dials */
.top-bar .logo-block img { height: var(--logo-h, 14mm); }
.top-bar .logo-block .hospital-name { font-size: var(--name-fs, 15pt); }
.top-bar .contact-block { font-size: var(--addr-fs, 8.5pt); }
</style><style id="usg-justify-kill">p, li, td, th, div, span, .organ-body, .ob-body, .pbody { text-align: left !important; hyphens: none !important; word-spacing: normal !important; letter-spacing: normal !important; }</style><style id="usg-sig-fit">.signature-block,.sig-wrap,.sig-pin{position:static !important;bottom:auto !important;right:auto !important;transform:none !important;}</style><script>window.addEventListener("beforeprint",function(){var mm=277/25.4*96;var h=document.body.scrollHeight;if(h>mm){document.body.style.zoom=(mm/h).toFixed(3);}});</script></head>
<body>
${watermark}
<div class="sheet">
  <div class="masthead">
    ${logo}
    <div>
      <div class="hospital">${esc(settings.hospitalName || settings.appTitle)}</div>
      <div class="addr">${esc(settings.addressLine)}${settings.phone ? ` &nbsp;·&nbsp; ${esc(settings.phone)}` : ""}${settings.email ? ` &nbsp;·&nbsp; ${esc(settings.email)}` : ""}</div>
    </div>
    ""
  </div>
  ${provisionalTag}

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

  ${showThanks ? `<p class="thanks">Thanks For Your Referral.</p>` : ""}

  <div class="study">
    <div class="name">${esc(resolved.title)}</div>
    <div class="rule"></div>
  </div>
  ${machineLine}

  ${showTechnique ? `<h2 class="band"><span class="n">1</span>Technique</h2>
  <p class="technique">${esc(resolved.technique).replace(/\n/g, "<br/>")}</p>` : ""}

  <h2 class="band"><span class="n">${showTechnique ? 2 : 1}</span>Findings</h2>
  ${sectionsHtml}

  ${imagesBand}
  ${imagesHtml}

  <h2 class="band"><span class="n">${(showTechnique ? 3 : 2) + (images.length ? 1 : 0)}</span>Impression</h2>
  ${impressionHtml}
  ${suggestionsHtml}

  <div class="tail">
  <div class="sig-block"><div class="sig">
    ${sigVisual}
    <div class="name">${esc(doctor)}</div>
    ${settings.usgDoctorQual ? `<div class="sub">${esc(settings.usgDoctorQual)}</div>` : ""}
    ${settings.usgDoctorRegNo ? `<div class="sub">Reg. No: ${esc(settings.usgDoctorRegNo)}</div>` : ""}
    ${classic ? "" : `<div class="sub">Sonologist</div>`}
  </div></div>

  ${pcpndt}
  ${declaration}

  <div class="footer">
    <span>${esc(settings.usgFooterLine || settings.footerMessage)}</span>
    ${qr ? `<span class="qr-wrap"><img class="qr" src="${esc(qr.dataUrl)}" alt="verification QR" /><span class="qr-cap">scan to verify</span></span>` : ""}
    <span>${esc(settings.appTitle)}</span>
  </div>
  </div>
</div>
</body></html>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// v6.7 — PREMIUM SIDEBAR FORMAT
// Two-column layout: image sidebar + text column, matching the reference
// clinic report format. Configurable from Settings.
// ═══════════════════════════════════════════════════════════════════════════

const SIDEBAR_CSS = `
@page { margin: 0; size: A4; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { margin: 0; padding: 0; background: #fff; }
body {
  font-family: var(--font-fam, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif);
  font-size: 10pt;
  line-height: 1.45;
  color: #1a1a2e;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.page { width: 210mm; min-height: 297mm; position: relative; overflow: hidden; }

/* ── Top bar (logo + address) ────────────────────────────────────────────── */
.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 8mm 10mm 4mm 10mm;
}
.top-bar .logo-block { display: flex; align-items: center; gap: 8px; }
.top-bar .logo-block img { height: 14mm; width: auto; }
.top-bar .logo-block .logo-fallback {
  height: 14mm; width: 14mm; border-radius: 50%;
  background: linear-gradient(135deg, #0ea5e9, #6366f1);
  color: #fff; font-size: 8pt; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
.top-bar .logo-block .hospital-name { font-size: 15pt; font-weight: 800; color: #1e3a5f; line-height: 1.1; }
.top-bar .logo-block .tagline { font-size: 8pt; color: #64748b; font-style: italic; }
.top-bar .contact-block { text-align: right; font-size: 8.5pt; color: #475569; line-height: 1.4; }
.top-bar .contact-block .line { display: flex; align-items: center; gap: 4px; justify-content: flex-end; }
.top-bar.center .logo-block { order: 2; }
.top-bar.center .contact-block { order: 1; }
.top-bar.center { justify-content: center; gap: 20px; }
.top-bar.right .logo-block { order: 2; }
.top-bar.right .contact-block { order: 1; text-align: left; }
.top-bar.right .contact-block .line { justify-content: flex-start; }

/* ── Patient strip ────────────────────────────────────────────────────────── */
.patient-strip {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  padding: 0 10mm;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
}
.patient-strip .field { padding: 4px 8px; }
.patient-strip .label { font-size: 7.5pt; text-transform: uppercase; color: #94a3b8; font-weight: 600; }
.patient-strip .value { font-size: 10pt; font-weight: 600; color: #1e293b; }

/* ── Two-column body ──────────────────────────────────────────────────────── */
.body-grid {
  display: grid;
  grid-template-columns: var(--sidebar-w, 60mm) 1fr;
  gap: 0;
  min-height: 200mm;
}
.body-grid.sidebar-left { grid-template-columns: 1fr var(--sidebar-w, 60mm); }
.body-grid.sidebar-left .sidebar { order: 2; }
.body-grid.sidebar-left .main-col { order: 1; }

/* ── Image sidebar ────────────────────────────────────────────────────────── */
.sidebar {
  background: #0f172a;
  padding: 6mm 4mm;
  display: flex;
  flex-direction: column;
  gap: 4mm;
}
.sidebar .sidebar-header {
  color: #94a3b8;
  font-size: 8pt;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding-bottom: 2mm;
  border-bottom: 1px solid #334155;
}
.sidebar .sidebar-subheader {
  color: #64748b;
  font-size: 7pt;
  font-weight: 600;
  margin-bottom: 2mm;
}
.sidebar .img-item {
  position: relative;
  border-radius: 4px;
  overflow: hidden;
}
.sidebar .img-item img {
  width: 100%;
  height: auto;
  display: block;
  border-radius: 4px;
}
.sidebar .img-item .badge {
  position: absolute;
  top: 3px; left: 3px;
  background: #3b82f6;
  color: #fff;
  font-size: 7pt;
  font-weight: 700;
  width: 14px; height: 14px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
}
.sidebar .img-item .caption {
  font-size: 7pt;
  color: #94a3b8;
  padding: 2px 4px;
  text-align: center;
}

/* ── Main column (findings + impression) ──────────────────────────────────── */
.main-col { padding: 6mm 8mm 4mm 8mm; }
.main-col .section { margin-bottom: 4mm; }
.main-col .section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 9pt;
  font-weight: 700;
  text-transform: uppercase;
  color: #1e3a5f;
  padding-bottom: 1mm;
  border-bottom: 1px solid #e2e8f0;
  margin-bottom: 2mm;
}
.main-col .section-body {
  font-size: var(--body-fs, 10pt);
  line-height: var(--body-lh, 1.45);
  color: #1a1a2e;
}
.main-col .section-body p { margin-bottom: 1.5mm; }
.main-col .section-body .table-row {
  display: grid;
  grid-template-columns: 120px 80px 1fr;
  gap: 4px;
  font-size: 9pt;
  padding: 1px 0;
  border-bottom: 1px dotted #e2e8f0;
}
.main-col .section-body .table-row .label { font-weight: 600; color: #475569; }
.main-col .section-body .table-row .value { font-weight: 700; }
.main-col .section-body .table-row .range { font-size: 8pt; color: #94a3b8; }

/* ── Impression box ──────────────────────────────────────────────────────── */
.impression-box {
  background: #f1f5f9;
  border-left: 3px solid #3b82f6;
  border-radius: 0 6px 6px 0;
  padding: 3mm 4mm;
  margin: 2mm 0;
}
.impression-box .header {
  font-size: 9pt;
  font-weight: 700;
  text-transform: uppercase;
  color: #1e3a5f;
  margin-bottom: 1.5mm;
}
.impression-box .body { font-size: 10pt; line-height: 1.5; }
.impression-box .body p { margin-bottom: 1mm; }

/* ── Signature block ──────────────────────────────────────────────────────── */
.signature-block {
  display: flex;
  justify-content: space-between;
  padding: 8mm 10mm 4mm 10mm;
  gap: 20mm;
}
.signature-block .sig-item { flex: 1; }
.signature-block .sig-line {
  border-top: 1px solid #1e293b;
  margin-top: 10mm;
  padding-top: 1mm;
}
.signature-block .sig-name { font-size: 9pt; font-weight: 700; }
.signature-block .sig-qual { font-size: 8pt; color: #64748b; }
.signature-block .sig-reg { font-size: 7.5pt; color: #94a3b8; }
.signature-block .sig-img {
  max-height: 12mm; width: auto;
  margin-bottom: -2mm;
}

/* ── Footer band ──────────────────────────────────────────────────────────── */
.footer-band {
  background: #0f172a;
  color: #94a3b8;
  text-align: center;
  font-size: 8pt;
  font-weight: 600;
  letter-spacing: 0.5px;
  padding: 3mm 10mm;
  text-transform: uppercase;
}
.footer-band .qr { float: right; }
.footer-band .serial { float: left; color: #64748b; font-family: monospace; }

/* ── Provisional watermark ──────────────────────────────────────────────── */
.watermark {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%) rotate(-30deg);
  font-size: 60pt;
  color: rgba(239, 68, 68, 0.08);
  font-weight: 900;
  pointer-events: none;
  z-index: 1000;
}
.provisional-tag {
  position: absolute;
  top: 6mm; right: 6mm;
  background: #ef4444;
  color: #fff;
  font-size: 8pt;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  z-index: 1001;
}
`;

/** Font family CSS variable based on settings. */
function sidebarFontFamily(settings: UsgPrintSettings): string {
  const fam = settings.usgPrintFontFamily ?? "sans-serif";
  switch (fam) {
    case "serif":
      return "'Times New Roman', 'Georgia', serif";
    case "system":
      return "system-ui, -apple-system, sans-serif";
    default:
      return "'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
  }
}

/** Build the two-column sidebar layout HTML. */
function buildSidebarReportHtml(
  settings: UsgPrintSettings,
  patient: UsgPrintPatient,
  resolved: UsgResolved,
  images: UsgPrintImage[],
  qr?: UsgPrintQr | null,
): string {
  const provisional = patient.provisional === true;
  const sidebarLeft = (settings.usgSidebarPosition ?? "right") === "left";
  const logoPos = settings.usgLogoPosition ?? "left";
  const addrPos = settings.usgAddressPosition ?? "right";
  const fontFam = sidebarFontFamily(settings);
  const showTechnique = settings.usgPrintShowTechnique !== false && !!resolved.technique?.trim();
  const showThanks = settings.usgPrintShowThanks !== false;

  const safeLogo = safeImgUrl(settings.logoUrl);
  const logo = safeLogo
    ? `<img src="${esc(safeLogo)}" alt="logo" />`
    : `<div class="logo-fallback">USG</div>`;

  const contactLines = [
    settings.addressLine?.trim(),
    settings.phone?.trim() ? `📞 ${settings.phone}` : null,
    settings.email?.trim() ? `✉ ${settings.email}` : null,
  ].filter(Boolean).map((l) => `<div class="line">${esc(l!)}</div>`).join("");
  // Multi-line address: split by newlines and render each
  const addr = settings.addressLine?.trim();
  const addrHtml = addr ? addr.split("\n").map(l => `<div class="line">${esc(l.trim())}</div>`).join("") : "";

  // Image sidebar items
  const sidebarImages = images.length > 0
    ? images.map((img, i) => `
      <div class="img-item">
        ${img.dataUrl ? `<img src="${esc(img.dataUrl)}" alt="USG" />` : ""}
        <div class="badge">${i + 1}</div>
        ${img.caption ? `<div class="caption">${esc(img.caption)}</div>` : ""}
      </div>`).join("")
    : "";

  // Findings sections
  const sectionsHtml = resolved.sections.map((s) => `
    <div class="section">
      <div class="section-header">${esc(s.label)}</div>
      <div class="section-body">${esc(s.text).replace(/\n/g, "<br>")}</div>
    </div>`).join("");

  // Technique section
  const techniqueHtml = showTechnique
    ? `<div class="section">
        <div class="section-header">Technique</div>
        <div class="section-body">${esc(resolved.technique)}</div>
      </div>`
    : "";

  // Impression
  const impressionHtml = resolved.impression.length > 0
    ? `<div class="impression-box">
        <div class="header">Impression</div>
        <div class="body">${resolved.impression.map((l) => `<p>${esc(l)}</p>`).join("")}</div>
      </div>`
    : "";

  // Suggestions
  const suggestionsHtml = resolved.suggestions?.length
    ? `<div class="section"><div class="section-body" style="font-size:8.5pt;color:#64748b;">
        ${resolved.suggestions.map((s) => `• ${esc(s)}`).join("<br>")}</div></div>`
    : "";

  // Signature
  const safeSig = safeImgUrl(settings.usgSignatureUrl);
  const sigVisual = safeSig
    ? `<img class="sig-img" src="${esc(safeSig)}" alt="signature" />`
    : "";

  // Footer
  const serialNo = patient.serial ?? "";
  const qrHtml = qr?.dataUrl ? `<div class="qr"><img src="${esc(qr.dataUrl)}" alt="QR" style="height:12mm;width:auto;" /></div>` : "";
  const footerMsg = settings.usgFooterLine?.trim() ? esc(settings.usgFooterLine) : "Kindly correlate with clinico-pathological findings.";

  const watermark = provisional ? `<div class="watermark">PROVISIONAL</div>` : "";
  const provisionalTag = provisional ? `<div class="provisional-tag">Provisional — not final</div>` : "";

  // Top bar class based on logo/address positions
  const topBarClass = logoPos === "center" ? "center" : logoPos === "right" ? "right" : "";

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${esc(resolved.title || "USG Report")}</title>
<style>
${SIDEBAR_CSS}
:root {
  --font-fam: ${fontFam};
  --body-fs: ${settings.usgPrintFontSize ?? 10}pt;
  --body-lh: ${settings.usgPrintLineHeight ?? 1.45};
  --sidebar-w: ${images.length > 2 ? "65mm" : "55mm"};
}
</style>
<style id="usg-justify-kill">p, li, td, th, div, span, .organ-body, .ob-body, .pbody { text-align: left !important; hyphens: none !important; word-spacing: normal !important; letter-spacing: normal !important; }</style><style id="usg-sig-fit">.signature-block,.sig-wrap,.sig-pin{position:static !important;bottom:auto !important;right:auto !important;transform:none !important;}</style><script>window.addEventListener("beforeprint",function(){var mm=277/25.4*96;var h=document.body.scrollHeight;if(h>mm){document.body.style.zoom=(mm/h).toFixed(3);}});</script></head><body>
<div class="page">
  ${watermark}
  ${provisionalTag}

  <!-- Top bar: logo + contact -->
  <div class="top-bar ${topBarClass}">
    <div class="logo-block">
      ${logo}
      <div>
        ${settings.hospitalName?.trim() ? `<div class="hospital-name">${esc(settings.hospitalName)}</div>` : ""}
        ${settings.appTitle && settings.appTitle !== "CARE USG Studio" ? `<div class="tagline">${esc(settings.appTitle)}</div>` : ""}
      </div>
    </div>
    <div class="contact-block">${addrHtml}${settings.phone ? `<div class="line">📞 ${esc(settings.phone)}</div>` : ""}${settings.email ? `<div class="line">✉ ${esc(settings.email)}</div>` : ""}</div>
  </div>

  <!-- Patient strip -->
  <div class="patient-strip">
  <div class="strip-row">
    <div class="field"><div class="label">NAME</div><div class="value" style="font-weight:700;">${esc(patient.name || "—")}</div></div>
    <div class="field"><div class="label">AGE/SEX</div><div class="value">${esc(patient.age || "—")} / ${esc(patient.sex || "—")}</div></div>
  </div>
  <div class="strip-row">
    <div class="field"><div class="label">REFERRED BY</div><div class="value">${esc(patient.referredBy || "—")}</div></div>
    <div class="field"><div class="label">DATE</div><div class="value">${esc(patient.date || "—")}</div></div>
  </div>
</div></div>
    <div class="field"><div class="label">Study Date</div><div class="value">${esc(patient.date || "—")}</div></div>
    <div class="field"><div class="label">Age / Gender</div><div class="value">${esc(patient.age || "—")} / ${esc(patient.sex || "—")}</div></div>
    <div class="field"><div class="label">Ref. Doctor</div><div class="value">${esc(patient.referredBy || "—")}</div></div>
    ${patient.serial ? `<div class="field"><div class="label">Patient ID</div><div class="value">${esc(patient.serial)}</div></div>` : ""}
    <div class="field"><div class="label">Study</div><div class="value">${esc(resolved.title || resolved.study.label)}</div></div>
  </div>

  <!-- Two-column body -->
  <div class="body-grid ${sidebarLeft ? "sidebar-left" : ""}">
    <!-- Image sidebar -->
    ${images.length > 0 ? `
    <div class="sidebar">
      <div class="sidebar-header">Key Images</div>
      <div class="sidebar-subheader">${esc(resolved.title || "USG")}</div>
      ${sidebarImages}
    </div>` : ""}

    <!-- Main column: findings + impression + signature -->
    <div class="main-col">
      ${techniqueHtml}
      ${sectionsHtml}
      ${impressionHtml}
      ${suggestionsHtml}
      ${settings.usgDeclarationLine?.trim() ? `<div class="section"><div class="section-body" style="font-size:8pt;color:#64748b;border:1px solid #e2e8f0;padding:2mm;border-radius:4px;">${esc(settings.usgDeclarationLine)}</div></div>` : ""}

      <!-- Signature -->
      <div class="signature-block">
        <div class="sig-item">
          ${sigVisual}
          <div class="sig-line"></div>
          <div class="sig-name">${esc(settings.usgDoctorName || "—")}</div>
          <div class="sig-qual">${esc(settings.usgDoctorQual || "")}</div>
          ${settings.usgDoctorRegNo ? `<div class="sig-reg">Reg. No: ${esc(settings.usgDoctorRegNo)}</div>` : ""}
        </div>
      </div>
    </div>
  </div>

  <!-- Footer band -->
  <div class="footer-band">
    ${serialNo ? `<div class="serial">${serialNo}</div>` : ""}
    ${showThanks ? esc(footerMsg) : ""}
    ${qrHtml}
  </div>
</div>
</body></html>`;
}


/** v6.18 premium port — ERP-grade couture for USG: navy key-image rail,
 *  demographic grid, tinted impression, signature block, navy footer band.
 *  Gated by HospitalSettings.usgPrintStyle === "premium"; other styles untouched. */
export function buildPremiumReportHtml(settings: any, patient: any, resolved: any, images: any, qr: any): string {
  const e = (v: any) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const s = settings ?? {};
  const p = patient ?? {};
  const name = p.name || p.patientName || "";
  const age = p.age || p.patientAge || "";
  const sex = p.sex || p.patientSex || "";
  const ref = p.referredBy || p.referringDoctor || "";
  const studyTitle = p.studyTitle || p.study || p.testName || "";
  const scanDate = p.scanDate || p.scanDateText || p.date || "";
  const imgs: any[] = Array.isArray(images) ? images : [];
  const sections: { label: string; text: string }[] = [];
  let impression = "";
  const pushSec = (label: any, text: any) => {
    const L = String(label ?? "").trim(); const T = String(text ?? "").trim();
    if (!T) return;
    if (/^impression$/i.test(L)) { impression += (impression ? "\n" : "") + T; return; }
    if (L) sections.push({ label: L.toUpperCase(), text: T });
  };
  if (Array.isArray(resolved)) for (const r of resolved as any[]) pushSec(r?.label ?? r?.organLabel ?? r?.organ ?? r?.title, r?.text ?? r?.findings ?? r?.body);
  else if (resolved && typeof resolved === "object") {
    const ro = resolved as any;
    if (Array.isArray(ro.organs)) for (const o of ro.organs) pushSec(o?.label ?? o?.organ, o?.text ?? o?.findings);
    if (ro.impression) impression += String(ro.impression);
  }
  if (!impression) impression = String(p.impression ?? "");
  const sig = s.usgSignatureUrl ? `<img class="psig-img" src="${e(s.usgSignatureUrl)}" alt="signature" />` : `<span class="psig-line"></span>`;
  const qrHtml = qr?.dataUrl ? `<span class="pqr"><img src="${e(qr.dataUrl)}" alt="verification QR" /><span>scan to verify</span></span>` : "";
  const rail = imgs.length ? `
    <aside class="prail">
      <div class="prail-h">KEY IMAGES</div>
      <div class="prail-m">${e(studyTitle || "USG")}</div>
      ${imgs.slice(0, 6).map((im, i) => {
        const src = im?.dataUrl || im?.url || im?.src || "";
        if (!src) return "";
        return `<figure class="pkey"><span class="pnum">${i + 1}</span><img src="${e(src)}" alt="key image ${i + 1}" />${im?.caption || im?.label ? `<figcaption>${e(im.caption || im.label)}</figcaption>` : ""}</figure>`;
      }).join("")}
    </aside>` : "";
  const gen = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>${e(name)} — USG report</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; font-family: "Segoe UI", Arial, sans-serif; color: #16202b; }
  .pwrap { display: flex; min-height: 297mm; }
  .prail { flex: 0 0 52mm; background: #0e2a3f; color: #eaf2f8; padding: 8mm 4mm 6mm 4mm; }
  .prail-h { font-size: 11pt; font-weight: 800; letter-spacing: 1.2px; }
  .prail-m { font-size: 7.5pt; opacity: .85; margin: 1mm 0 4mm 0; text-transform: uppercase; letter-spacing: .4px; }
  .pkey { position: relative; margin: 0 0 5mm 0; }
  .pkey img { width: 100%; height: 34mm; object-fit: cover; border: 1px solid #35566e; border-radius: 1.5mm; background: #000; }
  .pnum { position: absolute; top: -1.5mm; left: -1.5mm; width: 6mm; height: 6mm; background: #2f80ed; color: #fff; font-size: 8pt; font-weight: 700; border-radius: 1mm; display: flex; align-items: center; justify-content: center; }
  .pkey figcaption { font-size: 6.5pt; margin-top: 1mm; opacity: .9; }
  .pmain { flex: 1; padding: 8mm 8mm 6mm 8mm; min-width: 0; }
  .phead { display: flex; align-items: flex-start; gap: 6mm; }
  .plogo { width: 30mm; height: 30mm; object-fit: contain; }
  .phosp { flex: 1; }
  .phosp h1 { margin: 0; font-size: 17pt; letter-spacing: .5px; color: #0e2a3f; }
  .phosp .tag { font-size: 7.5pt; color: #5a6b7c; margin-top: .5mm; }
  .phosp .addr { font-size: 8pt; color: #33475b; margin-top: 1.5mm; line-height: 1.45; text-align: right; }
  .pqr { display: flex; flex-direction: column; align-items: center; gap: 1px; }
  .pqr img { width: 20mm; height: 20mm; }
  .pqr span { font-size: 6.5pt; font-weight: 700; letter-spacing: .5px; color: #33475b; }
  .pdemo { border: .35mm solid #c9d6e2; border-radius: 1.5mm; margin: 3mm 0 1.5mm 0; padding: 1.6mm 4mm; display: grid; grid-template-columns: 1.5fr 1.5fr 0.9fr 0.9fr; gap: 0 6mm; font-size: 8.5pt; }
  .pstudy { text-align: center; font-weight: 800; font-size: 11pt; letter-spacing: .6px; margin: 1.5mm 0 2.5mm 0; color: #0e2a3f; }
  .pdemo div { display: flex; gap: 2mm; }
  .pdemo b { color: #51606f; font-weight: 600; min-width: 24mm; }
  .psec { margin: 4mm 0 2.5mm 0; font-size: 10.5pt; font-weight: 800; color: #0e2a3f; letter-spacing: .4px; display: flex; align-items: center; gap: 2mm; }
  .psec::before { content: ""; width: 3mm; height: 3mm; border-radius: 50%; border: .5mm solid #2f80ed; }
  .pcenter { justify-content: center; }
  .pbody { font-size: 9pt; line-height: 1.5; text-align: left; margin: 0 0 2mm 0; white-space: pre-wrap; }
  .pimp { background: #eef3f8; border-left: 1.2mm solid #2f80ed; border-radius: 1.5mm; padding: 3mm 4mm; margin-top: 4mm; }
  .pimp .psec { margin-top: 0; }
  .pimp-list { margin: 0; padding-left: 6mm; font-size: 9pt; line-height: 1.5; }
  .pdisc { font-size: 7.5pt; color: #5a6b7c; margin: 4mm 0 3mm 0; }
  .psig { display: flex; justify-content: flex-end; margin-top: 6mm; }
  .psig-box { text-align: center; font-size: 8.5pt; }
  .psig-img { height: 12mm; object-fit: contain; }
  .psig-line { display: block; width: 45mm; border-bottom: .3mm solid #7a8a99; height: 10mm; }
  .psig-box .nm { font-weight: 700; margin-top: 1mm; }
  .psig-box .ql { font-size: 7.5pt; color: #51606f; }
  .pfoot { background: #0e2a3f; color: #dfe9f2; text-align: center; font-size: 8pt; letter-spacing: 1.4px; padding: 2.6mm 0; margin-top: 6mm; text-transform: uppercase; }
  .pgen { font-size: 7pt; color: #7a8a99; text-align: right; margin-top: 1.5mm; text-transform: none; letter-spacing: 0; }
</style><style id="usg-justify-kill">p, li, td, th, div, span, .organ-body, .ob-body, .pbody { text-align: left !important; hyphens: none !important; word-spacing: normal !important; letter-spacing: normal !important; }</style><style id="usg-sig-fit">.signature-block,.sig-wrap,.sig-pin{position:static !important;bottom:auto !important;right:auto !important;transform:none !important;}</style><script>window.addEventListener("beforeprint",function(){var mm=277/25.4*96;var h=document.body.scrollHeight;if(h>mm){document.body.style.zoom=(mm/h).toFixed(3);}});</script></head>
<body>
<div class="pwrap">
${rail}
<main class="pmain">
  <div class="phead">
    ${s.logoUrl ? `<img class="plogo" src="${e(s.logoUrl)}" alt="logo" />` : ""}
    <div class="phosp">
      <h1>${e(s.hospitalName || "CARE DIAGNOSTICS")}</h1>
      <div class="tag">${e(s.footerMessage || "Precision. Compassion. Care.")}</div>
      <div class="addr">${e(s.addressLine)}<br/>${e(s.phone || "")}<br/>${e(s.email || "")}<br/>www.caredeoghar.com</div>
    </div>
    ${qrHtml}
  </div>
  <div class="pdemo">
    <div><b>Patient</b><span>: ${e(name)}</span></div>
    <div><b>Ref. By</b><span>: ${e(ref || "—")}</span></div>
    <div><b>Age/Sex</b><span>: ${e(age)}${sex ? ` / ${e(sex)}` : ""}</span></div>
    <div><b>Date</b><span>: ${e(scanDate)}</span></div>
  </div>
  <div class="pstudy">${e(studyTitle || "ULTRASOUND")}</div>
  <div class="psec">FINDINGS</div>
  ${sections.map((sec) => `<div class="psec" style="font-size:9.5pt;">${e(sec.label)}</div><p class="pbody">${e(sec.text)}</p>`).join("")}
  ${impression ? `<div class="psec">IMPRESSION</div>
  <div class="pimp" style="margin-top:1mm;"><ol class="pimp-list">${impression.split(/\n+/).filter(Boolean).map((l) => `<li>${e(l)}</li>`).join("")}</ol></div>` : ""}
  <p class="pdisc">${e(s.usgDeclarationLine || "This report is based on the images and clinical information provided. Kindly correlate clinically.")}</p>
  <div class="psig"><div class="psig-box">${sig}<div class="nm">${e(s.usgDoctorName || "")}</div><div class="ql">${e(s.usgDoctorQual || "MBBS, MD (Radiology)")}<br/>RADIOLOGIST${s.usgDoctorRegNo ? ` · Reg. No: ${e(s.usgDoctorRegNo)}` : ""}</div></div></div>
  <div class="pfoot">Thank you for choosing ${e(s.hospitalName || "CARE DIAGNOSTICS")}</div>
  <div class="pgen">Report generated on ${e(gen)} IST</div>
</main>
</div>
</body></html>`;
}
