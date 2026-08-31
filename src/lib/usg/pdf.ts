/**
 * USG Studio — server-side PDF report (v5 phase 9).
 *
 * A real PDF (pdf-lib, vector text) mirroring the classic letterhead: hospital
 * header, patient strip, study title, technique, findings rows (word-wrapped),
 * stills grid, impression, suggestions, signature image + credentials,
 * declaration / PC-PNDT block and the verification QR. A4 or A5, paginated.
 * Drafts carry the diagonal PROVISIONAL watermark, same as the HTML print.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import type { UsgResolved } from "./types";
import type { UsgPrintSettings, UsgPrintImage } from "./print";

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

/** Sanitise to WinAnsi-safe text for the standard fonts. */
const S = (s: string) =>
  String(s ?? "")
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
  const margin = a5 ? 26 : 40;
  const contentW = pageW - margin * 2;
  const base = compact ? (a5 ? 7.5 : 8.5) : a5 ? 8.5 : 9.5;

  const first = doc.addPage([pageW, pageH]);
  const ctx: Ctx = {
    doc, page: first, y: pageH - margin, fonts, pageW, pageH, margin, contentW, pages: [first],
  };

  // ── Header ────────────────────────────────────────────────────────────
  const hospital = S(settings.hospitalName || settings.appTitle || "USG Studio");
  const titleSize = a5 ? 15 : 19;
  ensure(ctx, titleSize + 30);
  let headerX = margin;
  let logo: PDFImage | null = null;
  if (settings.logoUrl) logo = await embedDataUrl(doc, settings.logoUrl);
  if (logo) {
    const h = a5 ? 24 : 30;
    const w = (logo.width / logo.height) * h;
    ctx.page.drawImage(logo, { x: margin, y: ctx.y - h, height: h, width: Math.min(w, contentW * 0.25) });
    headerX = margin + Math.min(w, contentW * 0.25) + 10;
  }
  ctx.page.drawText(hospital, { x: headerX, y: ctx.y - titleSize, size: titleSize, font: fonts.bold, color: NAVY });
  const contact = S(
    [settings.addressLine, settings.phone, settings.email].filter((x) => x && x.trim()).join("  ·  "),
  );
  if (contact) {
    ctx.page.drawText(contact, { x: headerX, y: ctx.y - titleSize - (a5 ? 10 : 12), size: a5 ? 6.5 : 8, font: fonts.reg, color: GREY });
  }
  ctx.y -= titleSize + (a5 ? 18 : 24);
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
    ["Patient", S(patient.name || "—")],
    ["Age / Sex", S(`${patient.age || "—"} / ${patient.sex || "—"}`)],
    ["USG No.", patient.serial ? S(patient.serial) : "—"],
    ["Referred by", S(patient.referredBy || "—")],
    ["Date", S(patient.date)],
  ];
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

  if (settings.usgShowMachine && settings.usgMachineLine?.trim()) {
    const line = S(settings.usgMachineLine.trim());
    const lw = fonts.italic.widthOfTextAtSize(line, a5 ? 7 : 8);
    ensure(ctx, 12);
    ctx.page.drawText(line, { x: (pageW - lw) / 2, y: ctx.y, size: a5 ? 7 : 8, font: fonts.italic, color: NAVY });
    ctx.y -= a5 ? 10 : 13;
  }

  // ── Section helper ────────────────────────────────────────────────────
  const section = (label: string, n: number) => {
    ensure(ctx, base + (a5 ? 12 : 16));
    ctx.page.drawRectangle({ x: margin, y: ctx.y - (a5 ? 12 : 15), width: contentW, height: a5 ? 12 : 15, color: rgb(0.08, 0.24, 0.43) });
    ctx.page.drawText(S(`${n}. ${label.toUpperCase()}`), { x: margin + 5, y: ctx.y - (a5 ? 9 : 11), size: a5 ? 7 : 8.5, font: fonts.bold, color: rgb(1, 1, 1) });
    ctx.y -= a5 ? 12 : 15;
    ctx.y -= a5 ? 5 : 7;
  };

  let n = 1;
  if (resolved.technique?.trim()) {
    section("Technique", n++);
    for (const line of wrap(S(resolved.technique), fonts.reg, base, contentW)) {
      ensure(ctx, base + 3);
      ctx.page.drawText(line, { x: margin, y: ctx.y, size: base, font: fonts.reg, color: INK });
      ctx.y -= base + 2.5;
    }
    ctx.y -= 4;
  }

  // ── Findings ──────────────────────────────────────────────────────────
  section("Findings", n++);
  const labelW = a5 ? 60 : 78;
  for (const s of resolved.sections) {
    const lines = wrap(S(s.text), fonts.reg, base, contentW - labelW - 8);
    const blockH = Math.max(lines.length * (base + 2.5), a5 ? 14 : 17);
    if (ctx.y - blockH < ctx.margin + 30) {
      newPage(ctx);
    }
    ctx.page.drawText(S(s.label), { x: margin, y: ctx.y, size: a5 ? 6.5 : 7.5, font: fonts.bold, color: NAVY });
    let ly = ctx.y;
    for (const line of lines) {
      ctx.page.drawText(line, { x: margin + labelW, y: ly, size: base, font: fonts.reg, color: INK });
      ly -= base + 2.5;
    }
    ctx.y -= Math.max(blockH, a5 ? 14 : 17) + (a5 ? 2 : 3);
    ctx.page.drawLine({ start: { x: margin, y: ctx.y + (a5 ? 2 : 3) }, end: { x: pageW - margin, y: ctx.y + (a5 ? 2 : 3) }, thickness: 0.4, color: LINE });
  }
  ctx.y -= 6;

  // ── Images ────────────────────────────────────────────────────────────
  if (images.length) {
    section("USG Images", n++);
    const cols = 2;
    const gap = a5 ? 6 : 10;
    const cellW = (contentW - gap) / cols;
    const cellH = a5 ? 78 : 108;
    let col = 0;
    let rowTop = ctx.y;
    for (const img of images) {
      const image = await embedDataUrl(doc, img.dataUrl);
      if (!image) continue;
      if (col === 0) {
        ensure(ctx, cellH + 14);
        rowTop = ctx.y;
      }
      const x = margin + col * (cellW + gap);
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
    ctx.y -= 4;
  }

  // ── Impression ────────────────────────────────────────────────────────
  section("Impression", n++);
  for (const [i, line] of resolved.impression.entries()) {
    const numbered = `${i + 1}. ${S(line)}`;
    for (const l of wrap(numbered, fonts.bold, base, contentW - 6)) {
      ensure(ctx, base + 3);
      ctx.page.drawText(l, { x: margin + 4, y: ctx.y, size: base, font: fonts.bold, color: INK });
      ctx.y -= base + 3;
    }
  }
  ctx.y -= 4;

  if (resolved.suggestions.length) {
    for (const s of resolved.suggestions) {
      for (const l of wrap(S(s), fonts.bold, base - (a5 ? 0.5 : 1), contentW)) {
        ensure(ctx, base);
        ctx.page.drawText(l, { x: margin, y: ctx.y, size: base - (a5 ? 0.5 : 1), font: fonts.bold, color: NAVY });
        ctx.y -= base;
      }
    }
    ctx.y -= 4;
  }

  // ── Signature ─────────────────────────────────────────────────────────
  ensure(ctx, a5 ? 55 : 75);
  ctx.y -= a5 ? 18 : 26;
  const doctor = S(settings.usgDoctorName?.trim() || "Sonologist");
  const sigW = a5 ? 130 : 170;
  const sigX = pageW - margin - sigW;
  if (settings.usgSignatureUrl?.trim()) {
    const sig = await embedDataUrl(doc, settings.usgSignatureUrl.trim());
    if (sig) {
      const h = a5 ? 20 : 26;
      const w = Math.min((sig.width / sig.height) * h, sigW);
      ctx.page.drawImage(sig, { x: sigX + (sigW - w) / 2, y: ctx.y, width: w, height: h });
      ctx.y -= h + 4;
    }
  } else {
    ctx.y -= a5 ? 10 : 14;
  }
  ctx.page.drawLine({ start: { x: sigX, y: ctx.y }, end: { x: sigX + sigW, y: ctx.y }, thickness: 1.2, color: NAVY });
  ctx.y -= a5 ? 10 : 12;
  ctx.page.drawText(doctor, { x: sigX, y: ctx.y, size: a5 ? 8.5 : 10.5, font: fonts.bold, color: NAVY });
  ctx.y -= a5 ? 9 : 11;
  for (const sub of [settings.usgDoctorQual, settings.usgDoctorRegNo ? `Reg. No: ${settings.usgDoctorRegNo}` : ""].filter(Boolean)) {
    ctx.page.drawText(S(sub), { x: sigX, y: ctx.y, size: a5 ? 6.5 : 8, font: fonts.reg, color: GREY });
    ctx.y -= a5 ? 8 : 10;
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

  // ── Footer + QR ───────────────────────────────────────────────────────
  for (const p of ctx.pages) {
    p.drawLine({
      start: { x: margin, y: 34 }, end: { x: pageW - margin, y: 34 }, thickness: 1, color: NAVY,
    });
    const footer = S(settings.usgFooterLine || settings.footerMessage);
    if (footer) {
      p.drawText(footer.slice(0, 90), { x: margin, y: 24, size: a5 ? 6 : 7, font: fonts.reg, color: GREY });
    }
    const brand = S(settings.appTitle || "CARE USG Studio");
    const bw = fonts.bold.widthOfTextAtSize(brand, a5 ? 6 : 7);
    p.drawText(brand, { x: pageW - margin - bw - (qrPng ? (a5 ? 30 : 38) : 0), y: 24, size: a5 ? 6 : 7, font: fonts.bold, color: GREY });
  }
  if (qrPng) {
    const qrImg = await ctx.doc.embedPng(qrPng);
    const size = a5 ? 24 : 32;
    const last = ctx.pages[ctx.pages.length - 1];
    last.drawImage(qrImg, { x: pageW - margin - size, y: 20, width: size, height: size });
    const cap = "verify";
    const cw = fonts.reg.widthOfTextAtSize(cap, a5 ? 5.5 : 6.5);
    last.drawText(cap, { x: pageW - margin - size + (size - cw) / 2, y: size + 22, size: a5 ? 5.5 : 6.5, font: fonts.reg, color: GREY });
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
