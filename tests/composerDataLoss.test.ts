/**
 * Guard: the composer must never destroy a report without a way back.
 *
 * Three regressions this pins, all of which shipped silently:
 *  1. `n` / "Clear all" / the NP buttons rewrote every organ and cleared the
 *     written impression, and the composer has no general undo — so the only
 *     recovery was retyping. Each of those paths now announces itself with an
 *     Undo action (visible toasts being a separate, also-fixed prerequisite).
 *  2. "Fill blank organs" skipped only chip-selected organs, so one click
 *     overwrote hand-typed wording on all 13 organs of a fresh study.
 *  3. Every unsaved report shared the autosave key "usg-draft:new", so opening
 *     patient B offered "Restore" on patient A's draft.
 *
 * Source-text assertions: the property is "no destructive path lacks a way
 * back", which a single function's runtime test cannot express.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const read = (p: string): string => readFileSync(p, "utf8");

const TOOLBAR = "src/components/studio/usg/composer/ComposerToolbar.tsx";
const COMPOSER = "src/components/studio/usg/UsgComposer.tsx";

describe("whole-report macros are undoable", () => {
  const src = read(TOOLBAR);

  it("every state-replacing macro call is announced with Undo", () => {
    // A destructive whole-report write must be followed, in the same block, by
    // the announcement that carries the pre-macro snapshot.
    const offenders: number[] = [];
    for (const m of src.matchAll(/setState\((?:next|\(s\) => markAllNormal\(s, study\))\);/g)) {
      if (!src.slice(m.index, m.index + 240).includes("announceMacro(")) offenders.push(m.index);
    }
    expect(offenders, "a whole-report setState has no Undo announcement").toEqual([]);
  });

  it("the undo helper restores the snapshot it was given", () => {
    expect(src).toMatch(/action:\s*\{\s*label:\s*"Undo",\s*onClick:\s*\(\)\s*=>\s*setState\(prev\)\s*\}/);
  });
});

describe("Fill blank organs only fills blank organs", () => {
  const src = read(TOOLBAR);
  const macro = /const applyAllNormalMacro = \(\) => \{([\s\S]*?)\n  \};/.exec(src);

  it("exists", () => expect(macro).toBeTruthy());

  it("never overwrites wording the doctor typed", () => {
    expect(macro![1]).toMatch(/organState\.custom/);
  });

  it("never overwrites an organ that already has text", () => {
    expect(macro![1]).toMatch(/organState\.text\?\.trim\(\)/);
  });
});

describe("autosave drafts cannot cross patients", () => {
  const src = read(COMPOSER);

  it("the shared 'usg-draft:new' key is no longer reachable", () => {
    expect(src).not.toMatch(/draftKey\(report\?\.id \?\? null\)/);
  });

  it("an unsaved report keys on its order, or on the patient, or on the mount", () => {
    expect(src).toMatch(/report\?\.id \?\? order\?\.id/);
  });
});
