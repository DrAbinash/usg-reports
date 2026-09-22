import { NextRequest, NextResponse } from "next/server";
import { ollamaUsgOcr, ollamaConfigured } from "@/lib/usg/ollamaOcr";
import { geminiUsgOcr } from "@/lib/usg/visionOcr";
import { getSettings } from "@/lib/settings";

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType = "image/jpeg" } = await req.json();
    
    if (!imageBase64) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    // Strip data URL prefix if present
    const base64 = imageBase64.replace(/^data:[^;]+;base64,/, "");
    
    let ocr = null;
    let engine = "none";
    
    // Try ollama first (LAN, private, free)
    if (await ollamaConfigured()) {
      ocr = await ollamaUsgOcr(base64, mimeType);
      if (ocr) {
        engine = "ollama";
        console.log("[ocr] ollama succeeded");
      }
    }
    
    // Fallback to Gemini (cloud, metered)
    if (!ocr) {
      const settings = await getSettings();
      if (settings?.geminiApiKey) {
        ocr = await geminiUsgOcr(`data:${mimeType};base64,${base64}`, settings.geminiApiKey);
        if (ocr) {
          engine = "gemini";
          console.log("[ocr] gemini fallback succeeded");
        }
      }
    }
    
    if (!ocr) {
      return NextResponse.json({ error: "OCR failed — no engine available" }, { status: 503 });
    }
    
    return NextResponse.json({ ocr, engine });
  } catch (e: any) {
    console.error("[ocr] route error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
