/**
 * USG Studio — server-side PDF report (v5 phase 9).
 *
 * A real PDF (pdf-lib, vector text) mirroring the classic letterhead: hospital
 * header, patient strip, study title, technique, findings rows (word-wrapped),
 * impression, suggestions, signature image + credentials, declaration /
 * PC-PNDT block, then stills on a following appendix page, plus the
 * verification QR. A4 or A5, paginated.
 * Drafts carry the diagonal PROVISIONAL watermark, same as the HTML print.
 *
 * v6.2: honours the print fine-tuning dials (font size, line-height, section
 * spacing preset, Technique-band toggle) so the shared PDF matches what the
 * browser prints.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from "pdf-lib";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { UsgResolved } from "./types";
import { clinicDisplayName, clinicFooterText } from "./branding";
import { DEFAULT_BRAND_LOGO_URL, mastheadAddressLines, resolveMachineLine, type UsgPrintSettings, type UsgPrintImage } from "./print";
import { segmentAbnormalFindings } from "./abnormalBold";

export type UsgPrintPatient = {
  name: string;
  age: string;
  sex: string;
  referredBy: string;
  date: string;
  serial?: string;
  provisional?: boolean;
};

export type UsgPdfInput = {
  settings: UsgPrintSettings;
  patient: UsgPrintPatient;
  resolved: UsgResolved;
  images?: UsgPrintImage[];
  /** QR PNG bytes (from the qrcode lib) printed bottom-right. */
  qrPng?: Uint8Array | null;
};

const A4 = { w: 595.28, h: 841.89 };
const A5 = { w: 419.53, h: 595.28 };
const INK = rgb(0.08, 0.13, 0.18);
const NAVY = rgb(0.08, 0.24, 0.43);
const GREY = rgb(0.45, 0.52, 0.58);
const LINE = rgb(0.82, 0.88, 0.94);

type Ctx = {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  fonts: { reg: PDFFont; bold: PDFFont; italic: PDFFont };
  pageW: number;
  pageH: number;
  margin: number;
  contentW: number;
  pages: PDFPage[];
};

function newPage(ctx: Ctx): void {
  ctx.page = ctx.doc.addPage([ctx.pageW, ctx.pageH]);
  ctx.pages.push(ctx.page);
  ctx.y = ctx.pageH - ctx.margin;
}

function ensure(ctx: Ctx, needed: number): void {
  if (ctx.y - needed < ctx.margin + 30) newPage(ctx);
}

function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const out: string[] = [];
  for (const para of String(text ?? "").split(/\n/)) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) {
      out.push("");
      continue;
    }
    let line = "";
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(next, size) <= maxW) line = next;
      else {
        if (line) out.push(line);
        // A single overlong word gets hard-clipped by the renderer anyway.
        line = w;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

async function embedDataUrl(doc: PDFDocument, dataUrl: string): Promise<PDFImage | null> {
  try {
    const m = /^data:(image\/(?:png|jpe?g|webp));base64,(.+)$/i.exec((dataUrl ?? "").trim());
    if (!m) return null;
    const bytes = Buffer.from(m[2], "base64");
    if (/^image\/png/i.test(m[1])) return await doc.embedPng(bytes);
    if (/^image\/jpe?g/i.test(m[1])) return await doc.embedJpg(bytes);
    return null; // webp — pdf-lib cannot embed; skipped
  } catch {
    return null;
  }
}

/**
 * Letterhead mark for the PDF. pdf-lib embeds only PNG/JPEG, so a WebP or SVG
 * logo returned null and the sheet printed with no branding at all while the
 * browser print showed it. Falls back to the CARE wordmark committed with the
 * app, so a PDF is never unbranded. A remote (http) logo URL is not fetched
 * here — the report route must stay offline-safe on the clinic LAN.
 */
async function embedBrandLogo(doc: PDFDocument, logoUrl: string | undefined): Promise<PDFImage | null> {
  const raw = (logoUrl ?? "").trim();
  if (raw.startsWith("data:")) {
    const embedded = await embedDataUrl(doc, raw);
    if (embedded) return embedded;
  } else if (raw && !raw.startsWith("/")) {
    return null;
  }
  try {
    const file = join(process.cwd(), "public", DEFAULT_BRAND_LOGO_URL.replace(/^\//, ""));
    return existsSync(file) ? await doc.embedJpg(readFileSync(file)) : null;
  } catch {
    return null;
  }
}

/** CARE wordmark letter colours — the same four the clinic's logo uses. */
const CARE_COLORS: RGB[] = [
  rgb(0.894, 0.0, 0.169), // red
  rgb(0.224, 0.71, 0.29), // green
  rgb(0.0, 0.576, 0.835), // blue
  rgb(0.953, 0.573, 0.0), // orange
];

/**
 * Last-resort brand emblem: the four CARE colours as a 2×2 tile. Only reached
 * when neither the clinic's upload nor the committed wordmark could embed — it
 * stays wordless so it can never duplicate the clinic name beside it.
 */
function drawCareEmblem(ctx: Ctx, x: number, yTop: number, size: number): void {
  const cell = size / 2;
  CARE_COLORS.forEach((color, i) => {
    ctx.page.drawRectangle({
      x: x + (i % 2) * cell,
      y: yTop - cell - Math.floor(i / 2) * cell,
      width: cell,
      height: cell,
      color,
    });
  });
}

/** Sanitise to WinAnsi-safe text for the standard fonts. */
const S = (s: string) =>  String(s ?? "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\u00a0/g, " ")
    // Drop anything WinAnsi cannot encode (exotic symbols) rather than crash.
    .replace(/[^\x20-\x7e\u00a1-\u00ff\n]/g, "");

export async function buildUsgReportPdf(input: UsgPdfInput): Promise<Uint8Array> {
  const { settings, patient, resolved, images = [], qrPng } = input;
  const a5 = settings.usgPrintPaper === "a5";
  const compact = settings.usgPrintCompact === true;
  // Default one_page — pack clinical body on a single A4; stills appendix after.
  const fitOnePage = !a5 && settings.usgPrintBodyFit !== "multi";

  // v6.2 dials — same meaning as the HTML print, mapped into PDF points:
  //   font dial (HTML pt) → PDF body size (A4 ≈ 0.9×, A5 ≈ 0.81×, compact −1);
  //   line-height dial → wrapped-line leading (1.5 keeps the classic base+2.5);
  //   spacing preset scales the inter-section gaps (tight 0.6 / relaxed 1.5).
  // one_page fit further densifies so WA findings + impression stay on sheet 1.
  const clampNum = (v: unknown, min: number, max: number, dflt: number): number => {
    const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt;
  };
  const fontDial = clampNum(settings.usgPrintFontSize, 8.5, 13, fitOnePage ? 9.5 : 10.5);
  const lhDial = clampNum(settings.usgPrintLineHeight, 1.15, 1.9, fitOnePage ? 1.25 : 1.5);
  const sp =
    fitOnePage
      ? 0.45
      : settings.usgPrintSpacing === "tight"
        ? 0.6
        : settings.usgPrintSpacing === "relaxed"
          ? 1.5
          : 1;

  const doc = await PDFDocument.create();
  doc.setTitle(`${S(patient.name)} — ${S(resolved.title)}`);
  if (settings.hospitalName) doc.setAuthor(S(settings.hospitalName));

  const fonts = {
    reg: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
  };

  const pageW = a5 ? A5.w : A4.w;
  const pageH = a5 ? A5.h : A4.h;
  const margin = a5 ? 26 : fitOnePage ? 28 : 40;
  const contentW = pageW - margin * 2;
  let base = a5 ? fontDial * 0.81 : fontDial * 0.9;
  if (compact || fitOnePage) base -= fitOnePage ? 1.2 : 1;
  const lead = Math.max(base + 0.6, base + (fitOnePage ? 1.4 : 2.5) + (lhDial - 1.5) * 5);
  const leadBold = Math.max(base + 1, base + (fitOnePage ? 1.8 : 3) + (lhDial - 1.5) * 5);
  const gap = (v: number) => v * sp;

  const first = doc.addPage([pageW, pageH]);
  const ctx: Ctx = {
    doc, page: first, y: pageH - margin, fonts, pageW, pageH, margin, contentW, pages: [first],
  };

  // ── Header (white-label clinic name + optional logo) ──────────────────
  // Pre-printed A4 letterpad: skip digital header; reserve top band for the
  // physical pad (mirrors HTML `.letterpad-reserve`).
  const preprinted = settings.usgPrintStyle === "preprinted";
  const hospital = S(clinicDisplayName(settings));
  const nameSize = clampNum(settings.usgNameSizePt, 10, 22, a5 ? 13 : fitOnePage ? 12 : 15);
  const addrSize = clampNum(settings.usgAddressSizePt, 6, 12, a5 ? 6.5 : fitOnePage ? 7 : 8);
  const logoSizeMm = clampNum(settings.usgLogoSizeMm, 8, 30, a5 ? 14 : fitOnePage ? 12 : 18);
  if (preprinted) {
    ctx.y -= a5 ? 70 : 108; // ~38mm letterpad reserve
  } else {
  ensure(ctx, nameSize + 40);
  let headerX = margin;
  const bandH = logoSizeMm * 2.83; // the logo dial, mm → points
  const logo = await embedBrandLogo(doc, settings.logoUrl);
  if (logo) {
    // Keep the mark's own aspect ratio. It used to be clamped to 1.35 × a
    // square slot, which drew a wide CARE wordmark horizontally squashed.
    const ar = logo.width / logo.height;
    const w = Math.min(bandH * ar, Math.min(contentW * 0.34, bandH * 4));
    const h = w / ar;
    ctx.page.drawImage(logo, { x: margin, y: ctx.y - bandH, width: w, height: h });
    headerX = margin + w + 10;
  } else {
    const emblem = Math.min(bandH, nameSize * 1.6);
    drawCareEmblem(ctx, margin, ctx.y, emblem);
    headerX = margin + emblem + 10;
  }
  ctx.page.drawText(hospital, { x: headerX, y: ctx.y - nameSize, size: nameSize, font: fonts.bold, color: NAVY });

  // Address stacked on the right in ≤4 lines (Castair's Town… / phone / email).
  const addrPos = settings.usgAddressPosition ?? "right";
  const addrLines = mastheadAddressLines(settings);
  if (addrLines.length > 0) {
    const addrY = ctx.y - 2;
    if (addrPos === "right") {
      let lineY = addrY;
      for (const line of addrLines) {
        const txt = S(line);
        const w = fonts.reg.widthOfTextAtSize(txt, addrSize);
        ctx.page.drawText(txt, { x: pageW - margin - w, y: lineY - addrSize, size: addrSize, font: fonts.reg, color: GREY });
        lineY -= addrSize * 1.35;
      }
    } else {
      const contact = S(addrLines.join("  ·  "));
      const w = fonts.reg.widthOfTextAtSize(contact, addrSize);
      const x = addrPos === "center" ? (pageW - w) / 2 : headerX;
      ctx.page.drawText(contact, { x, y: addrY - addrSize, size: addrSize, font: fonts.reg, color: GREY });
    }
  }
  const addrBlockH = Math.max(nameSize + 8, addrLines.length * addrSize * 1.35 + 4);
  ctx.y -= addrBlockH + (a5 ? 10 : 14);
  }
  ctx.page.drawLine({
    start: { x: margin, y: ctx.y }, end: { x: pageW - margin, y: ctx.y },
    thickness: a5 ? 1 : 1.4, color: NAVY,
  });
  ctx.y -= a5 ? 10 : 12;

  if (patient.provisional) {
    const tag = "PROVISIONAL — NOT THE FINAL RECORD";
    const tw = fonts.bold.widthOfTextAtSize(S(tag), a5 ? 7 : 8);
    ctx.page.drawText(S(tag), {
      x: (pageW - tw) / 2, y: ctx.y, size: a5 ? 7 : 8, font: fonts.bold,
      color: rgb(0.71, 0.16, 0.24),
    });
    ctx.y -= a5 ? 12 : 14;
  }

  // ── Patient strip ─────────────────────────────────────────────────────
  const strip: [string, string][] = [
    ["NAME", S(patient.name || "—")],
    ["AGE/SEX", S(`${patient.age || "—"} / ${patient.sex || "—"}`)],
    ["REFERRED BY", S(patient.referredBy || "—")],
    ["DATE", S(patient.date)],
  ];
  if (patient.serial?.trim()) {
    strip.push(["USG No.", S(patient.serial.trim())]);
  }
  const rowH = a5 ? 11 : 14;
  const col1W = contentW * 0.42;
  const col2W = contentW * 0.58;
  for (const [k, v] of strip) {
    ensure(ctx, rowH);
    ctx.page.drawRectangle({ x: margin, y: ctx.y - rowH, width: col1W, height: rowH, color: rgb(0.93, 0.95, 0.98) });
    ctx.page.drawText(S(k).toUpperCase(), { x: margin + 4, y: ctx.y - rowH + (a5 ? 3 : 4), size: a5 ? 6 : 7, font: fonts.bold, color: NAVY });
    ctx.page.drawText(v, { x: margin + col1W + 6, y: ctx.y - rowH + (a5 ? 3 : 4), size: base, font: fonts.bold, color: INK });
    ctx.y -= rowH;
    ctx.page.drawLine({ start: { x: margin, y: ctx.y }, end: { x: pageW - margin, y: ctx.y }, thickness: 0.5, color: LINE });
  }
  ctx.y -= a5 ? 10 : 14;

  // ── Study title ───────────────────────────────────────────────────────
  const studyTitle = S(resolved.title.toUpperCase());
  const stSize = a5 ? 11 : 13.5;
  const stw = fonts.bold.widthOfTextAtSize(studyTitle, stSize);
  ensure(ctx, stSize + 14);
  ctx.page.drawText(studyTitle, { x: (pageW - stw) / 2, y: ctx.y - stSize, size: stSize, font: fonts.bold, color: NAVY });
  ctx.y -= stSize + (a5 ? 8 : 10);

  const machineBanner = resolveMachineLine(settings as UsgPrintSettings);
  if (settings.usgShowMachine && machineBanner) {
    const line = S(machineBanner);
    const lw = fonts.italic.widthOfTextAtSize(line, a5 ? 7 : 8);
    ensure(ctx, 12);
    ctx.page.drawText(line, { x: (pageW - lw) / 2, y: ctx.y, size: a5 ? 7 : 8, font: fonts.italic, color: NAVY });
    ctx.y -= a5 ? 10 : 13;
  }

  // ── Section helper (no numeric badges — short reports read cleaner) ───
  const section = (label: string) => {
    ensure(ctx, base + (a5 ? 12 : 16));
    ctx.page.drawRectangle({ x: margin, y: ctx.y - (a5 ? 12 : 15), width: contentW, height: a5 ? 12 : 15, color: rgb(0.08, 0.24, 0.43) });
    ctx.page.drawText(S(label.toUpperCase()), { x: margin + 5, y: ctx.y - (a5 ? 9 : 11), size: a5 ? 7 : 8.5, font: fonts.bold, color: rgb(1, 1, 1) });
    ctx.y -= a5 ? 12 : 15;
    ctx.y -= a5 ? 5 : 7;
  };

  if (settings.usgPrintShowTechnique !== false && resolved.technique?.trim()) {
    section("Technique");
    for (const line of wrap(S(resolved.technique), fonts.reg, base, contentW)) {
      ensure(ctx, base + 3);
      ctx.page.drawText(line, { x: margin, y: ctx.y, size: base, font: fonts.reg, color: INK });
      ctx.y -= lead;
    }
    ctx.y -= gap(4);
  }

  // ── Findings ──────────────────────────────────────────────────────────
  section("Findings");
  const labelW = a5 ? 60 : 78;
  const bodyW = contentW - labelW - 8;
  for (const s of resolved.sections) {
    // Sentence-level bold: only abnormal claims, not measure/scaffold lines.
    const segs = s.abnormal
      ? segmentAbnormalFindings(s.text, s.normalText ?? "")
      : [{ text: s.text, bold: false as const }];
    type DrawnLine = { text: string; bold: boolean };
    const drawn: DrawnLine[] = [];
    for (const seg of segs) {
      if (/^\n+$/.test(seg.text)) {
        drawn.push({ text: "", bold: false });
        continue;
      }
      const font = seg.bold ? fonts.bold : fonts.reg;
      for (const line of wrap(S(seg.text.trim()), font, base, bodyW)) {
        drawn.push({ text: line, bold: seg.bold });
      }
    }
    if (!drawn.length) drawn.push({ text: "", bold: false });
    const blockH = Math.max(drawn.length * lead, a5 ? 14 : 17);
    if (ctx.y - blockH < ctx.margin + 30) {
      newPage(ctx);
    }
    ctx.page.drawText(S(s.label), { x: margin, y: ctx.y, size: a5 ? 6.5 : 7.5, font: fonts.bold, color: NAVY });
    let ly = ctx.y;
    for (const line of drawn) {
      if (line.text) {
        ctx.page.drawText(line.text, {
          x: margin + labelW,
          y: ly,
          size: base,
          font: line.bold ? fonts.bold : fonts.reg,
          color: INK,
        });
      }
      ly -= lead;
    }
    ctx.y -= Math.max(blockH, a5 ? 14 : 17) + gap(a5 ? 2 : 3);
    ctx.page.drawLine({ start: { x: margin, y: ctx.y + (a5 ? 2 : 3) }, end: { x: pageW - margin, y: ctx.y + (a5 ? 2 : 3) }, thickness: 0.4, color: LINE });
  }
  ctx.y -= gap(6);

  // ── Closing block (Impression + Advice + Signature) ───────────────────
  // multi: reserve so the signed closing never lands alone on a blank page.
  // one_page: stay on the current sheet — density above is sized to fit WA.
  const doctor = S(settings.usgDoctorName?.trim() || "Sonologist");
  if (!fitOnePage) {
    let closingH = (a5 ? 12 : 15) + gap(7); // Impression band
    for (const [i, line] of resolved.impression.entries()) {
      const numbered = `${i + 1}. ${S(line)}`;
      closingH += wrap(numbered, fonts.bold, base, contentW - 6).length * leadBold;
    }
    closingH += gap(4);
    if (resolved.suggestions.length) {
      closingH += (a5 ? 12 : 15) + gap(7);
      for (const s of resolved.suggestions) {
        closingH += wrap(S(s), fonts.bold, base - (a5 ? 0.5 : 1), contentW).length * base;
      }
      closingH += 4;
    }
    closingH += a5 ? 55 : 75; // signature block
    if (ctx.y - closingH < ctx.margin + 30) newPage(ctx);
  }

  // ── Impression ────────────────────────────────────────────────────────
  section("Impression");
  for (const [i, line] of resolved.impression.entries()) {
    const numbered = `${i + 1}. ${S(line)}`;
    for (const l of wrap(numbered, fonts.bold, base, contentW - 6)) {
      ensure(ctx, base + 3);
      ctx.page.drawText(l, { x: margin + 4, y: ctx.y, size: base, font: fonts.bold, color: INK });
      ctx.y -= leadBold;
    }
  }
  ctx.y -= gap(4);

  if (resolved.suggestions.length) {
    section("Advice");
    for (const s of resolved.suggestions) {
      for (const l of wrap(S(s), fonts.bold, base - (a5 ? 0.5 : 1), contentW)) {
        ensure(ctx, base);
        ctx.page.drawText(l, { x: margin, y: ctx.y, size: base - (a5 ? 0.5 : 1), font: fonts.bold, color: NAVY });
        ctx.y -= base;
      }
    }
    ctx.y -= 4;
  }

  // ── Auto fit: drop the signed tail to the foot of the sheet ───────────
  // Mirrors the HTML flex spacer. Moves the tail down only, never up, so a
  // study that already fills the page is left exactly as it was.
  if (settings.usgPrintBodyFit === "auto" && !a5) {
    const FOOT = 46; // clear of the footer rule drawn at y=34
    const subLines = [settings.usgDoctorQual, settings.usgDoctorRegNo ? "1" : ""].filter(Boolean).length;
    const tailH =
      (settings.usgSignatureUrl?.trim() ? (fitOnePage ? 21 : 29) : fitOnePage ? 8 : 14) +
      (fitOnePage ? 9 : 12) +
      (fitOnePage ? 8 : 11) +
      subLines * (fitOnePage ? 7 : 10) +
      (resolved.study.pcpndt ? 68 : 0) +
      (settings.usgDeclarationLine?.trim()
        ? Math.ceil(settings.usgDeclarationLine.trim().length / 95) * 9 + 6
        : 0);
    ctx.y = Math.max(ctx.y, FOOT + tailH);
  }

  // ── Signature ─────────────────────────────────────────────────────────
  ctx.y -= a5 ? 12 : fitOnePage ? 8 : 16;
  const sigW = a5 ? 130 : fitOnePage ? 150 : 170;
  const sigX = pageW - margin - sigW;
  if (settings.usgSignatureUrl?.trim()) {
    const sig = await embedDataUrl(doc, settings.usgSignatureUrl.trim());
    if (sig) {
      const h = a5 ? 20 : fitOnePage ? 18 : 26;
      const w = Math.min((sig.width / sig.height) * h, sigW);
      ctx.page.drawImage(sig, { x: sigX + (sigW - w) / 2, y: ctx.y, width: w, height: h });
      ctx.y -= h + 3;
    }
  } else {
    ctx.y -= a5 ? 10 : fitOnePage ? 8 : 14;
  }
  ctx.page.drawLine({ start: { x: sigX, y: ctx.y }, end: { x: sigX + sigW, y: ctx.y }, thickness: 1.2, color: NAVY });
  ctx.y -= a5 ? 10 : fitOnePage ? 9 : 12;
  ctx.page.drawText(doctor, { x: sigX, y: ctx.y, size: a5 ? 8.5 : fitOnePage ? 9.5 : 10.5, font: fonts.bold, color: NAVY });
  ctx.y -= a5 ? 9 : fitOnePage ? 8 : 11;
  for (const sub of [settings.usgDoctorQual, settings.usgDoctorRegNo ? `Reg. No: ${settings.usgDoctorRegNo}` : ""].filter(Boolean)) {
    ctx.page.drawText(S(sub), { x: sigX, y: ctx.y, size: a5 ? 6.5 : fitOnePage ? 7 : 8, font: fonts.reg, color: GREY });
    ctx.y -= a5 ? 8 : fitOnePage ? 7 : 10;
  }

  // ── Verification QR beside the signature ──────────────────────────────
  // On the signed line, to its left. It used to sit in the page footer, which
  // cost a band of paper under an already short tail and landed on the stills
  // appendix page whenever the report had images.
  if (settings.usgPrintQrEnabled !== false && qrPng) {
    const qrImg = await doc.embedPng(qrPng);
    const size = a5 ? 26 : 38;
    const capSize = a5 ? 5 : 6;
    const bottom = ctx.y + 2;
    const cap = "scan to verify";
    const cw = fonts.reg.widthOfTextAtSize(cap, capSize);
    ctx.page.drawImage(qrImg, { x: sigX - size - 14, y: bottom, width: size, height: size });
    ctx.page.drawText(cap, { x: sigX - 14 - cw, y: bottom - capSize - 2, size: capSize, font: fonts.reg, color: GREY });
  }

  // ── PC-PNDT declaration (obstetric scans) ─────────────────────────────
  if (resolved.study.pcpndt) {
    ensure(ctx, a5 ? 46 : 58);
    ctx.y -= 10;
    const boxH = a5 ? 40 : 52;
    ctx.page.drawRectangle({ x: margin, y: ctx.y - boxH, width: contentW, height: boxH, borderColor: NAVY, borderWidth: 0.8 });
    ctx.page.drawText("DECLARATION OF DOCTOR PERFORMING ULTRA SONOGRAPHY", {
      x: margin + 5, y: ctx.y - 12, size: a5 ? 6.5 : 8, font: fonts.bold, color: NAVY,
    });
    const decl = S(
      `I ${doctor}${settings.usgDoctorQual ? `, ${settings.usgDoctorQual}` : ""} declare that while conducting USG on above patient, I have neither detected nor disclosed the sex of the foetus to anybody in any manner.`,
    );
    for (const l of wrap(decl, fonts.reg, a5 ? 6.5 : 8, contentW - 12)) {
      ctx.page.drawText(l, { x: margin + 5, y: ctx.y - (a5 ? 20 : 24), size: a5 ? 6.5 : 8, font: fonts.reg, color: INK });
      ctx.y -= a5 ? 7 : 9;
    }
    ctx.y -= boxH - (a5 ? 20 : 24) + 6;
  }

  if (settings.usgDeclarationLine?.trim()) {
    ensure(ctx, 26);
    for (const l of wrap(S(settings.usgDeclarationLine.trim()), fonts.reg, a5 ? 6 : 7.5, contentW)) {
      ctx.page.drawText(l, { x: margin, y: ctx.y, size: a5 ? 6 : 7.5, font: fonts.reg, color: GREY });
      ctx.y -= a5 ? 7 : 9;
    }
  }

  // ── Images appendix (own page after the signed clinical body) ─────────
  // Keeps findings readable at full size; stills no longer compete for page 1.
  if (images.length) {
    newPage(ctx);
    section("USG Images");
    const cols = 2;
    const imgGap = a5 ? 6 : 10;
    const cellW = (contentW - imgGap) / cols;
    const cellH = a5 ? 90 : 120;
    let col = 0;
    let rowTop = ctx.y;
    for (const img of images) {
      const image = await embedDataUrl(doc, img.dataUrl);
      if (!image) continue;
      if (col === 0) {
        ensure(ctx, cellH + 14);
        rowTop = ctx.y;
      }
      const x = margin + col * (cellW + imgGap);
      const maxImgH = cellH - (a5 ? 10 : 12);
      const scale = Math.min(cellW / image.width, maxImgH / image.height);
      const w = image.width * scale;
      const h = image.height * scale;
      ctx.page.drawImage(image, { x: x + (cellW - w) / 2, y: rowTop - h, width: w, height: h });
      if (img.caption) {
        const cap = S(img.caption);
        const cw = Math.min(fonts.reg.widthOfTextAtSize(cap, a5 ? 6 : 7), cellW);
        ctx.page.drawText(cap.slice(0, 60), { x: x + (cellW - cw) / 2, y: rowTop - h - (a5 ? 7 : 9), size: a5 ? 6 : 7, font: fonts.reg, color: GREY });
      }
      ctx.page.drawRectangle({ x, y: rowTop - cellH, width: cellW, height: cellH, borderColor: LINE, borderWidth: 0.7 });
      col++;
      if (col === cols) {
        col = 0;
        ctx.y = rowTop - cellH - (a5 ? 8 : 12);
      }
    }
    if (col !== 0) ctx.y = rowTop - cellH - (a5 ? 8 : 12);
  }

  // ── Footer ────────────────────────────────────────────────────────────
  // The verification QR moved up beside the signature, so the band no longer
  // reserves its right-hand width and the footer line stops being truncated
  // short of the page.
  for (const p of ctx.pages) {
    p.drawLine({
      start: { x: margin, y: 34 }, end: { x: pageW - margin, y: 34 }, thickness: 1, color: NAVY,
    });
    const brand = S(clinicDisplayName(settings));
    const bw = fonts.bold.widthOfTextAtSize(brand, a5 ? 6 : 7);
    const brandX = Math.max(margin, pageW - margin - bw);
    const footer = S(clinicFooterText(settings));
    if (footer) {
      const maxFooterW = brandX - margin - 8;
      // Truncate by approximate glyph width so the text stops left of the brand.
      let text = footer;
      while (fonts.reg.widthOfTextAtSize(S(text), a5 ? 6 : 7) > maxFooterW && text.length > 8) {
        text = text.slice(0, -4);
      }
      if (text.length < footer.length) text = `${text.trimEnd()}…`;
      p.drawText(S(text), { x: margin, y: 24, size: a5 ? 6 : 7, font: fonts.reg, color: GREY });
    }
    p.drawText(brand, { x: brandX, y: 24, size: a5 ? 6 : 7, font: fonts.bold, color: GREY });
  }

  // ── PROVISIONAL watermark on every page ───────────────────────────────
  if (patient.provisional) {
    for (const p of ctx.pages) {
      const wt = "PROVISIONAL";
      const size = a5 ? 34 : 46;
      const ww = fonts.bold.widthOfTextAtSize(wt, size);
      p.drawText(wt, {
        x: (pageW - ww) / 2 - (a5 ? 30 : 40),
        y: pageH / 2 - size / 2,
        size, font: fonts.bold, color: rgb(0.71, 0.16, 0.24), opacity: 0.08,
        rotate: { type: "degrees", angle: -28 } as never,
      });
    }
  }

  return doc.save();
}
