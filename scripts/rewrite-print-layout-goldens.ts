/**
 * Deliberate golden rewrite after letterpad preview / body-fit / images-appendix
 * print layout changes. Do NOT use `vitest -u`.
 */
import { writeFileSync } from "fs";
import { join } from "path";
import { buildUsgReportHtml } from "../src/lib/usg/print";
import { initialState } from "../src/lib/usg/studies";
import { applyPathology, makeLookup, resolve } from "../src/lib/usg/composer";
import { USG_PATHOLOGIES_ALL } from "../src/lib/usg/pathologies";

const SETTINGS = {
  appTitle: "CARE USG Studio",
  hospitalName: "CARE Diagnostics",
  addressLine: "Subhash Chowk, Deoghar",
  phone: "06432-123456",
  email: "care@example.com",
  logoUrl: "",
  footerMessage: "Precision. Compassion. Care.",
  usgDoctorName: "Dr. Sugandha",
  usgDoctorQual: "MBBS, MD",
  usgDoctorRegNo: "J/12345",
  usgMachineLine: "GE Voluson Pro",
  usgShowMachine: true,
  usgFooterLine: "Correlate clinically.",
  usgDeclarationLine: "",
  usgPrintCompact: false,
  usgPrintPaper: "a4",
  usgSignatureUrl: "",
  usgPrintFontSize: 10,
  usgPrintLineHeight: 1.4,
  usgPrintSpacing: "tight",
  usgPrintShowTechnique: true,
  usgPrintShowThanks: true,
  usgSidebarPosition: "right",
  usgLogoPosition: "left",
  usgLogoSizeMm: 14,
} as const;

const PATIENT = {
  name: "Rani Devi",
  age: "30",
  sex: "F",
  referredBy: "Dr. Kumar",
  date: "01-Sep-2026",
  serial: "USG-0001",
};

const REF_MS = Date.parse("2026-09-01T12:00:00.000Z");
const lookup = makeLookup(USG_PATHOLOGIES_ALL);

function resolved() {
  const state = applyPathology(initialState("wa-female"), "liver", "liver-fatty-g1", lookup);
  return resolve(state, lookup, "Routine transabdominal scan.");
}

function normalize(html: string): string {
  return html.replace(/\r\n/g, "\n").trim() + "\n";
}

const dir = join(process.cwd(), "tests/__golden__");
function write(name: string, html: string) {
  writeFileSync(join(dir, name), normalize(html), "utf8");
  console.log("wrote", name);
}

write(
  "print-classic.html",
  buildUsgReportHtml({ ...SETTINGS, usgPrintStyle: "classic" } as any, PATIENT, resolved()),
);
write(
  "print-premium.html",
  buildUsgReportHtml({ ...SETTINGS, usgPrintStyle: "premium" } as any, PATIENT, resolved()),
);
write(
  "print-sidebar.html",
  buildUsgReportHtml({ ...SETTINGS, usgPrintStyle: "premium_sidebar" } as any, PATIENT, resolved(), [
    { dataUrl: "data:image/png;base64,AAAA", caption: "still" },
  ]),
);

const RealDate = Date;
class FakeDate extends RealDate {
  constructor(...args: any[]) {
    if (args.length === 0) super(REF_MS);
    else super(...(args as [any]));
  }
  static now() {
    return REF_MS;
  }
}
(globalThis as any).Date = FakeDate;

write(
  "04-abdomen-a5-compact.html",
  buildUsgReportHtml(
    { ...SETTINGS, usgPrintStyle: "premium", usgPrintPaper: "a5", usgPrintCompact: true } as any,
    PATIENT,
    resolved(),
  ),
);
write(
  "05-ob-provisional.html",
  buildUsgReportHtml(
    { ...SETTINGS, usgPrintStyle: "premium" } as any,
    { ...PATIENT, name: "Sita Kumari", age: "26", serial: "USG-0002", provisional: true },
    resolve(initialState("ob"), lookup, "Antenatal scan."),
  ),
);
write(
  "06-thyroid-sidebar.html",
  buildUsgReportHtml(
    { ...SETTINGS, usgPrintStyle: "premium_sidebar" } as any,
    { ...PATIENT, name: "Meera Devi", age: "45", sex: "F", serial: "USG-0003" },
    resolve(initialState("thyroid"), lookup, "High-resolution thyroid ultrasound."),
    [{ dataUrl: "data:image/png;base64,AAAA", caption: "thyroid still" }],
  ),
);
write(
  "07-ob-bpp-grid.html",
  buildUsgReportHtml(
    { ...SETTINGS, usgPrintStyle: "premium" } as any,
    { ...PATIENT, name: "Anita Devi", age: "28", serial: "USG-0004" },
    resolve(initialState("ob-bpp"), lookup, "Biophysical profile scan."),
  ),
);
const qrPng =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
write(
  "08-abdomen-images-qr.html",
  buildUsgReportHtml(
    { ...SETTINGS, usgPrintStyle: "premium" } as any,
    PATIENT,
    resolved(),
    [
      { dataUrl: "data:image/png;base64,AAAA", caption: "liver long" },
      { dataUrl: "data:image/png;base64,BBBB", caption: "kidney coronal" },
    ],
    { dataUrl: qrPng },
  ),
);

(globalThis as any).Date = RealDate;
console.log("done");
