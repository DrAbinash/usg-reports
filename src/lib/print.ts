/**
 * PREMIUM A4 report — bright, bold, glossy-paper grade.
 * Deep clinical blue masthead + white-on-blue section bands + bold
 * subheadings. Key images print in a bordered grid. Frozen at finalize,
 * reused for every later print.
 * Print lessons from CARE: @page A4 12mm, no silent scaling,
 * "Background graphics" hint shown in UI (never on paper).
 */
import type { CareOrderLink, Report, FindingRow, ReportImage } from "@prisma/client";
import type { HospitalSettingsRow } from "@/lib/settings";

export type PrintInputs = {
  settings: HospitalSettingsRow;
  order: CareOrderLink;
  report: Pick<
    Report,
    "technique" | "findings" | "impression" | "recommendation" | "finalizedAt" | "studyName" | "findingsOpening"
  >;
  findingsRows?: Pick<FindingRow, "region" | "level" | "text" | "inImpression" | "sortOrder" | "impressionOnly" | "newParagraph">[];
  images?: Pick<ReportImage, "dataUrl" | "caption" | "sortOrder">[];
};

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** Section band: white bold text on a saturated blue gradient. */
function band(num: number, label: string): string {
  return `<h2 class="band"><span class="n">${num}</span>${label}</h2>`;
}

export function buildReportHtml({ settings, order, report, findingsRows, images }: PrintInputs): string {
  // Findings rows grouped by region — each region gets a bold subheading.
  const rows = [...(findingsRows ?? [])]
    .filter((r) => !r.impressionOnly)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const groups: { region: string; lines: string[] }[] = [];
  for (const r of rows) {
    let g = groups.find((x) => x.region === r.region);
    if (!g) { g = { region: r.region, lines: [] }; groups.push(g); }
    const lvl = r.level && !r.text.includes(r.level) ? `<b class="lvl">${esc(r.level)}:</b> ` : "";
    g.lines.push(`${lvl}${esc(r.text)}`);
  }
  const findingsBody = groups.length
    ? groups
        .map(
          (g) =>
            `<div class="rgroup"><div class="subhead">${esc(g.region)}</div>${g.lines
              .map((l) => `<p class="finding">${l}</p>`)
              .join("\n")}</div>`,
        )
        .join("\n")
    : `<p class="finding">${esc(report.findings).replace(/\n/g, "<br/>")}</p>`;

  // Bold opening line inside FINDINGS (the composed phrase — never the heading)
  const opening = report.findingsOpening?.trim()
    ? `<p class="opening">${esc(report.findingsOpening.trim())}.</p>`
    : "";

  const impressionLines = report.impression
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `<li>${esc(l.replace(/^\d+[.)]\s*/, ""))}</li>`)
    .join("\n");

  const imgs = [...(images ?? [])].sort((a, b) => a.sortOrder - b.sortOrder).filter((i) => i.dataUrl);
  const imagesBlock = imgs.length
    ? `<div class="images">${imgs
        .map(
          (i) =>
            `<figure><img src="${esc(i.dataUrl)}" alt="${esc(i.caption || "Key image")}" />${
              i.caption ? `<figcaption>${esc(i.caption)}</figcaption>` : ""
            }</figure>`,
        )
        .join("")}</div>`
    : "";

  const logo = settings.logoUrl
    ? `<img src="${esc(settings.logoUrl)}" alt="logo" class="logo" />`
    : `<div class="logo logo-fallback">RAD</div>`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<title>${esc(settings.appTitle)} — ${esc(order.accessionNumber)}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif; color: #16222E; font-size: 10.5pt; line-height: 1.5; }
  .sheet { max-width: 186mm; margin: 0 auto; }

  /* ── Masthead: saturated blue gradient band ── */
  .masthead { background: linear-gradient(120deg, #143E6E 0%, #1B4F8A 45%, #2E6DA4 100%); color: #fff; border-radius: 12px; padding: 13px 18px 11px; display: flex; align-items: center; gap: 14px; box-shadow: 0 2px 6px rgba(20,62,110,.25); }
  .logo { width: 54px; height: 54px; background: #fff; border-radius: 11px; padding: 4px; object-fit: contain; flex-shrink: 0; }
  .logo-fallback { display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 12pt; color: #1B4F8A; letter-spacing: 1px; }
  .masthead .hospital { font-size: 16.5pt; font-weight: 800; letter-spacing: .4px; line-height: 1.15; text-shadow: 0 1px 2px rgba(0,0,0,.2); }
  .masthead .addr { font-size: 8.5pt; font-weight: 500; opacity: .95; margin-top: 2px; }
  .masthead .brand { margin-left: auto; text-align: right; flex-shrink: 0; }
  .masthead .brand .t { font-size: 8.5pt; font-weight: 800; letter-spacing: 2px; border: 1.5px solid rgba(255,255,255,.75); border-radius: 20px; padding: 3px 10px; }

  /* ── Patient card ── */
  table.patient { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 9px; border: 1.5px solid #AFCDE8; border-radius: 9px; overflow: hidden; font-size: 9.5pt; }
  table.patient td { padding: 4px 9px; border-bottom: 1px solid #E1ECF7; }
  table.patient tr:last-child td { border-bottom: none; }
  table.patient td.k { background: #E8F1FA; font-weight: 800; color: #1B4F8A; width: 15%; white-space: nowrap; font-size: 8pt; text-transform: uppercase; letter-spacing: .5px; border-right: 1px solid #E1ECF7; }
  table.patient td.v { font-weight: 600; }

  /* ── Study heading: short + centered + bright ── */
  .study { margin-top: 13px; text-align: center; page-break-after: avoid; }
  .study .name { font-size: 14.5pt; font-weight: 800; color: #143E6E; letter-spacing: 2px; text-transform: uppercase; }
  .study .rule { height: 3.5px; background: linear-gradient(90deg, transparent 4%, #2E6DA4 25%, #3E86C4 50%, #2E6DA4 75%, transparent 96%); border-radius: 3px; margin: 5px 18px 0; }

  /* ── Section bands ── */
  h2.band { display: flex; align-items: center; gap: 9px; background: linear-gradient(90deg, #143E6E, #2E6DA4); color: #fff; font-size: 10pt; font-weight: 800; letter-spacing: 1.8px; text-transform: uppercase; padding: 5.5px 13px; border-radius: 7px; margin: 15px 0 8px; page-break-after: avoid; }
  h2.band .n { background: #fff; color: #1B4F8A; border-radius: 5px; min-width: 17px; height: 17px; display: inline-flex; align-items: center; justify-content: center; font-size: 9pt; font-weight: 800; }

  .finding { margin: 3.5px 0; text-align: justify; }
  .finding .lvl { color: #1B4F8A; }
  .rgroup { page-break-inside: avoid; }
  .subhead { font-size: 9pt; font-weight: 800; color: #1B4F8A; text-transform: uppercase; letter-spacing: 1.2px; border-bottom: 1.5px solid #C7DDF0; padding-bottom: 2px; margin: 8px 0 5px; }
  .opening { font-size: 11.5pt; font-weight: 800; color: #143E6E; margin: 1px 0 7px; letter-spacing: .2px; }

  /* ── Key images grid ── */
  .images { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; margin-top: 4px; }
  .images figure { border: 1.5px solid #AFCDE8; border-radius: 9px; overflow: hidden; page-break-inside: avoid; background: #0B0F14; }
  .images img { width: 100%; height: 50mm; object-fit: contain; display: block; }
  .images figcaption { font-size: 8.5pt; font-weight: 800; color: #143E6E; background: #E8F1FA; padding: 3.5px 9px; letter-spacing: .3px; }

  /* ── Impression highlight box ── */
  .impression-box { background: #E8F1FA; border-left: 4.5px solid #1B4F8A; border-radius: 0 8px 8px 0; padding: 9px 14px; margin-top: 2px; }
  .impression-box ol { margin-left: 19px; }
  .impression-box li { font-weight: 700; margin: 4.5px 0; color: #16222E; }

  .reco { font-weight: 600; }

  /* ── Signature ── */
  .sig-block { margin-top: 30px; display: flex; justify-content: flex-end; page-break-inside: avoid; }
  .sig { text-align: center; min-width: 62mm; }
  .sig .line { border-bottom: 2px solid #143E6E; height: 24px; margin-bottom: 5px; }
  .sig .name { font-weight: 800; color: #143E6E; font-size: 11.5pt; }
  .sig .sub { font-size: 9pt; font-weight: 600; color: #40586D; }

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
    <div class="brand"><div class="t">RADIOLOGY REPORT</div></div>
  </div>

  <table class="patient">
    <tr>
      <td class="k">Patient</td><td class="v">${esc(order.patientName)}</td>
      <td class="k">Age / Sex</td><td class="v">${esc(order.patientAge ?? "—")} / ${esc(order.patientGender ?? "—")}</td>
    </tr>
    <tr>
      <td class="k">Accession</td><td class="v">${esc(order.accessionNumber)}</td>
      <td class="k">Study Date</td><td class="v">${fmtDate(order.studyDate)}</td>
    </tr>
    <tr>
      <td class="k">Referred by</td><td class="v">${esc(order.referringDoctor ?? "—")}</td>
      <td class="k">MRN</td><td class="v">${esc(order.patientMrn ?? "—")}</td>
    </tr>
  </table>

  <div class="study">
    <div class="name">${esc(report.studyName || order.testName || "")}</div>
    <div class="rule"></div>
  </div>

  ${band(1, "Technique")}
  <p class="finding">${esc(report.technique).replace(/\n/g, "<br/>") || "—"}</p>

  ${band(2, "Findings")}
  ${opening}
  ${findingsBody}

  ${imagesBlock ? `${band(3, "Key Images")}\n${imagesBlock}` : ""}

  ${band(imagesBlock ? 4 : 3, "Impression")}
  ${impressionLines ? `<div class="impression-box"><ol class="impression">${impressionLines}</ol></div>` : '<p class="finding">—</p>'}

  ${report.recommendation?.trim() ? `${band(imagesBlock ? 5 : 4, "Recommendation")}\n<p class="finding reco">${esc(report.recommendation).replace(/\n/g, "<br/>")}</p>` : ""}

  <div class="sig-block"><div class="sig">
    <div class="line"></div>
    <div class="name">${esc(settings.radiologistName || "Radiologist")}</div>
    ${settings.radiologistQual ? `<div class="sub">${esc(settings.radiologistQual)}</div>` : ""}
    ${settings.radiologistRegNo ? `<div class="sub">Reg. No: ${esc(settings.radiologistRegNo)}</div>` : ""}
  </div></div>

  <div class="footer">
    <span>${esc(settings.footerMessage)}</span>
    <span>Report generated ${fmtDate(report.finalizedAt ?? new Date())} · ${esc(settings.appTitle)}</span>
  </div>
</div>
</body></html>`;
}
