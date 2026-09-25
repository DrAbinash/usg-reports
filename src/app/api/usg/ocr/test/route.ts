import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";

/**
 * GET /api/usg/ocr/test — session-gated Ollama reachability probe.
 * Response never discloses internal host or model list.
 */
export async function GET() {
  const guard = await requireSession();
  if (guard) return guard;

  const OLLAMA_URL = process.env.OLLAMA_PRIMARY_URL || "http://172.16.1.140:11434";
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `Ollama HTTP ${res.status}` });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Ollama unreachable" });
  }
}
