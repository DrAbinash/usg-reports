/**
 * Ctrl+Z in the composer.
 *
 * There wasn't one. The only undo was a toast button that appeared after the two
 * whole-report macros and put back the state object the macro had replaced, which
 * is an apology, not an undo: a mis-tapped chip, or a Space that moved to the
 * wrong organ and toggled something, had to be fixed by hand.
 *
 * The one rule that decides whether this feels right or feels broken is
 * coalescing: consecutive changes inside a window are ONE step. Without it,
 * typing a sentence costs forty presses of Ctrl+Z. With it, one press takes the
 * sentence back and the next takes the chip before it.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  COALESCE_MS,
  UNDO_LIMIT,
  canRedo,
  canUndo,
  createUndoStack,
  recordChange,
  redo,
  undo,
} from "@/lib/usg/undoHistory";

/** States are compared by identity, so each "edit" is its own object. */
const s = (n: number) => ({ n });

describe("a step is an action, not a keystroke", () => {
  it("records the state before the change, so undo goes back to it", () => {
    const stack = createUndoStack<object>();
    expect(recordChange(stack, s(1), s(2), 1_000)).toBe(true);
    expect(undo(stack, s(2), 1_500)).toEqual(s(1));
    expect(redo(stack, s(1), 1_600)).toEqual(s(2));
  });

  it("counts a burst of fast changes as one step", () => {
    const stack = createUndoStack<object>();
    recordChange(stack, s(1), s(2), 1_000);
    recordChange(stack, s(2), s(3), 1_100);
    recordChange(stack, s(3), s(4), 1_200);
    expect(stack.past.length).toBe(1);
    expect(undo(stack, s(4), 1_300)).toEqual(s(1));
  });

  it("starts a new step once he pauses", () => {
    const stack = createUndoStack<object>();
    recordChange(stack, s(1), s(2), 1_000);
    recordChange(stack, s(2), s(3), 1_000 + COALESCE_MS);
    expect(stack.past.length).toBe(2);
    expect(undo(stack, s(3), 2_000)).toEqual(s(2));
    expect(undo(stack, s(2), 2_100)).toEqual(s(1));
  });

  it("does not record a change that changed nothing", () => {
    const stack = createUndoStack<object>();
    const same = s(1);
    expect(recordChange(stack, same, same, 1_000)).toBe(false);
    expect(canUndo(stack)).toBe(false);
  });
});

describe("the edges that make it trustworthy", () => {
  it("has nothing to undo at the start, and nothing to redo at the end", () => {
    const stack = createUndoStack<object>();
    expect(undo(stack, s(1))).toBeUndefined();
    expect(redo(stack, s(1))).toBeUndefined();
    expect(canUndo(stack)).toBe(false);
    expect(canRedo(stack)).toBe(false);
  });

  it("a new edit throws away the redos, because the future changed", () => {
    const stack = createUndoStack<object>();
    recordChange(stack, s(1), s(2), 1_000);
    undo(stack, s(2), 2_000);
    expect(canRedo(stack)).toBe(true);
    recordChange(stack, s(2), s(9), 3_000);
    expect(canRedo(stack)).toBe(false);
  });

  it("an undo ends the burst it removed, so the next edit is its own step", () => {
    const stack = createUndoStack<object>();
    recordChange(stack, s(1), s(2), 1_000);
    recordChange(stack, s(2), s(3), 1_050);
    undo(stack, s(3), 1_100);
    // 50 ms later — inside the window — but this is a new action, not more typing.
    expect(recordChange(stack, s(1), s(8), 1_150)).toBe(true);
    expect(stack.past.length).toBe(1);
  });

  it("forgets the oldest steps rather than growing forever", () => {
    const stack = createUndoStack<object>();
    for (let i = 0; i < UNDO_LIMIT + 40; i++) {
      recordChange(stack, s(i), s(i + 1), 1_000 + i * 5_000);
    }
    expect(stack.past.length).toBe(UNDO_LIMIT);
    // What is left is the most recent: the state before the last change.
    expect(undo(stack, s(UNDO_LIMIT + 40), 9e12)).toEqual(s(UNDO_LIMIT + 39));
  });
});

describe("the composer routes every write through it", () => {
  const composer = readFileSync("src/components/studio/usg/UsgComposer.tsx", "utf8");
  const toolbar = readFileSync("src/components/studio/usg/composer/ComposerToolbar.tsx", "utf8");
  const catalog = readFileSync("src/lib/usg/shortcuts.ts", "utf8");

  it("wraps the setter, and mirrors the state so a burst sees its own writes", () => {
    expect(composer).toMatch(/const \[state, setRawState\] = useState<UsgComposerState>/);
    expect(composer).toMatch(/const setState = useCallback\(/);
    expect(composer).toMatch(/recordChange\(undoStack\.current, from, to, Date\.now\(\)\)/);
    // Without the synchronous ref write, two setStates in one handler would both
    // read the state React has not committed yet, and the stack would lose one.
    expect(composer).toMatch(/stateRef\.current = to;\s*\r?\n\s*setRawState\(to\);/);
  });

  it("has exactly three places that write state without asking the stack", () => {
    // The wrapper, the undo and the redo. A fourth would be a silent hole in the
    // history, which is how the old toast-undo came to be the only way back.
    expect([...composer.matchAll(/setRawState\(/g)].length).toBe(3);
  });

  it("leaves a focused field to the browser's own undo", () => {
    expect(toolbar).toMatch(/if \(e\.key\.toLowerCase\(\) === "z" && !e\.altKey\)/);
    expect(toolbar).toMatch(/if \(typing \|\| isFinal\) return;/);
    expect(toolbar).toMatch(/const back = e\.shiftKey \? redo : undo;/);
  });

  it("lists the keys it actually answers", () => {
    expect(catalog).toMatch(/key: "Ctrl \+ Z"/);
    expect(catalog).toMatch(/key: "Ctrl \+ Shift \+ Z"/);
    expect(catalog).toMatch(/key: "\/"/);
    // The catalog's own promise: only wired shortcuts.
    expect(toolbar).toMatch(/undo, redo, study\]\);/);
  });
});
