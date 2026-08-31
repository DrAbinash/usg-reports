/**
 * visionOcr.ts — optional Gemini Vision OCR for USG frames (server-only).
 *
 * Direct port of the CARE ERP's geminiUsgOcr (lib/integrations-gemini-ai):
 * same prompt, same JSON schema, same REST call — no SDK dependency. Used
 * only as the FALLBACK when a study has no DICOM SR: some machines burn
 * their biometry into the pixels instead of storing an SR.
 *
 * The API key lives in Settings (or GEMINI_API_KEY env). When it is absent
 * the feature reports "not configured" and the studio stays SR-only.
 */
import { getSettings } from "@/lib/settings";

const GEMINI_MODEL = "gemini-2.5-flash";
const BASE_URL = "https://generativelanguage.googleapis.com";

const USG_OCR_PROMPT = `You are a medical ultrasound image analysis assistant specialized in reading GE ultrasound machines.
Analyze this ultrasound image and extract ALL visible measurement values burned into the image.

Return ONLY a valid JSON object — no markdown fences, no explanation, no extra text.

JSON schema (use empty string "" for any field not visible):
{
  "bpd": "Biparietal Diameter e.g. '8.2 cm'",
  "hc": "Head Circumference e.g. '28.5 cm'",
  "ac": "Abdominal Circumference e.g. '25.0 cm'",
  "fl": "Femur Length e.g. '5.8 cm'",
  "crl": "Crown-Rump Length e.g. '3.2 cm'",
  "efw": "Estimated Fetal Weight e.g. '1850 g'",
  "ga": "Gestational Age e.g. '28W 3D'",
  "edd": "Estimated Due Date e.g. '15/10/2025'",
  "fhr": "Fetal Heart Rate e.g. '148 bpm'",
  "uterusSize": "Uterus dimensions e.g. '8.5 x 4.2 x 3.8 cm'",
  "endometrium": "Endometrial thickness e.g. '8 mm'",
  "rightOvary": "Right ovary e.g. '2.8 x 1.9 cm'",
  "leftOvary": "Left ovary e.g. '2.6 x 1.7 cm'",
  "liverSize": "Liver span e.g. '13.5 cm'",
  "spleenSize": "Spleen size e.g. '10.2 cm'",
  "rightKidney": "Right kidney e.g. '10.8 x 4.5 cm'",
  "leftKidney": "Left kidney e.g. '11.0 x 4.8 cm'",
  "cbd": "Common Bile Duct e.g. '4 mm'",
  "gbWall": "Gallbladder wall e.g. '3 mm'",
  "prostateVolume": "Prostate volume e.g. '32 cc'",
  "placentaPosition": "e.g. 'Posterior' or 'Anterior'",
  "liquorAfi": "AFI / liquor index e.g. '12.5 cm'",
  "fetalPresentation": "e.g. 'Cephalic' or 'Breech'",
  "follicles": "follicle count/size or empty",
  "adnexalLesion": "adnexal lesion description or empty",
  "extraMeasurements": { "label": "value" for any other visible labeled measurements },
  "overallConfidence": "high | medium | low",
  "perFieldConfidence": { "fieldName": "high | medium | low" for each populated field },
  "rawText": "all text visible in the image concatenated as a single string"
}`;

export type UsgOcrJson = {
  bpd?: string;
  hc?: string;
  ac?: string;
  fl?: string;
  crl?: string;
  efw?: string;
  ga?: string;
  edd?: string;
  fhr?: string;
  uterusSize?: string;
  endometrium?: string;
  rightOvary?: string;
  leftOvary?: string;
  liverSize?: string;
  spleenSize?: string;
  rightKidney?: string;
  leftKidney?: string;
  cbd?: string;
  gbWall?: string;
  prostateVolume?: string;
  placentaPosition?: string;
  liquorAfi?: string;
  fetalPresentation?: string;
  follicles?: string;
  adnexalLesion?: string;
  extraMeasurements?: Record<string, string>;
  overallConfidence?: "high" | "medium" | "low";
  perFieldConfidence?: Record<string, string>;
  rawText?: string;
};

export async function geminiUsgOcr(
  imageBase64: string,
  mimeType: string,
): Promise<{ ok: true; data: UsgOcrJson } | { ok: false; error: string }> {
  const s = await getSettings();
  const apiKey = s.geminiApiKey ?? "";
  if (!apiKey) {
    return { ok: false, error: "Vision OCR not configured (optional — Settings → Integrations)" };
  }
  const url = `${BASE_URL}/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: USG_OCR_PROMPT },
              { inlineData: { mimeType, data: imageBase64 } },
            ],
          },
        ],
        generationConfig: { maxOutputTokens: 2048, temperature: 0.05 },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = await res.text();
      return { ok: false, error: `Gemini OCR responded ${res.status} ${err.slice(0, 180)}` };
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "{}";
    const clean = raw.replace(/^```[a-z]*\n?/, "").replace(/```$/, "").trim();
    try {
      return { ok: true, data: JSON.parse(clean) as UsgOcrJson };
    } catch {
      return { ok: true, data: { rawText: raw } };
    }
  } catch {
    return { ok: false, error: "Gemini OCR unreachable (timed out or no internet)" };
  } finally {
    clearTimeout(timer);
  }
}

/** Is the optional OCR path configured? (drives UI affordances) */
export async function visionOcrConfigured(): Promise<boolean> {
  const s = await getSettings();
  return !!s.geminiApiKey;
}

/**
 * Convert an OCR field map into SrMeasurement-shaped rows so the SAME
 * mapper (mapSrToStudy) handles machine SR and OCR alike — one pipeline,
 * two sources, one slot-filling behaviour.
 */
export function ocrToSrMeasurements(ocr: UsgOcrJson): { conceptName: string; value: string; unit: string }[] {
  const named: [string, string][] = [
    ["Biparietal Diameter", ocr.bpd ?? ""],
    ["Head Circumference", ocr.hc ?? ""],
    ["Abdominal Circumference", ocr.ac ?? ""],
    ["Femur Length", ocr.fl ?? ""],
    ["Crown-Rump Length", ocr.crl ?? ""],
    ["Estimated Fetal Weight", ocr.efw ?? ""],
    ["Fetal Heart Rate", ocr.fhr ?? ""],
    ["Liver span", ocr.liverSize ?? ""],
    ["Spleen length", ocr.spleenSize ?? ""],
    ["Right kidney", ocr.rightKidney ?? ""],
    ["Left kidney", ocr.leftKidney ?? ""],
    ["Endometrial thickness", ocr.endometrium ?? ""],
    ["Right ovary", ocr.rightOvary ?? ""],
    ["Left ovary", ocr.leftOvary ?? ""],
    ["Prostate width", ocr.prostateVolume ?? ""],
    ["AFI", ocr.liquorAfi ?? ""],
  ];
  const out: { conceptName: string; value: string; unit: string }[] = [];
  for (const [conceptName, rawVal] of named) {
    const v = String(rawVal ?? "").trim();
    if (!v) continue;
    // Split trailing unit so normaliseUnit sees a number, e.g. "8.2 cm" → 8.2 + "cm"
    const m = v.match(/^(-?\d+(?:\.\d+)?)\s*(cm|mm|g|kg|bpm|cc|ml)?\b/i);
    if (m) out.push({ conceptName, value: m[1], unit: (m[2] ?? "").toLowerCase() });
    else out.push({ conceptName, value: v, unit: "" });
  }
  return out;
}
