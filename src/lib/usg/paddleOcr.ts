/**
 * v6.19 PaddleOCR worker client — deterministic text extraction for biometry tables.
 * Port of ERP's ocrOrchestrator pattern, tuned for radiology console screenshots.
 * Calls Windows :8090 worker with auth, returns raw text + confidence.
 */

const WORKER_URL = process.env.OCR_WORKER_URL || "http://192.168.1.250:8090";
const WORKER_TOKEN = process.env.OCR_WORKER_TOKEN || "";

export interface PaddleOcrResult {
  text: string;
  confidence: number;
  lines: string[];
}

export async function paddleOcr(imageBase64: string): Promise<PaddleOcrResult | null> {
  try {
    const base64 = imageBase64.replace(/^data:[^;]+;base64,/, "");
    const res = await fetch(`${WORKER_URL}/ocr`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(WORKER_TOKEN ? { Authorization: `Bearer ${WORKER_TOKEN}` } : {}),
      },
      body: JSON.stringify({
        image: base64,
        mode: "fast", // fast first, accurate retry if quality fails
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    const data = await res.json() as any;
    const lines: string[] = data.lines || [];
    const text = lines.join("\n");
    const confidence = data.confidence ?? data.meanConfidence ?? 0;
    return { text, confidence, lines };
  } catch (e: any) {
    console.error("[paddle-ocr] failed:", e?.message);
    return null;
  }
}

export async function paddleHealth(): Promise<boolean> {
  try {
    const r = await fetch(`${WORKER_URL}/health`, { signal: AbortSignal.timeout(3000) });
    return r.ok;
  } catch {
    return false;
  }
}
