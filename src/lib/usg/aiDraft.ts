/**
 * aiDraft.ts — local AI report-skeleton assistant via Ollama.
 *
 * Calls a local Ollama server (OLLAMA_URL env, default http://localhost:11434)
 * with study context (type, indication, technique, organ list + allowed finding
 * keys) and asks the model for a strict JSON skeleton: per-organ pathology /
 * normal keys plus optional impression and advice lines. The radiologist
 * reviews chips in UsgAiDraftPanel and applies via togglePathology / triad —
 * the AI never writes to the report directly.
 *
 * Server-only — the OLLAMA_URL is never exposed to the browser.
 */
import { z } from "zod";
import { getSettings } from "@/lib/settings";

/** One study organ offered to the model (allowed finding keys are real catalog keys). */
export type AiDraftOrganInput = {
  key: string;
  label: string;
  /** Pathology keys from pathologies.ts that apply to this organ. */
  allowedKeys: string[];
};

export type AiDraftInput = {
  studyTitle: string;
  /** Study type key (e.g. wa-female, ua). */
  studyKey?: string;
  patientName: string;
  patientAge: string;
  patientSex: string;
  referredBy: string;
  /** The current organ findings (normal + pathologies) as a single string. */
  currentFindings: string;
  /** Optional clinical indication (from the referring doctor's note). */
  clinicalIndication?: string;
  /** Study technique paragraph. */
  technique?: string;
  /** Organs for this study type + allowed pathology keys per organ. */
  organs?: AiDraftOrganInput[];
};

/** Per-organ suggestion — findingKey null means organ normal (All Normal path). */
export type AiDraftOrganSuggestion = {
  organKey: string;
  findingKey: string | null;
  label?: string;
};

export type AiDraftSkeleton = {
  organs: AiDraftOrganSuggestion[];
  impression: string[];
  advice: string[];
};

export type AiDraftResult = {
  ok: boolean;
  /** Legacy free-text draft (FINDINGS/IMPRESSION) — kept for older callers. */
  draft?: string;
  /** Structured skeleton for chip UI / Apply all. */
  skeleton?: AiDraftSkeleton;
  model?: string;
  error?: string;
  ms?: number;
};

const OLLAMA_TIMEOUT_MS = 45_000;

/** Zod schema for the Ollama JSON payload — defined once; parse defensively. */
export const AiDraftSkeletonSchema = z.object({
  organs: z
    .array(
      z.object({
        organKey: z.string(),
        /** Real pathology key, or "normal" / null for the organ's normal scaffold. */
        findingKey: z.union([z.string(), z.null()]).optional(),
      }),
    )
    .default([]),
  impression: z.array(z.string()).optional().default([]),
  advice: z.array(z.string()).optional().default([]),
});

export type AiDraftSkeletonParsed = z.infer<typeof AiDraftSkeletonSchema>;

const EMPTY_SKELETON: AiDraftSkeleton = { organs: [], impression: [], advice: [] };

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

/** Strip ```json fences and pull the first {...} object if present. */
export function extractJsonObject(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? trimmed).trim();
  if (candidate.startsWith("{") && candidate.endsWith("}")) return candidate;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start >= 0 && end > start) return candidate.slice(start, end + 1);
  return null;
}

/**
 * Parse + validate model output against AiDraftSkeletonSchema.
 * Unknown / invalid keys are dropped; never throws — empty skeleton on failure
 * (or a all-normal fallback when the study organ list is known).
 */
export function parseAiDraftSkeleton(
  raw: string,
  organs?: AiDraftOrganInput[],
): AiDraftSkeleton {
  const allNormalFallback = (): AiDraftSkeleton =>
    organs?.length
      ? {
          organs: organs.map((o) => ({ organKey: o.key, findingKey: null, label: o.label })),
          impression: [],
          advice: [],
        }
      : EMPTY_SKELETON;

  try {
    const jsonText = extractJsonObject(raw);
    if (!jsonText) return allNormalFallback();
    const parsed = AiDraftSkeletonSchema.safeParse(JSON.parse(jsonText));
    if (!parsed.success) return allNormalFallback();

    const allowedByOrgan = new Map<string, Set<string>>();
    const organKeys = new Set<string>();
    for (const o of organs ?? []) {
      organKeys.add(o.key);
      allowedByOrgan.set(o.key, new Set(o.allowedKeys));
    }

    const outOrgans: AiDraftOrganSuggestion[] = [];
    for (const row of parsed.data.organs) {
      const organKey = String(row.organKey ?? "").trim();
      if (!organKey) continue;
      if (organKeys.size && !organKeys.has(organKey)) continue;

      const rawKey = row.findingKey;
      const normalized =
        rawKey == null || String(rawKey).trim() === "" || String(rawKey).trim().toLowerCase() === "normal"
          ? null
          : String(rawKey).trim();

      if (normalized !== null) {
        const allowed = allowedByOrgan.get(organKey);
        // When we know the catalog, reject invented keys.
        if (allowed && !allowed.has(normalized)) continue;
      }

      const label = organs?.find((o) => o.key === organKey)?.label;
      outOrgans.push({ organKey, findingKey: normalized, label });
    }

    // If the model omitted organs but we know the study list, default each to normal.
    if (!outOrgans.length) return allNormalFallback();

    const impression = (parsed.data.impression ?? []).map((s) => String(s).trim()).filter(Boolean);
    const advice = (parsed.data.advice ?? []).map((s) => String(s).trim()).filter(Boolean);
    return { organs: outOrgans, impression, advice };
  } catch {
    return allNormalFallback();
  }
}

/** Legacy prose draft from a skeleton (keeps older insert-impression callers working). */
function skeletonToDraft(skeleton: AiDraftSkeleton, studyTitle: string): string {
  const findingLines = skeleton.organs.map((o) => {
    const tag = o.findingKey ?? "normal";
    return `- ${o.label ?? o.organKey}: ${tag}`;
  });
  const impression = skeleton.impression.length
    ? skeleton.impression.map((l, i) => `${i + 1}. ${l}`).join("\n")
    : "1. No significant abnormality detected.";
  return [
    `FINDINGS:`,
    studyTitle ? `(${studyTitle})` : "",
    ...findingLines,
    "",
    "IMPRESSION:",
    impression,
    skeleton.advice.length ? `\nADVICE:\n${skeleton.advice.map((a) => `• ${a}`).join("\n")}` : "",
  ]
    .filter((l) => l !== "")
    .join("\n");
}

/** Build the prompt for the Ollama model — requests strict JSON only. */
function buildPrompt(input: AiDraftInput): string {
  const lines: string[] = [];
  lines.push("You are an expert radiologist assistant drafting a USG report skeleton.");
  lines.push("Return ONLY valid JSON matching this shape (no markdown, no prose):");
  lines.push(
    '{"organs":[{"organKey":"<key>","findingKey":"<pathology-key-or-normal>"}],"impression":["..."],"advice":["..."]}',
  );
  lines.push("");
  lines.push("Rules:");
  lines.push('- findingKey must be exactly "normal" OR one of the allowedKeys listed for that organ.');
  lines.push("- Do NOT invent pathology keys. Prefer \"normal\" for a typical normal study.");
  lines.push("- Include every organ listed below exactly once.");
  lines.push("- impression / advice are short clinical lines (optional but preferred).");
  lines.push("- Do NOT invent measurements.");
  lines.push("");
  if (input.studyKey) lines.push("Study key: " + input.studyKey);
  lines.push("Study: " + input.studyTitle);
  lines.push(`Patient: ${input.patientName}, ${input.patientAge || "?"} yrs, ${input.patientSex || "F"}`);
  if (input.referredBy) lines.push("Referred by: " + input.referredBy);
  if (input.clinicalIndication) lines.push("Clinical indication: " + input.clinicalIndication);
  if (input.technique) lines.push("Technique: " + input.technique);
  lines.push("");
  if (input.organs?.length) {
    lines.push("Organs (use these organKey values; findingKey from allowedKeys or \"normal\"):");
    for (const o of input.organs) {
      const keys = o.allowedKeys.length ? o.allowedKeys.join(", ") : "(normal only)";
      lines.push(`- ${o.key} (${o.label}): allowedKeys=[${keys}]`);
    }
  } else {
    lines.push("Current organ findings (the radiologist has selected these):");
    lines.push(input.currentFindings || "(none yet — draft a normal report)");
  }
  return lines.join("\n");
}

/** Generate an AI draft via Ollama. Server-only. */
export async function generateAiDraft(input: AiDraftInput): Promise<AiDraftResult> {
  const start = Date.now();
  const model = ollamaModel();
  const base = ollamaUrl();
  const prompt = buildPrompt(input);

  try {
    const res = await fetch(`${base}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        format: "json",
        options: { temperature: 0.2, top_p: 0.8, num_predict: 1200 },
      }),
      signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
    });
    if (!res.ok) {
      return { ok: false, error: `Ollama responded ${res.status}`, ms: Date.now() - start };
    }
    const d = (await res.json()) as { response?: string; error?: string };
    if (d.error) return { ok: false, error: d.error, ms: Date.now() - start };

    const raw = d.response ?? "";
    const skeleton = parseAiDraftSkeleton(raw, input.organs);
    // Invalid / empty JSON → empty skeleton (never crash the panel).
    return {
      ok: true,
      draft: skeletonToDraft(skeleton, input.studyTitle) || raw,
      skeleton,
      model,
      ms: Date.now() - start,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message, ms: Date.now() - start };
  }
}
