/**
 * USG Studio — server-side helpers: merge builtin catalog with the doctor's
 * custom entries and expose a single lookup used by every route.
 */
import { db } from "@/lib/db";
import { USG_PATHOLOGIES_ALL } from "./pathologies";
import type { UsgPathologyDef } from "./types";
import { makeLookup, normaliseState, resolve } from "./composer";

export const CUSTOM_KEY_PREFIX = "custom:";

export async function loadAllPathologies(): Promise<UsgPathologyDef[]> {
  let customs: UsgPathologyDef[] = [];
  try {
    const rows = await db.usgPathology.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
    customs = rows.map((r) => ({
      key: CUSTOM_KEY_PREFIX + r.id,
      organ: r.organKey,
      label: r.label,
      text: r.findingText,
      impression: safeJsonArray(r.impressionLinesJson),
      titleFragment: r.titleFragment || undefined,
      builtin: false,
    }));
  } catch {
    // Table not created yet (first boot before db push) — builtins still work.
  }
  return [...USG_PATHOLOGIES_ALL, ...customs];
}

function safeJsonArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Look up a pathology by key across builtin + custom entries. */
export async function lookupPathology(key: string): Promise<UsgPathologyDef | undefined> {
  if (key.startsWith(CUSTOM_KEY_PREFIX)) {
    const id = key.slice(CUSTOM_KEY_PREFIX.length);
    const row = await db.usgPathology.findUnique({ where: { id } }).catch(() => null);
    if (!row) return undefined;
    return {
      key,
      organ: row.organKey,
      label: row.label,
      text: row.findingText,
      impression: safeJsonArray(row.impressionLinesJson),
      titleFragment: row.titleFragment || undefined,
      builtin: false,
    };
  }
  return USG_PATHOLOGIES_ALL.find((p) => p.key === key);
}

/** Resolve a state JSON into the denormalised columns stored on UsgReport. */
export async function resolveColumns(stateJson: string, technique: string) {
  const all = await loadAllPathologies();
  const lookup = makeLookup(all);
  let parsed: unknown = {};
  try {
    parsed = JSON.parse(stateJson);
  } catch {
    parsed = {};
  }
  const state = normaliseState(parsed);
  const r = resolve(state, lookup, technique);
  return {
    studyKey: state.studyKey,
    studyTitle: r.title,
    findings: r.sections.map((s) => `${s.label}: ${s.text}`).join("\n\n"),
    impression: r.impression.join("\n"),
  };
}
