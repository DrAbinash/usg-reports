/**
 * Ollama vision OCR for USG biometry (qwen3-vl:8b on LAN).
 * Mirrors visionOcr.ts schema exactly so both engines are drop-in swappable.
 * Ollama first (LAN, private, free), Gemini fallback (cloud, metered).
 */
import type { UsgOcrJson } from "./visionOcr";

const OLLAMA_URL = process.env.OLLAMA_PRIMARY_URL || "http://172.16.1.140:11434";
const OLLAMA_MODEL = process.env.AI_MODEL_VISION || "qwen3-vl:8b";

const OB_PROMPT = `You are a medical image OCR for obstetric ultrasound.
Extract ONLY the biometry values visible in this image into strict JSON.
Return JSON with these exact keys (use null if not visible, never invent):
{
  "bpd": "Biparietal Diameter e.g. '8.69 cm'",
  "hc": "Head Circumference e.g. '31.24 cm'",
  "ac": "Abdominal Circumference e.g. '31.86 cm'",
  "fl": "Femur Length e.g. '6.99 cm'",
  "efw": "Estimated Fetal Weight e.g. '2728 g'",
  "ga": "Gestational Age e.g. '35w4d' or '35 weeks 4 days'",
  "edd": "Expected Delivery Date e.g. '21.10.2026'",
  "lmp": "Last Menstrual Period e.g. '20.01.2026'",
  "fhr": "Fetal Heart Rate e.g. '141 bpm'",
  "amniotic_fluid": "AFI or deepest pocket e.g. '12 cm'",
  "placenta": "Position and grade e.g. 'anterior, grade II'"
}
Rules:
- Units must match the image (cm, mm, g, bpm, weeks).
- If a value is ambiguous or partially obscured, return null.
- Never calculate or infer missing values.
- Return ONLY the JSON object, no markdown, no explanation.`;

export async function ollamaUsgOcr(imageBase64: string, mimeType: string = "image/jpeg"): Promise<UsgOcrJson | null> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          {
            role: "user",
            content: OB_PROMPT,
            images: [imageBase64.replace(/^data:[^;]+;base64,/, "")],
          },
        ],
        stream: false,
        options: { temperature: 0, num_ctx: 8192 },
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) {
      console.error("[ollama-ocr] HTTP", res.status);
      return null;
    }
    const data = await res.json() as any;
    const raw = data?.message?.content ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]) as UsgOcrJson;
  } catch (e: any) {
    console.error("[ollama-ocr] failed:", e?.message);
    return null;
  }
}

export async function ollamaConfigured(): Promise<boolean> {
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) });
    return r.ok;
  } catch { return false; }
}
