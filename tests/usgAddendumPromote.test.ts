import { describe, expect, it } from "vitest";
import {
  appendAddendumLines,
  isSnippetOrgan,
  promoteOrganTextToImpression,
  promoteTextToAdvice,
  SNIPPET_ORGAN_ADVICE,
  SNIPPET_ORGAN_IMPRESSION,
} from "@/lib/usg/addendum";
import { deriveAdvice, deriveImpressions } from "@/lib/usg/triad";
import { makeLookup, normaliseState } from "@/lib/usg/composer";
import { getStudy } from "@/lib/usg/studies";
import type { UsgComposerState } from "@/lib/usg/types";

describe("appendAddendumLines", () => {
  it("dedupes exact lines", () => {
    expect(appendAddendumLines("A\nB", "B")).toBe("A\nB");
    expect(appendAddendumLines("A", ["B", "A"])).toBe("A\nB");
  });
});

describe("promoteOrganTextToImpression", () => {
  it("appends substituted organ text to impressionAddendum", () => {
    const study = getStudy("wa-female")!;
    const base = normaliseState({ studyKey: "wa-female" }, "wa-female");
    const uterus = base.organs.find((o) => o.organ === "uterus")!;
    const state: UsgComposerState = {
      ...base,
      organs: base.organs.map((o) =>
        o.organ === "uterus"
          ? {
              ...uterus,
              custom: true,
              text: "An ill defined heteroechoic mass lesion in left adnexal region.",
            }
          : o,
      ),
    };
    const next = promoteOrganTextToImpression(state, "uterus");
    expect(next.impressionAddendum).toContain("ill defined heteroechoic mass");
    const lines = deriveImpressions(next, study, makeLookup([]), null, {});
    expect(lines.some((l) => l.addendum && /ill defined/i.test(l.text))).toBe(true);
  });

  it("promotes a selection instead of the whole finding", () => {
    const base = normaliseState({ studyKey: "wa-female" }, "wa-female");
    const state: UsgComposerState = {
      ...base,
      organs: base.organs.map((o) =>
        o.organ === "adnexa"
          ? { ...o, custom: true, text: "Long body text that should not all appear." }
          : o,
      ),
    };
    const next = promoteOrganTextToImpression(state, "adnexa", "? Haemorrhagic cyst");
    expect(next.impressionAddendum).toBe("? Haemorrhagic cyst");
    expect(next.impressionAddendum).not.toContain("Long body");
  });
});

describe("adviceAddendum", () => {
  it("surfaces in deriveAdvice", () => {
    const study = getStudy("wa-female")!;
    const state = promoteTextToAdvice(
      normaliseState({ studyKey: "wa-female" }, "wa-female"),
      "Suggest β-hCG correlation.",
    );
    const lines = deriveAdvice(state, study, makeLookup([]), null, {});
    expect(lines.some((l) => l.addendum && /β-hCG|b-hCG|hCG/i.test(l.text))).toBe(true);
  });
});

describe("snippet organs", () => {
  it("recognises sentinel keys", () => {
    expect(isSnippetOrgan(SNIPPET_ORGAN_IMPRESSION)).toBe(true);
    expect(isSnippetOrgan(SNIPPET_ORGAN_ADVICE)).toBe(true);
    expect(isSnippetOrgan("uterus")).toBe(false);
  });
});
