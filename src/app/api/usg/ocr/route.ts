import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { biometryOcr } from "@/lib/usg/biometryOcr";

/** Same-origin relative paths only — blocks SSRF via absolute / protocol-relative URLs. */
function isSameOriginRelativePath(url: string): boolean {
  return url.startsWith("/") && !url.startsWith("//");
}

export async function POST(req: NextRequest) {
  const guard = await requireSession();
  if (guard) return guard;

  try {
    const { imageBase64, fullResUrl } = await req.json();

    // Use full-res URL if provided (from picker), else use base64 thumbnail
    let imageSource = imageBase64;
    if (fullResUrl) {
      if (typeof fullResUrl !== "string" || !isSameOriginRelativePath(fullResUrl)) {
        return NextResponse.json(
          { error: "fullResUrl must be a same-origin relative path (start with /)" },
          { status: 400 },
        );
      }
      try {
        const base = process.env.STUDIO_INTERNAL_URL || "http://localhost:3000";
        // Relative path only — never pass an absolute URL into fetch.
        const imgRes = await fetch(new URL(fullResUrl, base).toString(), {
          signal: AbortSignal.timeout(20000),
        });
        if (imgRes.ok) {
          const buf = Buffer.from(await imgRes.arrayBuffer());
          const ct = imgRes.headers.get("content-type") || "image/jpeg";
          imageSource = `data:${ct};base64,${buf.toString("base64")}`;
        }
      } catch {
        // Fall through to thumbnail base64 if full-res fetch fails.
      }
    }

    if (!imageSource) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const { ocr, engine } = await biometryOcr(imageSource);

    if (!ocr) {
      return NextResponse.json({ error: "OCR failed — no engine available" }, { status: 503 });
    }

    return NextResponse.json({ ocr, engine });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "OCR failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
