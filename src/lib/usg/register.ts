/**
 * USG Studio — PC-PNDT register export (v5 phase 8).
 *
 * The sequential serial register (USG-0001…) is the app's core legal
 * discipline; this module turns it into the auditor-friendly artefacts:
 *   • CSV  — for records / spreadsheets
 *   • HTML — a standalone printable register page (A4 landscape)
 * Finalized reports only, ordered by serial — drafts carry no register row.
 */
import type { UsgPrintSettings } from "./print";

export type RegisterRow = {
  serialNo: number;
  scanDate: string | null; // ISO or null → falls back to finalizedAt
  finalizedAt: string | null;
  patientName: string;
  patientAge: string;
  patientSex: string;
  phone: string;
  studyTitle: string;
  referredBy: string;
};

const esc = (s: string) => `"${String(s ?? "").replace(/"/g, '""')}"`;

const fmtDay = (iso: string | null): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

export const REGISTER_CSV_HEADER = [
  "USG No", "Scan date", "Finalized on", "Patient", "Age", "Sex", "Phone",
  "Study", "Referred by",
];

/** Serialize the register as CSV (RFC-4180 quoting). */
export function registerCsv(rows: RegisterRow[]): string {
  const lines = [REGISTER_CSV_HEADER.map(esc).join(",")];
  for (const r of rows) {
    lines.push(
      [
        `USG-${String(r.serialNo).padStart(4, "0")}`,
        fmtDay(r.scanDate),
        fmtDay(r.finalizedAt),
        r.patientName,
        r.patientAge,
        r.patientSex === "CHILD" ? "Child" : r.patientSex,
        r.phone,
        r.studyTitle,
        r.referredBy,
      ]
        .map(esc)
        .join(","),
    );
  }
  return `${lines.join("\r\n")}\r\n`;
}

/** A standalone printable register page — A4 landscape, one row per report. */
export function registerHtml(rows: RegisterRow[], settings: Pick<UsgPrintSettings, "appTitle" | "hospitalName" | "addressLine" | "phone">): string {
  const body = rows
    .map(
      (r, i) => `<tr class="${i % 2 ? "alt" : ""}">
  <td class="c">USG-${String(r.serialNo).padStart(4, "0")}</td>
  <td class="c">${fmtDay(r.scanDate)}</td>
  <td>${escapeHtml(r.patientName)}</td>
  <td class="c">${escapeHtml(r.patientAge)}</td>
  <td class="c">${r.patientSex === "CHILD" ? "Child" : escapeHtml(r.patientSex)}</td>
  <td class="c">${escapeHtml(r.phone || "—")}</td>
  <td>${escapeHtml(r.studyTitle)}</td>
  <td>${escapeHtml(r.referredBy || "—")}</td>
</tr>`,
    )
    .join("\n");
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>USG Register</title>
<style>
  @page { size: A4 landscape; margin: 10mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #16222E; font-size: 9.5pt; }
  .head { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2.5px solid #143E6E; padding-bottom: 6px; }
  .h1 { font-size: 15pt; font-weight: 800; color: #143E6E; }
  .h2 { font-size: 9.5pt; color: #40586D; margin-top: 2px; }
  .meta { text-align: right; font-size: 9pt; color: #40586D; }
  h2 { font-size: 12pt; letter-spacing: 2px; text-transform: uppercase; color: #143E6E; margin: 10px 0 6px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #143E6E; color: #fff; font-size: 8.5pt; text-transform: uppercase; letter-spacing: .5px; padding: 5px 7px; text-align: left; }
  td { padding: 4px 7px; border-bottom: 1px solid #E1ECF7; font-size: 9.5pt; }
  tr.alt td { background: #F4F8FC; }
  td.c { text-align: center; white-space: nowrap; }
  .foot { margin-top: 10px; font-size: 8.5pt; color: #61788C; border-top: 1.5px solid #143E6E; padding-top: 4px; display: flex; justify-content: space-between; }
</style></head>
<body>
  <div class="head">
    <div>
      <div class="h1">${escapeHtml(settings.hospitalName || settings.appTitle)}</div>
      <div class="h2">${escapeHtml(settings.addressLine)}${settings.phone ? ` · ${escapeHtml(settings.phone)}` : ""}</div>
    </div>
    <div class="meta">
      <div><b>USG REGISTER</b></div>
      <div>${rows.length} finalized report${rows.length !== 1 ? "s" : ""} · printed ${fmtDay(new Date().toISOString())}</div>
    </div>
  </div>
  <h2>Sequential report register (PC-PNDT discipline — never renumbered)</h2>
  <table>
    <thead><tr>
      <th>USG No.</th><th>Scan date</th><th>Patient</th><th>Age</th><th>Sex</th><th>Phone</th><th>Study</th><th>Referred by</th>
    </tr></thead>
    <tbody>${body || `<tr><td colspan="8" class="c" style="padding:18px;color:#7A93A8">No finalized reports yet.</td></tr>`}</tbody>
  </table>
  <div class="foot">
    <span>Register numbers are stamped at first finalization; deleted reports leave gaps by design.</span>
    <span>${escapeHtml(settings.appTitle)}</span>
  </div>
</body></html>`;
}

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
