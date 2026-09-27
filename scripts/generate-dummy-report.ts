/**
 * One-shot: write dummy letterpad preview + print HTML + PDF artifacts.
 * Run: npx vitest run scripts/generate-dummy-report.ts
 */
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { buildUsgReportHtml } from "../src/lib/usg/print";
import { buildUsgReportPdf } from "../src/lib/usg/pdf";
import { initialState } from "../src/lib/usg/studies";
import { applyPathology, makeLookup, resolve } from "../src/lib/usg/composer";
import { USG_PATHOLOGIES_ALL } from "../src/lib/usg/pathologies";

const SETTINGS = {
  appTitle: "CARE USG Studio",
  hospitalName: "CARE Diagnostics",
  addressLine: "Castair's Town, Subhash Chowk, Deoghar, Jharkhand - 814112",
  phone: "+91 9973497200",
  email: "care.deoghar@gmail.com",
  logoUrl: "",
  footerMessage: "Kindly co-relate with clinico-pathological findings.",
  usgDoctorName: "Sugandha Priyadarshini",
  usgDoctorQual: "MBBS, MD(Radiology)",
  usgDoctorRegNo: "J/12345",
  usgMachineLine: "This Scan has been proudly done on GE Voluson 4-D USG Machine",
  usgShowMachine: true,
  usgFooterLine: "Kindly co-relate with clinico-pathological findings.",
  usgDeclarationLine: "",
  usgPrintStyle: "premium",
  usgPrintCompact: false,
  usgPrintBodyFit: "one_page",
  usgPrintPaper: "a4",
  usgSignatureUrl: "",
  usgPrintFontSize: 10,
  usgPrintLineHeight: 1.4,
  usgPrintSpacing: "tight",
  usgPrintShowTechnique: true,
  usgPrintShowThanks: true,
  usgLogoSizeMm: 14,
} as const;

const PATIENT = {
  name: "Laxmi Patel",
  age: "26",
  sex: "F",
  referredBy: "AIIMS DEOGHAR",
  date: "27 Sept 2026",
  serial: "USG-0015",
  provisional: false,
};

const lookup = makeLookup(USG_PATHOLOGIES_ALL);
let state = initialState("wa-female");
state = applyPathology(state, "liver", "liver-fatty-g1", lookup);
const resolved = resolve(state, lookup, "Routine transabdominal scan.");

const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC";
const images = [
  { dataUrl: png, caption: "Liver long" },
  { dataUrl: png, caption: "GB long" },
  { dataUrl: png, caption: "Right kidney" },
  { dataUrl: png, caption: "Left kidney" },
];

const outDirs = ["/opt/cursor/artifacts", "/tmp/dummy-report"];
for (const d of outDirs) mkdirSync(d, { recursive: true });

const preview = buildUsgReportHtml(SETTINGS as any, PATIENT, resolved, images, null, {
  preview: true,
});
const printOne = buildUsgReportHtml(SETTINGS as any, PATIENT, resolved, images, null);
const printMulti = buildUsgReportHtml(
  { ...SETTINGS, usgPrintBodyFit: "multi" } as any,
  PATIENT,
  resolved,
  images,
  null,
);

for (const d of outDirs) {
  writeFileSync(join(d, "dummy-letterpad-preview.html"), preview);
  writeFileSync(join(d, "dummy-print-report.html"), printOne);
  writeFileSync(join(d, "dummy-print-report-multi.html"), printMulti);
}

const pdfOne = await buildUsgReportPdf({
  settings: SETTINGS as any,
  patient: PATIENT,
  resolved,
  images,
});
const pdfMulti = await buildUsgReportPdf({
  settings: { ...SETTINGS, usgPrintBodyFit: "multi" } as any,
  patient: PATIENT,
  resolved,
  images,
});
for (const d of outDirs) {
  writeFileSync(join(d, "dummy-report.pdf"), Buffer.from(pdfOne));
  writeFileSync(join(d, "dummy-report-multi.pdf"), Buffer.from(pdfMulti));
}

console.log(
  JSON.stringify(
    {
      previewBytes: preview.length,
      printOneBytes: printOne.length,
      printMultiBytes: printMulti.length,
      pdfOneBytes: pdfOne.length,
      pdfMultiBytes: pdfMulti.length,
      previewHasDemoStrip: preview.includes("demo-strip"),
      previewHasMasthead: preview.includes('class="masthead"'),
      onePageCss: printOne.includes("Pack letterhead") || printOne.includes("font-size: 8.7pt"),
      imagesAppendix: printOne.includes("images-appendix"),
      noZoom: !printOne.includes("beforeprint"),
      wrote: outDirs,
    },
    null,
    2,
  ),
);
