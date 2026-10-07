/**
 * The bill desk decides the format — including for a draft that already exists.
 *
 * Why: a study that reaches PACS before its bill is linked opens as a draft
 * while its billed procedure is still blank or the "USG Study" stand-in, so the
 * draft gets whatever the fallback guessed. CARE's real procedure arrives on a
 * later sync, and until now re-opening the row returned the old draft untouched
 * — a whole-abdomen canvas in front of a bill for a thyroid scan.
 */
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { normaliseState } from "../src/lib/usg/composer";
import { isPristineDraft } from "../src/lib/usg/orderStudy";

const pristineWa = JSON.stringify(normaliseState({}, "wa-female"));
const DEFAULTS = { defaultStateJson: pristineWa };

describe("isPristineDraft — the gate on rewriting a draft", () => {
  test("a draft still holding the generated default is pristine", () => {
    expect(isPristineDraft({ studyKey: "wa-female", stateJson: pristineWa, ...DEFAULTS })).toBe(true);
  });

  test("key ordering alone is not an edit", () => {
    // Every object rebuilt with its keys in reverse order, at every depth —
    // same data, different serialisation, because the composer and the server
    // are not guaranteed to write the same key order.
    const reorderDeep = (v: unknown): unknown => {
      if (Array.isArray(v)) return v.map(reorderDeep);
      if (v && typeof v === "object") {
        const out: Record<string, unknown> = {};
        for (const k of Object.keys(v).reverse()) out[k] = reorderDeep((v as Record<string, unknown>)[k]);
        return out;
      }
      return v;
    };
    const reordered = JSON.stringify(reorderDeep(JSON.parse(pristineWa)));
    expect(reordered).not.toBe(pristineWa); // genuinely a different string
    expect(isPristineDraft({ studyKey: "wa-female", stateJson: reordered, ...DEFAULTS })).toBe(true);
  });

  test("a typed note makes it the doctor's, not ours", () => {
    const touched = JSON.parse(pristineWa);
    const organ = touched.organs?.[0];
    if (organ) organ.note = "liver 14 cm, coarse echotexture";
    expect(isPristineDraft({ studyKey: "wa-female", stateJson: JSON.stringify(touched), ...DEFAULTS })).toBe(false);
  });

  test("an abnormal organ tap makes it the doctor's", () => {
    const touched = JSON.parse(pristineWa);
    if (touched.organs?.[0]) touched.organs[0].status = "abnormal";
    expect(isPristineDraft({ studyKey: "wa-female", stateJson: JSON.stringify(touched), ...DEFAULTS })).toBe(false);
  });

  test("a finalized report is never rewritten, however empty it looks", () => {
    expect(
      isPristineDraft({
        finalizedAt: new Date("2026-10-07T05:00:00Z"),
        studyKey: "wa-female",
        stateJson: pristineWa,
        ...DEFAULTS,
      }),
    ).toBe(false);
  });

  test("the empty canvas (unmapped bill, no format at all) is open for adoption", () => {
    expect(
      isPristineDraft({
        studyKey: "",
        stateJson: JSON.stringify({ studyKey: "", organs: [], impressionOverride: null }),
        defaultStateJson: "",
      }),
    ).toBe(true);
  });

  test("unreadable state is treated as the doctor's", () => {
    expect(isPristineDraft({ studyKey: "wa-female", stateJson: "{not json", ...DEFAULTS })).toBe(false);
  });

  test("a different format's default is NOT pristine for this key", () => {
    // Guards the direction of the comparison: the caller passes the default for
    // the draft's own study key, so a mismatch must refuse.
    expect(
      isPristineDraft({
        studyKey: "thyroid",
        stateJson: pristineWa,
        defaultStateJson: JSON.stringify(normaliseState({}, "thyroid")),
      }),
    ).toBe(false);
  });
});

describe("the start route wires the adoption", () => {
  const route = readFileSync("src/app/api/usg/worklist/[id]/start/route.ts", "utf8");

  test("the already-started branch consults the gate and updates the report", () => {
    expect(route).toMatch(/isPristineDraft\(\{/);
    expect(route).toMatch(/db\.usgReport\.update\(\{/);
  });

  test("adoption is gated on a mapped billed format, never on a guess", () => {
    expect(route).toMatch(/boot\.kind === "mapped" \? boot\.studyKey : null/);
  });

  test("the decision is audited, so a rewritten draft is never unexplained", () => {
    expect(route).toMatch(/report\.format_adopted/);
  });

  test("a finalized draft cannot reach the update, because the gate says so", () => {
    // The route passes finalizedAt through; the predicate owns the rule. This
    // asserts the wiring carries the field rather than dropping it.
    expect(route).toMatch(/finalizedAt: existing\.finalizedAt/);
  });
});
