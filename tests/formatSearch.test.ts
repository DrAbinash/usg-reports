/**
 * Formats Library search — matchFormatQuery + list-level acceptance cases.
 */
import { describe, expect, test } from "vitest";
import {
  filterFormatsByQuery,
  groupFormatsByCategory,
  matchFormatQuery,
  type SearchableFormat,
} from "../src/lib/usg/formatSearch";
import { BUILTIN_NP_TEMPLATES, searchAliasesForTemplateName } from "../src/lib/usg/npTemplates";
import { formatMetaForStudyKey } from "../src/lib/usg/formatSearch";

/** Seed catalog as the Formats Library sees it after enrichment. */
function seededFormats(): SearchableFormat[] {
  return BUILTIN_NP_TEMPLATES.map((t, i) => {
    const meta = formatMetaForStudyKey(t.studyKey);
    return {
      id: `seed-${i}`,
      name: t.name,
      studyKey: t.studyKey,
      studyType: meta.studyType,
      category: meta.category,
      searchAliases: [...t.searchAliases],
      organKeywords: meta.organKeywords,
    };
  });
}

describe("matchFormatQuery", () => {
  const formats = seededFormats();
  const byName = (re: RegExp) => formats.filter((f) => re.test(f.name));

  test("aliases seeded on Whole / Lower / Echo (not UI-hardcoded)", () => {
    expect(searchAliasesForTemplateName("Echo (2D Echocardiography)")).toEqual(
      expect.arrayContaining(["cardiac", "echo", "2d echo", "echocardiography", "heart", "cardio"]),
    );
    expect(searchAliasesForTemplateName("NP Whole Abdomen — Female")).toEqual(
      expect.arrayContaining(["whole", "abdomen", "whole abdomen", "usg abdomen"]),
    );
    expect(searchAliasesForTemplateName("NP Lower Abdomen — Female")).toEqual(
      expect.arrayContaining(["lower", "abdomen", "pelvis", "whole lower abdomen"]),
    );
  });

  test('"cardiac" → Echo (2D Echocardiography) format(s), non-empty', () => {
    const hits = filterFormatsByQuery(formats, "cardiac");
    expect(hits.length).toBeGreaterThan(0);
    // Adult Echo must still hit; the Fetal Echo format may also match on
    // "cardiac" via its seeded "fetal cardiac" alias (by design).
    expect(hits.some((f) => f.studyKey === "echo")).toBe(true);
    expect(hits.some((f) => /Echo \(2D Echocardiography\)/i.test(f.name))).toBe(true);
  });

  test('"fetal echo" → USG Fetal Echocardiography format; "cardiac" keeps adult echo', () => {
    expect(searchAliasesForTemplateName("USG Fetal Echocardiography")).toEqual(
      expect.arrayContaining([
        "fetal echo",
        "fetal echocardiography",
        "usg fetal echo",
        "echo fetal",
        "fetal cardiac",
      ]),
    );
    const hits = filterFormatsByQuery(formats, "fetal echo");
    expect(hits.some((f) => f.name === "USG Fetal Echocardiography")).toBe(true);
    expect(hits.some((f) => f.studyKey === "fetal-echo")).toBe(true);
    // The dedicated format must not be the adult echo or the ob scaffold.
    expect(hits.every((f) => f.name !== "Echo (2D Echocardiography)")).toBe(true);
    const echo = filterFormatsByQuery(formats, "cardiac");
    expect(echo.some((f) => f.studyKey === "echo")).toBe(true);
  });

  test('"who" → Whole Abdomen AND Lower Abdomen (via whole lower abdomen alias)', () => {
    const hits = filterFormatsByQuery(formats, "who");
    expect(hits.some((f) => /Whole Abdomen/i.test(f.name))).toBe(true);
    expect(hits.some((f) => /Lower Abdomen/i.test(f.name))).toBe(true);
  });

  test('"abdomen" → Whole + Upper + Lower', () => {
    const hits = filterFormatsByQuery(formats, "abdomen");
    expect(hits.some((f) => /Whole Abdomen/i.test(f.name))).toBe(true);
    expect(hits.some((f) => /Upper Abdomen/i.test(f.name))).toBe(true);
    expect(hits.some((f) => /Lower Abdomen/i.test(f.name))).toBe(true);
  });

  test('"whole" → Whole Abdomen formats', () => {
    const hits = filterFormatsByQuery(formats, "whole");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((f) => /whole/i.test(f.name) || f.searchAliases.some((a) => /whole/i.test(a)))).toBe(
      true,
    );
    expect(hits.some((f) => /Whole Abdomen/i.test(f.name))).toBe(true);
  });

  test('"" → all formats grouped; "zzz" → honest empty', () => {
    const all = filterFormatsByQuery(formats, "");
    expect(all.length).toBe(formats.length);
    const groups = groupFormatsByCategory(all);
    expect(groups.length).toBeGreaterThan(1);
    expect(groups.some((g) => g.category === "abdomen")).toBe(true);
    expect(groups.some((g) => g.category === "cardiac")).toBe(true);

    const none = filterFormatsByQuery(formats, "zzz");
    expect(none).toEqual([]);
  });

  test("AND semantics — every token must match", () => {
    const echo = byName(/Echo/)[0]!;
    expect(matchFormatQuery(echo, "2d echo")).toBe(true);
    expect(matchFormatQuery(echo, "echo zzz")).toBe(false);
  });
});
