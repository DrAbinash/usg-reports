/**
 * v6.19 Biometry OCR orchestrator — ERP architecture adapted for radiology.
 * Stage 1: PaddleOCR extracts text from Voluson table (deterministic, fast)
 * Stage 2: Quality gate rejects bad OCR
 * Stage 3: ollama text-only LLM structures text into biometry JSON
 * Stage 4: ollama vision fallback if Paddle fails (transcribe only, then structure)
 * Stage 5: Gemini last resort
 */
import { paddleOcr, paddleHealth } from "./paddleOcr";
import { assessBiometryOcrQuality } from "./ocrQuality";
import { ollamaUsgOcr, ollamaConfigured } from "./ollamaOcr";
import { geminiUsgOcr } from "./visionOcr";
import type { UsgOcrJson } from "./visionOcr";

const OLLAMA_URL = process.env.OLLAMA_PRIMARY_URL || "http://172.16.1.140:11434";
const TEXT_MODEL = process.env.AI_MODEL_TEXT || "qwen3:14b";

const STRUCTURE_PROMPT = `You are a medical data extractor. Convert this OCR text from an ultrasound biometry table into JSON.
Return ONLY valid JSON with these exact keys (use null if not found):
{
  "bpd": "e.g. '8.69 cm'",
  "hc": "e.g. '31.24 cm'",
  "ac": "e.g. '31.86 cm'",
  "fl": "e.g. '6.99 cm'",
  "efw": "e.g. '2728 g'",
  "ga": "e.g. '35w4d' or '35 weeks 4 days'",
  "edd": "e.g. '21.10.2026'",
  "lmp": "e.g. '20.01.2026'",
  "fhr": "e.g. '141 bpm'",
  "amniotic_fluid": "e.g. '12 cm'",
  "placenta": "e.g. 'anterior, grade II'"
}
Rules:
- Preserve units exactly as in the text
- Return ONLY the JSON object, no markdown, no explanation
- If a field is not present, use null`;

async function structureWithOllama(text: string): Promise<UsgOcrJson | null> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: TEXT_MODEL,
        messages: [
          { role: "system", content: "You extract medical measurements from OCR text into JSON." },
          { role: "user", content: `${STRUCTURE_PROMPT}\n\nOCR TEXT:\n${text}` },
        ],
        stream: false,
        options: { temperature: 0, num_ctx: 4096 },
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) return null;
    const data = await res.json() as any;
    const raw = data?.message?.content ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]) as UsgOcrJson;
  } catch (e: any) {
    console.error("[structure-ollama] failed:", e?.message);
    return null;
  }
}

export async function biometryOcr(imageBase64: string): Promise<{ ocr: UsgOcrJson | null; engine: string }> {
  // Stage 1: PaddleOCR (deterministic, fast, LAN-private)
  if (await paddleHealth()) {
    console.log("[biometry-ocr] Stage 1: PaddleOCR");
    const paddle = await paddleOcr(imageBase64);
    if (paddle) {
      const quality = assessBiometryOcrQuality(paddle.text, paddle.confidence);
      if (quality.isGood) {
        console.log("[biometry-ocr] Paddle quality passed, structuring with text LLM");
        const structured = await structureWithOllama(paddle.text);
        if (structured) return { ocr: structured, engine: "paddle+ollama-text" };
      } else {
        console.log("[biometry-ocr] Paddle quality failed:", quality.reasons);
      }
    }
  }

  // Stage 2: ollama vision (transcribe + structure in one shot, slower)
  if (await ollamaConfigured()) {
    console.log("[biometry-ocr] Stage 2: ollama vision");
    const ollama = await ollamaUsgOcr(imageBase64, "image/jpeg");
    if (ollama) return { ocr: ollama, engine: "ollama-vision" };
  }

  // Stage 3: Gemini fallback (cloud, metered, last resort)
  console.log("[biometry-ocr] Stage 3: Gemini fallback");
  const gemini = await geminiUsgOcr(imageBase64, process.env.GEMINI_API_KEY || "");
  if (gemini) return { ocr: gemini, engine: "gemini" };

  return { ocr: null, engine: "none" };
}
