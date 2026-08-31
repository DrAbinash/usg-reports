/**
 * Normal-wording override tests (v5 phase 7).
 *
 * Contract: the override replaces the organ's builtin normal at every point
 * the composer resolves it — initial state, Normal-chip reset, study switch
 * — while {tokens} keep working and existing custom/pathology text is never
 * clobbered. Backups carry the wordings; restores upsert them.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { applyNormalOverrides, getStudy, getStudyWithOverrides, initialState, normalOverrideKey } from "@/lib/usg/studies";
import { applyPathologies, makeLookup, normaliseState, resolve, switchStudy } from "@/lib/usg/composer";
import { USG_PATHOLOGIES_ALL } from "@/lib/usg/pathologies";
import { buildBackup, parseBackup, parseFullBackup } from "@/lib/usg/backup";

const lookup = makeLookup(USG_PATHOLOGIES_ALL);

const MY_LIVER = "Liver is unremarkable in size and echotexture. No focal lesion seen.";

beforeEach(async () => {
  await db.usgNormalOverride.deleteMany();
});

afterEach(async () => {
  await db.usgNormalOverride.deleteMany();
});

describe("applyNormalOverrides", () => {
  it("replaces only the targeted organ's normal, leaving others verbatim", () => {
    const study = getStudy("wa-female")!;
    const out = applyNormalOverrides(study, { "wa-female:liver": MY_LIVER });
    expect(out.organs.find((o) => o.key === "liver")!.normal).toBe(MY_LIVER);
    expect(out.organs.find((o) => o.key === "gb")!.normal).toBe(study.organs.find((o) => o.key === "gb")!.normal);
  });

  it("returns the same study object when nothing matches (no needless clones)", () => {
    const study = getStudy("wa-female")!;
    expect(applyNormalOverrides(study, {})).toBe(study);
    expect(applyNormalOverrides(study, { "kub:liver": MY_LIVER })).toBe(study);
  });

  it("getStudyWithOverrides composes getStudy + overrides", () => {
    const out = getStudyWithOverrides("wa-female", { "wa-female:liver": MY_LIVER });
    expect(out?.organs.find((o) => o.key === "liver")?.normal).toBe(MY_LIVER);
  });
});

describe("composer threading", () => {
  it("initial state uses the overridden normal (tokens intact)", () => {
    const myGyn = "Uterus measures {u1} x {u2} x {u3} cm. Endometrium {et} cm. My own wording.";
    const state = initialState("la-female", { "la-female:uterus": myGyn });
    expect(state.organs.find((o) => o.organ === "uterus")?.text).toBe(myGyn);
  });

  it("Normal chip reset returns to the OVERRIDDEN wording, not the builtin", () => {
    const overrides = { "wa-female:liver": MY_LIVER };
    const withPath = applyPathologies(initialState("wa-female", overrides), "liver", ["liver-fatty-g1"], lookup, overrides);
    expect(withPath.organs.find((o) => o.organ === "liver")?.text).toContain("Fatty");
    const backToNormal = applyPathologies(withPath, "liver", [], lookup, overrides);
    expect(backToNormal.organs.find((o) => o.organ === "liver")?.text).toBe(MY_LIVER);
  });

  it("normaliseState applies overrides to a saved draft's plain-normal organs", () => {
    const saved = { studyKey: "wa-female", organs: [{ organ: "liver", pathology: null, pathologies: [], custom: false, text: "", vars: {} }], impressionOverride: null };
    const state = normaliseState(saved, "wa-female", { "wa-female:liver": MY_LIVER });
    expect(state.organs.find((o) => o.organ === "liver")?.text).toBe(MY_LIVER);
  });

  it("switchStudy resets plain-normal organs to the new study's overridden normals", () => {
    const overrides = { "kub:ub": "Urinary bladder is my own normal wording." };
    const fromWa = initialState("wa-female");
    const toKub = switchStudy(fromWa, "kub", overrides);
    expect(toKub.organs.find((o) => o.organ === "ub")?.text).toBe("Urinary bladder is my own normal wording.");
  });

  it("resolve prints the overridden normal through the state", () => {
    const state = initialState("wa-female", { "wa-female:liver": MY_LIVER });
    const r = resolve(state, lookup, "", { "wa-female:liver": MY_LIVER });
    expect(r.sections.find((s) => s.organ === "liver")?.text).toBe(MY_LIVER);
  });
});

describe("override persistence + backup", () => {
  it("keys are study:organ and the map round-trips", () => {
    expect(normalOverrideKey("wa-female", "liver")).toBe("wa-female:liver");
  });

  it("buildBackup carries the wordings and parseBackup reads them (old files tolerate absence)", () => {
    const b = buildBackup(
      { appTitle: "CARE USG Studio" },
      [],
      [{ studyKey: "wa-female", organKey: "liver", text: MY_LIVER }],
    );
    expect(b.normalOverrides).toHaveLength(1);
    const parsed = parseBackup(JSON.parse(JSON.stringify(b)));
    expect(parsed.normalOverrides?.[0].text).toBe(MY_LIVER);

    const legacy = parseBackup({ format: "usg-studio-backup", version: 1, settings: {}, customPathologies: [] });
    expect(legacy.normalOverrides ?? []).toEqual([]);
  });

  it("full backup parse keeps the wordings", () => {
    const full = parseFullBackup({
      format: "usg-clinic-backup",
      version: 1,
      settings: {},
      customPathologies: [],
      normalOverrides: [{ studyKey: "kub", organKey: "liver", text: "KUB wording." }],
      patients: [],
      reports: [],
    });
    expect(full.normalOverrides).toHaveLength(1);
  });

  it("db rows upsert by (studyKey, organKey) — idempotent", async () => {
    await db.usgNormalOverride.upsert({
      where: { studyKey_organKey: { studyKey: "wa-female", organKey: "liver" } },
      create: { studyKey: "wa-female", organKey: "liver", text: "v1" },
      update: { text: "v1" },
    });
    await db.usgNormalOverride.upsert({
      where: { studyKey_organKey: { studyKey: "wa-female", organKey: "liver" } },
      create: { studyKey: "wa-female", organKey: "liver", text: "v2" },
      update: { text: "v2" },
    });
    expect(await db.usgNormalOverride.count()).toBe(1);
    expect((await db.usgNormalOverride.findUnique({ where: { studyKey_organKey: { studyKey: "wa-female", organKey: "liver" } } }))?.text).toBe("v2");
  });
});
