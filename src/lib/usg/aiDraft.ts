/**
 * aiDraft.ts (v6.10) — local AI findings-draft assistant via Ollama.
 *
 * Calls a local Ollama server (OLLAMA_URL env, default http://localhost:11434)
 * with the study's clinical context (study title, organ normals, selected
 * pathologies) and asks the model to draft a complete findings + impression
 * paragraph. The radiologist reviews and edits — the AI never writes to
 * the report directly.
 *
 * Server-only — the OLLAMA_URL is never exposed to the browser.
 */
import { getSettings } from "@/lib/settings";

export type AiDraftInput = {
  studyTitle: string;
  patientName: string;
  patientAge: string;
  patientSex: string;
  referredBy: string;
  /** The current organ findings (normal + pathologies) as a single string. */
  currentFindings: string;
  /** Optional clinical indication (from the referring doctor's note). */
  clinicalIndication?: string;
};

export type AiDraftResult = {
  ok: boolean;
  draft?: string;
  model?: string;
  error?: string;
  ms?: number;
};

const OLLAMA_TIMEOUT_MS = 30_000;

/** Get the Ollama URL from env (server-only). */
function ollamaUrl(): string {
  return (process.env.OLLAMA_URL ?? "http://localhost:11434").replace(/\/$/, "");
}

/** Get the model name from env (default: llama3.2 — small + fast). */
function ollamaModel(): string {
  return process.env.OLLAMA_MODEL ?? "llama3.2";
}

/** Is the Ollama integration configured? (URL is always set via env; this
 *  just checks the feature flag from settings.) */
export async function isAiDraftEnabled(): Promise<boolean> {
  const s = await getSettings();
  if (s.enableAiDraft === false) return false;
  // Ollama is optional — the feature is "enabled" only if the env var is set
  // OR the doctor explicitly turned on the toggle (which defaults to true).
  return true;
}

/** Ping the Ollama server — used by the Settings → Integrations test button. */
export async function pingOllama(): Promise<{ ok: boolean; version?: string; models?: string[]; error?: string }> {
  const base = ollamaUrl();
  try {
    const res = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { ok: false, error: `Ollama responded ${res.status}` };
    const d = (await res.json()) as { models?: Array<{ name: string }> };
    return {
      ok: true,
      version: "ollama",
      models: (d.models ?? []).map((m) => m.name),
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Build the prompt for the Ollama model. */
function buildPrompt(input: AiDraftInput, model: string): string {
  const lines: string[] = [];
  lines.push("You are an expert radiologist assistant drafting a USG report.");
  lines.push("");
  lines.push("Study: " + input.studyTitle);
  lines.push(`Patient: ${input.patientName}, ${input.patientAge || "?"} yrs, ${input.patientSex || "F"}`);
  if (input.referredBy) lines.push("Referred by: " + input.referredBy);
  if (input.clinicalIndication) lines.push("Clinical indication: " + input.clinicalIndication);
  lines.push("");
  lines.push("Current organ findings (the radiologist has selected these):");
  lines.push(input.currentFindings || "(none yet — draft a normal report)");
  lines.push("");
  lines.push("Draft a complete FINDINGS paragraph and an IMPRESSION section.");
  lines.push("Use formal radiology report language. Keep findings factual and impression numbered.");
  lines.push("Do NOT invent measurements. Do NOT add a signature.");
  lines.push("Output format:");
  lines.push("FINDINGS:");
  lines.push("<your findings here>");
  lines.push("");
  lines.push("IMPRESSION:");
  lines.push("1. <impression line 1>");
  lines.push("2. <impression line 2>");
  return lines.join("\n");
}

/** Generate an AI draft via Ollama. Server-only. */
export async function generateAiDraft(input: AiDraftInput): Promise<AiDraftResult> {
  const start = Date.now();
  const model = ollamaModel();
  const base = ollamaUrl();
  const prompt = buildPrompt(input, model);

  try {
    const res = await fetch(`${base}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: { temperature: 0.3, top_p: 0.8, num_predict: 600 },
      }),
      signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
    });
    if (!res.ok) {
      return { ok: false, error: `Ollama responded ${res.status}`, ms: Date.now() - start };
    }
    const d = (await res.json()) as { response?: string; error?: string };
    if (d.error) return { ok: false, error: d.error, ms: Date.now() - start };
    return {
      ok: true,
      draft: d.response ?? "",
      model,
      ms: Date.now() - start,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message, ms: Date.now() - start };
  }
}
