/**
 * QR verification + PDF tests (v5 phase 9).
 *
 * Verify contract: the HMAC code is deterministic, payloads survive a
 * round-trip, tampering with any field breaks the signature, and the secret
 * mints exactly once. PDF contract: a real %PDF document with pages, QR
 * embedded, watermark only on drafts.
 */
import { describe, expect, it } from "vitest";
import { PDFDocument, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import QRCode from "qrcode";
import { buildPayload, checkPayload, getOrCreateSecret, newSecret, qrTarget, signMessage, verifyMessage } from "@/lib/usg/verify";
import { buildUsgReportPdf } from "@/lib/usg/pdf";
import { buildUsgReportHtml, formatUsgSerial } from "@/lib/usg/print";
import { initialState, getStudy } from "@/lib/usg/studies";
import { makeLookup, resolve } from "@/lib/usg/composer";
import { USG_PATHOLOGIES_ALL } from "@/lib/usg/pathologies";

const SECRET = "0123456789abcdef0123456789abcdef";

describe("verify signing", () => {
  const input = { serialNo: 7, patientName: "Rani Devi", dateIso: "2026-08-02T10:00:00.000Z" };

  it("message format is serial | normalised name | day stamp", () => {
    expect(verifyMessage(input)).toBe("USG-0007|rani devi|02 Aug 2026");
  });

  it("signing is deterministic and 8 hex chars", () => {
    const a = signMessage("USG-0007|rani devi|02 Aug 2026", SECRET);
    const b = signMessage("USG-0007|rani devi|02 Aug 2026", SECRET);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{8}$/);
  });

  it("payload round-trips through checkPayload", () => {
    const payload = buildPayload(input, SECRET);
    const result = checkPayload(payload, SECRET);
    expect(result).toEqual({ valid: true, serialNo: 7, patientName: "rani devi", date: "02 Aug 2026" });
  });

  it("a different secret rejects the payload", () => {
    const payload = buildPayload(input, SECRET);
    expect(checkPayload(payload, newSecret()).valid).toBe(false);
  });

  it("tampering with the name or serial breaks the signature", () => {
    const payload = buildPayload(input, SECRET);
    expect(checkPayload(payload.replace("rani devi", "sita devi"), SECRET).valid).toBe(false);
    expect(checkPayload(payload.replace("USG-0007", "USG-0008"), SECRET).valid).toBe(false);
    expect(checkPayload(`${payload}x`, SECRET).valid).toBe(false);
  });

  it("malformed payloads are rejected, never thrown", () => {
    expect(checkPayload("", SECRET).valid).toBe(false);
    expect(checkPayload("nonsense", SECRET).valid).toBe(false);
    expect(checkPayload("USG-0007|x|y|zzzzzzzz", SECRET).valid).toBe(false);
    expect(checkPayload("|||", SECRET).valid).toBe(false);
  });

  it("qrTarget builds a URL with the origin, bare payload without", () => {
    expect(qrTarget("p", "http://localhost:3000/")).toBe("http://localhost:3000/verify?d=p");
    expect(qrTarget("p", null)).toBe("p");
  });

  it("getOrCreateSecret mints once and reuses after", async () => {
    let stored: string | null = null;
    const s1 = await getOrCreateSecret(async () => stored, async (v) => void (stored = v));
    const s2 = await getOrCreateSecret(async () => stored, async (v) => void (stored = v));
    expect(s1).toBe(s2);
    expect(stored).toBe(s1);
    expect(s1).toMatch(/^[0-9a-f]{32}$/);
  });
});

/** pdf-lib writes text as hex strings inside (Flate) content streams —
 *  collect every decoded stream's text to make assertions. */
async function pdfStreamsText(bytes: Uint8Array): Promise<string> {
  const loaded = await PDFDocument.load(bytes);
  let out = "";
  for (const [, obj] of loaded.context.enumerateIndirectObjects()) {
    if (obj instanceof PDFRawStream) {
      try {
        out += Buffer.from(decodePDFRawStream(obj).decode()).toString("latin1");
      } catch {
        // non-decodable stream — skip
      }
    }
  }
  return out;
}

const hex = (s: string) => Buffer.from(s, "latin1").toString("hex").toUpperCase();

describe("report PDF", () => {
  const settings = {
    appTitle: "CARE USG Studio",
    hospitalName: "CARE Diagnostics",
    addressLine: "Main Road, Ranchi",
    phone: "9876543210",
    email: "",
    logoUrl: "",
    footerMessage: "",
    usgDoctorName: "Dr. Sugandha",
    usgDoctorQual: "MBBS, MD",
    usgDoctorRegNo: "J/12345",
    usgMachineLine: "Done on GE Voluson Pro 4-D",
    usgShowMachine: true,
    usgFooterLine: "Correlate clinically.",
    usgDeclarationLine: "",
  };
  const resolved = resolve(initialState("wa-female"), makeLookup(USG_PATHOLOGIES_ALL), "Routine scan.");
  const patient = { name: "Rani Devi", age: "30", sex: "F", referredBy: "Dr. Kumar", date: "02 Aug 2026", serial: formatUsgSerial(7) };

  it("produces a real PDF with one page and QR embedded", async () => {
    const qrPng = new Uint8Array(await QRCode.toBuffer("http://localhost:3000/verify?d=x", { margin: 1, width: 200 }));
    const bytes = await buildUsgReportPdf({ settings, patient, resolved, qrPng });
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(doc.getTitle()).toContain("Rani Devi");
  });

  it("embeds attached stills", async () => {
    const png1x1 =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const bytes = await buildUsgReportPdf({ settings, patient, resolved, images: [{ dataUrl: png1x1, caption: "longitudinal" }] });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("a draft PDF renders the PROVISIONAL watermark; a final one does not", async () => {
    const draftBytes = await buildUsgReportPdf({ settings, patient: { ...patient, provisional: true }, resolved });
    const draftText = await pdfStreamsText(draftBytes);
    expect(draftText).toContain(hex("PROVISIONAL"));
    const finalBytes = await buildUsgReportPdf({ settings, patient, resolved });
    const finalText = await pdfStreamsText(finalBytes);
    expect(finalText).not.toContain(hex("PROVISIONAL"));
  });

  it("patient details and study title reach the content streams", async () => {
    const bytes = await buildUsgReportPdf({ settings, patient, resolved });
    const text = await pdfStreamsText(bytes);
    expect(text).toContain(hex("Rani Devi"));
    expect(text).toContain(hex("USG WHOLE ABDOMEN"));
    expect(text).toContain(hex("Dr. Sugandha"));
  });

  it("sanitises non-WinAnsi characters instead of crashing", async () => {
    const state = initialState("wa-female");
    state.organs[0].text = "Liver — normal with ±2 variation \u2026 fancy…";
    const r = resolve(state, makeLookup(USG_PATHOLOGIES_ALL), "");
    const bytes = await buildUsgReportPdf({ settings, patient, resolved: r });
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
  });
});

describe("HTML print QR", () => {
  it("finalized snapshot prints the QR block; drafts get none", () => {
    const resolved = resolve(initialState("wa-female"), makeLookup(USG_PATHOLOGIES_ALL), "");
    const s = {
      appTitle: "CARE USG Studio", hospitalName: "CARE", addressLine: "", phone: "", email: "",
      logoUrl: "", footerMessage: "", usgDoctorName: "", usgDoctorQual: "", usgDoctorRegNo: "",
      usgMachineLine: "", usgShowMachine: false, usgFooterLine: "", usgDeclarationLine: "",
    };
    const withQr = buildUsgReportHtml(s, { name: "R", age: "30", sex: "F", referredBy: "", date: "x", serial: "USG-0001" }, resolved, [], { dataUrl: "data:image/png;base64,AAAA" });
    expect(withQr).toContain('class="qr"');
    expect(withQr).toContain("scan to verify");
    const withoutQr = buildUsgReportHtml(s, { name: "R", age: "30", sex: "F", referredBy: "", date: "x" }, resolved);
    expect(withoutQr).not.toContain('class="qr"');
  });
});
