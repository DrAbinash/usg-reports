import { NextResponse } from "next/server";

export async function GET() {
  const OLLAMA_URL = process.env.OLLAMA_PRIMARY_URL || "http://172.16.1.140:11434";
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `Ollama HTTP ${res.status}` });
    }
    const data = await res.json();
    const models = (data.models || []).map((m: any) => m.name);
    return NextResponse.json({ ok: true, ollamaUrl: OLLAMA_URL, models });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message });
  }
}
