/**
 * npTemplates.ts — pure peak-time "NP" (normal, no measurements) template defs.
 *
 * Kept free of Prisma so vitest / client code can import without a DB client.
 * Persistence lives in reportTemplates.ensureBuiltinNpTemplates().
 *
 * searchAliases power Formats Library partial search (seeded here — not in UI).
 */
import { getStudy, initialState } from "./studies";
import { applyRushNormalStudy, markAllNormal } from "./quickActions";
import type { UsgComposerState } from "./types";

export type BuiltinNpTemplate = {
  name: string;
  studyKey: string;
  sortOrder: number;
  /** Substring search aliases for Formats Library (seeded, not UI-hardcoded). */
  searchAliases: string[];
};

/** Built-in peak-time NP templates — seeded once per clinic, never overwrite. */
export const BUILTIN_NP_TEMPLATES: BuiltinNpTemplate[] = [
  {
    name: "NP Whole Abdomen — Female",
    studyKey: "wa-female",
    sortOrder: 1,
    searchAliases: ["whole", "abdomen", "whole abdomen", "usg abdomen"],
  },
  {
    name: "NP Whole Abdomen — Male",
    studyKey: "wa-male",
    sortOrder: 2,
    searchAliases: ["whole", "abdomen", "whole abdomen", "usg abdomen"],
  },
  {
    name: "NP Whole Abdomen — Child",
    studyKey: "wa-child",
    sortOrder: 3,
    searchAliases: ["whole", "abdomen", "whole abdomen", "usg abdomen", "child", "paediatric"],
  },
  {
    name: "NP Upper Abdomen",
    studyKey: "ua",
    sortOrder: 4,
    searchAliases: ["upper", "abdomen", "epigastrium"],
  },
  {
    name: "NP KUB",
    studyKey: "kub",
    sortOrder: 5,
    searchAliases: ["kub", "renal", "urinary", "kidney"],
  },
  {
    name: "NP TVS",
    studyKey: "tvs",
    sortOrder: 6,
    searchAliases: ["tvs", "transvaginal", "pelvis"],
  },
  {
    name: "NP Lower Abdomen — Female",
    studyKey: "la-female",
    sortOrder: 7,
    searchAliases: ["lower", "abdomen", "pelvis", "whole lower abdomen"],
  },
  {
    name: "NP Lower Abdomen — Male",
    studyKey: "la-male",
    sortOrder: 8,
    searchAliases: ["lower", "abdomen", "pelvis", "whole lower abdomen"],
  },
  {
    // Catalog label matches STUDY_GROUPS cardiac → Echo (2D Echocardiography).
    // Normals are the study's own ECHO_* strings (verbatim via initialState).
    name: "Echo (2D Echocardiography)",
    studyKey: "echo",
    sortOrder: 9,
    searchAliases: ["cardiac", "echo", "2d echo", "echocardiography", "heart", "cardio"],
  },
  {
    // Dedicated Fetal Echo format (studyKey "fetal-echo") — seeded exactly
    // like the adult Echo entry above; normals are verbatim repo strings.
    name: "USG Fetal Echocardiography",
    studyKey: "fetal-echo",
    sortOrder: 10,
    searchAliases: ["fetal echo", "fetal echocardiography", "usg fetal echo", "echo fetal", "fetal cardiac"],
  },
];

/** Alias lookup by exact template name (seed source of truth). */
export function searchAliasesForTemplateName(name: string): string[] {
  const hit = BUILTIN_NP_TEMPLATES.find((t) => t.name === name);
  return hit?.searchAliases ? [...hit.searchAliases] : [];
}

/** Alias lookup by studyKey — unions every builtin for that key. */
export function searchAliasesForStudyKey(studyKey: string): string[] {
  const set = new Set<string>();
  for (const t of BUILTIN_NP_TEMPLATES) {
    if (t.studyKey === studyKey) {
      for (const a of t.searchAliases) set.add(a);
    }
  }
  return [...set];
}

/** Composer state for an NP (no-size) template of the given study. */
export function buildNpTemplateState(studyKey: string): UsgComposerState {
  const study = getStudy(studyKey);
  const base = initialState(studyKey);
  if (!study) return base;
  // Echo (and other measured studies) keep their verbatim normal slots —
  // rush/no-size is abdomen-family only.
  return applyRushNormalStudy(base, study) ?? markAllNormal(base, study, { omitMeasurements: false }) ?? base;
}
