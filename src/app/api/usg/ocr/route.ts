import { NextRequest, NextResponse } from "next/server";
import { biometryOcr } from "@/lib/usg/biometryOcr";

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, fullResUrl } = await req.json();
    
    // Use full-res URL if provided (from picker), else use base64 thumbnail
    let imageSource = imageBase64;
    if (fullResUrl) {
      try {
        const base = process.env.STUDIO_INTERNAL_URL || "http://localhost:3000";
        const imgRes = await fetch(new URL(fullResUrl, base).toString(), { signal: AbortSignal.timeout(20000) });
        if (imgRes.ok) {
          const blob = await imgRes.blob();
          const reader = new FileReader();
          imageSource = await new Promise<string>((resolve) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
        }
      } catch {}
    }

    if (!imageSource) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const { ocr, engine } = await biometryOcr(imageSource);
    
    if (!ocr) {
      return NextResponse.json({ error: "OCR failed — no engine available" }, { status: 503 });
    }

    return NextResponse.json({ ocr, engine });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
