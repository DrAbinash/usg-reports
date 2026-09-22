import { NextRequest, NextResponse } from "next/server";
import { ollamaUsgOcr, ollamaConfigured } from "@/lib/usg/ollamaOcr";
import { geminiUsgOcr } from "@/lib/usg/visionOcr";
import { getSettings } from "@/lib/settings";

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType = "image/jpeg" } = await req.json();

    if (!imageBase64) {
      console.error("[ocr] No imageBase64 provided");
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    // Strip data URL prefix if present, ensure clean base64
    const base64 = imageBase64.replace(/^data:[^;]+;base64,/, "").trim();
    
    if (!base64 || base64.length < 100) {
      console.error("[ocr] Invalid base64 (too short or empty)");
      return NextResponse.json({ error: "Invalid image data" }, { status: 400 });
    }

    console.log(`[ocr] Received image: ${base64.length} chars, mimeType: ${mimeType}`);

    let ocr = null;
    let engine = "none";

    // Try ollama first (LAN, private, free)
    const ollamaOk = await ollamaConfigured();
    console.log(`[ocr] Ollama configured check: ${ollamaOk}`);
    
    if (ollamaOk) {
      console.log("[ocr] Calling ollamaUsgOcr...");
      ocr = await ollamaUsgOcr(base64, mimeType);
      if (ocr) {
        engine = "ollama";
        console.log("[ocr] ollama succeeded, keys:", Object.keys(ocr).join(", "));
      } else {
        console.log("[ocr] ollama returned null");
      }
    }

    // Fallback to Gemini (cloud, metered)
    if (!ocr) {
      console.log("[ocr] Trying Gemini fallback...");
      const settings = await getSettings();
      if (settings?.geminiApiKey) {
        ocr = await geminiUsgOcr(`data:${mimeType};base64,${base64}`, settings.geminiApiKey);
        if (ocr) {
          engine = "gemini";
          console.log("[ocr] gemini fallback succeeded");
        }
      } else {
        console.log("[ocr] No Gemini API key configured");
      }
    }

    if (!ocr) {
      console.error("[ocr] All engines failed");
      return NextResponse.json({ error: "OCR failed — no engine available" }, { status: 503 });
    }

    return NextResponse.json({ ocr, engine });
  } catch (e: any) {
    console.error("[ocr] route error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
