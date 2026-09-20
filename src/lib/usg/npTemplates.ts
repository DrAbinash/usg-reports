/**
 * npTemplates.ts — pure peak-time "NP" (normal, no measurements) template defs.
 *
 * Kept free of Prisma so vitest / client code can import without a DB client.
 * Persistence lives in reportTemplates.ensureBuiltinNpTemplates().
 */
import { getStudy, initialState } from "./studies";
import { applyRushNormalStudy, markAllNormal } from "./quickActions";
import type { UsgComposerState } from "./types";

/** Built-in peak-time NP templates — seeded once per clinic, never overwrite. */
export const BUILTIN_NP_TEMPLATES: Array<{
  name: string;
  studyKey: string;
  sortOrder: number;
}> = [
  { name: "NP Whole Abdomen — Female", studyKey: "wa-female", sortOrder: 1 },
  { name: "NP Whole Abdomen — Male", studyKey: "wa-male", sortOrder: 2 },
  { name: "NP Whole Abdomen — Child", studyKey: "wa-child", sortOrder: 3 },
  { name: "NP Upper Abdomen", studyKey: "ua", sortOrder: 4 },
];

/** Composer state for an NP (no-size) template of the given study. */
export function buildNpTemplateState(studyKey: string): UsgComposerState {
  const study = getStudy(studyKey);
  const base = initialState(studyKey);
  if (!study) return base;
  return applyRushNormalStudy(base, study) ?? markAllNormal(base, study, { omitMeasurements: true });
}
