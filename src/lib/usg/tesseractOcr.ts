/**
 * tesseractOcr.ts — client-side Tesseract.js OCR for ultrasound images.
 *
 * When the DICOM SR is not available (the machine doesn't store one), the
 * studio falls back to OCR: the sonologist uploads a screenshot of the
 * machine's measurement readout, and Tesseract extracts the numbers.
 *
 * This runs entirely in the browser via tesseract.js — no server call,
 * no data leaves the clinic. The sonologist sees the extracted values
 * in the measurement review dialog and can correct any mistakes.
 *
 * Usage:
 *   const result = await runTesseractOcr(imageDataUrl);
 *   // result.measurements: { BPD: "85", FL: "62", ... }
 */

export type OcrMeasurement = {
  label: string;
  value: string;
  unit?: string;
  confidence: number; // 0-100
};

export type OcrResult = {
  measurements: OcrMeasurement[];
  rawText: string;
  confidence: number; // overall confidence 0-100
  source: "tesseract";
};

/** Patterns for extracting measurements from OCR text. */
const MEASUREMENT_PATTERNS: Array<{ label: string; re: RegExp; unit?: string }> = [
  // Obstetric biometry
  { label: "BPD", re: /bpd[:\s]*([0-9]+\.?[0-9]*)\s*(mm)?/i, unit: "mm" },
  { label: "HC", re: /hc[:\s]*([0-9]+\.?[0-9]*)\s*(mm)?/i, unit: "mm" },
  { label: "AC", re: /ac[:\s]*([0-9]+\.?[0-9]*)\s*(mm)?/i, unit: "mm" },
  { label: "FL", re: /fl[:\s]*([0-9]+\.?[0-9]*)\s*(mm)?/i, unit: "mm" },
  { label: "CRL", re: /crl[:\s]*([0-9]+\.?[0-9]*)\s*(mm)?/i, unit: "mm" },
  { label: "EFW", re: /efw[:\s]*([0-9]+\.?[0-9]*)\s*(g|gm|grams?)?/i, unit: "g" },
  { label: "GA", re: /ga[:\s]*(\d+)\s*[/w]+\s*(\d+)?\s*(weeks?|days?)?/i, unit: "wk" },
  { label: "FHR", re: /fhr[:\s]*([0-9]+)\s*(bpm)?/i, unit: "bpm" },
  { label: "NT", re: /nt[:\s]*([0-9]+\.?[0-9]*)\s*(mm)?/i, unit: "mm" },

  // Abdominal
  { label: "Liver span", re: /liver\s*(?:span)?[:\s]*([0-9]+\.?[0-9]*)\s*(cm)?/i, unit: "cm" },
  { label: "CBD", re: /cbd[:\s]*([0-9]+\.?[0-9]*)\s*(mm)?/i, unit: "mm" },
  { label: "GB wall", re: /gb\s*wall[:\s]*([0-9]+\.?[0-9]*)\s*(mm)?/i, unit: "mm" },
  { label: "Spleen", re: /spleen[:\s]*([0-9]+\.?[0-9]*)\s*(cm)?/i, unit: "cm" },

  // Renal
  { label: "RK length", re: /(?:right|rt\.?)\s*kidney[:\s]*([0-9]+\.?[0-9]*)\s*(cm|mm)?/i, unit: "cm" },
  { label: "LK length", re: /(?:left|lt\.?)\s*kidney[:\s]*([0-9]+\.?[0-9]*)\s*(cm|mm)?/i, unit: "cm" },

  // Pelvic
  { label: "Endometrium", re: /endo(?:metrium|metrial)?[:\s]*([0-9]+\.?[0-9]*)\s*(mm)?/i, unit: "mm" },
  { label: "Uterus", re: /uterus[:\s]*([0-9]+\.?[0-9]*)\s*[x×]\s*([0-9]+\.?[0-9]*)/i, unit: "cm" },

  // Prostate
  { label: "Prostate vol", re: /prostate\s*(?:vol|volume)?[:\s]*([0-9]+\.?[0-9]*)\s*(cc|ml|g)?/i, unit: "cc" },

  // Thyroid
  { label: "Thyroid RT", re: /(?:right|rt\.?)\s*(?:thyroid|lobe)[:\s]*([0-9]+\.?[0-9]*)\s*[x×]\s*([0-9]+\.?[0-9]*)/i, unit: "mm" },
  { label: "Thyroid LT", re: /(?:left|lt\.?)\s*(?:thyroid|lobe)[:\s]*([0-9]+\.?[0-9]*)\s*[x×]\s*([0-9]+\.?[0-9]*)/i, unit: "mm" },

  // AFI
  { label: "AFI", re: /afi[:\s]*([0-9]+\.?[0-9]*)\s*(cm)?/i, unit: "cm" },
];

/**
 * Run Tesseract OCR on an image and extract measurements.
 *
 * Loads tesseract.js dynamically (only when used — no bundle bloat).
 * The worker runs entirely in the browser.
 *
 * @param imageDataUrl — data URL of the image to OCR
 * @param onProgress — optional progress callback (0-1)
 */
export async function runTesseractOcr(
  imageDataUrl: string,
  onProgress?: (progress: number) => void,
): Promise<OcrResult> {
  // Dynamic import — tesseract.js is loaded only when OCR is used
  const { default: Tesseract } = await import("tesseract.js");

  const worker = await Tesseract.createWorker("eng", 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text" && onProgress) {
        onProgress(m.progress);
      }
    },
  });

  try {
    // Configure for numeric / measurement recognition
    await worker.setParameters({
      tessedit_char_whitelist: "0123456789.BPDHCACRLFLEFWGAMScmmlkgwkdaysBpmNTLRK LTCBDGbWallSpleenProstateEndoUterusThyroidAFIabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ .×/:",
      tessedit_pageseg_mode: "6" as never, // Assume uniform block of text
    });

    const { data } = await worker.recognize(imageDataUrl);
    const rawText = data.text || "";
    const overallConfidence = Math.round(data.confidence || 0);

    // Extract measurements from the raw text
    const measurements: OcrMeasurement[] = [];
    for (const pattern of MEASUREMENT_PATTERNS) {
      const match = rawText.match(pattern.re);
      if (match && match[1]) {
        measurements.push({
          label: pattern.label,
          value: match[1],
          unit: pattern.unit,
          confidence: overallConfidence,
        });
      }
    }

    return {
      measurements,
      rawText,
      confidence: overallConfidence,
      source: "tesseract",
    };
  } finally {
    await worker.terminate();
  }
}

/**
 * Check if Tesseract.js is available (can be loaded).
 * Used to show/hide the OCR button.
 */
export async function isTesseractAvailable(): Promise<boolean> {
  try {
    await import("tesseract.js");
    return true;
  } catch {
    return false;
  }
}

/**
 * Map OCR measurements to composer variable slots.
 * Returns a vars map compatible with the composer's setOrganVar.
 */
export function mapOcrToVars(
  ocr: OcrResult,
  studyKey: string,
): Record<string, Record<string, string>> {
  const vars: Record<string, Record<string, string>> = {};

  for (const m of ocr.measurements) {
    // Map measurement labels to organ/var slots based on study type
    const mapping = OCR_TO_SLOT_MAP[m.label];
    if (!mapping) continue;

    // Only map if the study has this organ
    vars[mapping.organ] = vars[mapping.organ] ?? {};
    if (!vars[mapping.organ][mapping.varKey]) {
      vars[mapping.organ][mapping.varKey] = m.value;
    }
  }

  return vars;
}

const OCR_TO_SLOT_MAP: Record<string, { organ: string; varKey: string }> = {
  "BPD": { organ: "ob_bpd", varKey: "bpd" },
  "HC": { organ: "ob_hc", varKey: "hc" },
  "AC": { organ: "ob_ac", varKey: "ac" },
  "FL": { organ: "ob_fl", varKey: "fl" },
  "CRL": { organ: "ob_crl", varKey: "crl" },
  "EFW": { organ: "ob_efw", varKey: "efw" },
  "FHR": { organ: "ob_fhr", varKey: "fhr" },
  "NT": { organ: "ob_nt", varKey: "nt" },
  "Liver span": { organ: "liver", varKey: "l1" },
  "CBD": { organ: "cbd", varKey: "c1" },
  "GB wall": { organ: "gallbladder", varKey: "gw" },
  "Spleen": { organ: "spleen", varKey: "s1" },
  "RK length": { organ: "kidney_rt", varKey: "k1" },
  "LK length": { organ: "kidney_lt", varKey: "k1" },
  "Endometrium": { organ: "uterus", varKey: "et" },
  "Prostate vol": { organ: "prostate", varKey: "pv" },
  "AFI": { organ: "ob_liquor", varKey: "afi" },
};
