/**
 * The composer's undo history.
 *
 * Ctrl+Z did nothing here. The only undo in the app was a toast button that
 * appeared after the two whole-report macros ("all normal", "NP · no sizes") and
 * put back the one state object the macro had replaced — which is not undo, it is
 * an apology for the worst macro. A doctor who mis-taps a chip, or whose Space
 * key jumps to the wrong organ and toggles something, had to fix it by hand.
 *
 * So: a stack of previous states, with one rule that decides whether it feels
 * right. Consecutive changes inside `COALESCE_MS` are ONE step. Without that,
 * typing a sentence is forty presses of Ctrl+Z and a report is unfixable; with
 * it, one press takes back the sentence and the next takes back the chip before
 * it. The coalescing is by time, not by which field changed, because the things
 * he does fast are the things he means as one action.
 *
 * Pure: no React, no DOM. The composer owns one of these in a ref.
 */

export type UndoStack<T> = {
  past: T[];
  future: T[];
  /** When the last change was recorded — what makes a burst a burst. */
  lastAt: number;
  /** The state the current burst started from, or null between bursts. */
  burstBase: T | null;
};

/** Enough steps for a report, small enough that a long session cannot grow it. */
export const UNDO_LIMIT = 60;

/**
 * Changes closer together than this are the same action.
 *
 * 700 ms is a deliberate pause, not a fast typist's interval: it is roughly how
 * long between finishing a thought and starting the next click.
 */
export const COALESCE_MS = 700;

export function createUndoStack<T>(): UndoStack<T> {
  return { past: [], future: [], lastAt: 0, burstBase: null };
}

/**
 * Record that the state is going from `from` to `to`.
 *
 * Returns true when this change opened a new undo step, so the caller can say so
 * ("Undid …" needs to know whether there is anything to undo).
 */
export function recordChange<T>(
  stack: UndoStack<T>,
  from: T,
  to: T,
  now: number,
  opts: { limit?: number; coalesceMs?: number } = {},
): boolean {
  if (from === to) return false;
  const limit = opts.limit ?? UNDO_LIMIT;
  const coalesceMs = opts.coalesceMs ?? COALESCE_MS;

  stack.future = [];
  if (stack.burstBase !== null && now - stack.lastAt < coalesceMs) {
    // Same action, still going. The step was already opened by its first change.
    stack.lastAt = now;
    return false;
  }
  stack.past.push(from);
  if (stack.past.length > limit) stack.past.shift();
  stack.burstBase = from;
  stack.lastAt = now;
  return true;
}

/** The state to go back to, or undefined when there is nothing to undo. */
export function undo<T>(stack: UndoStack<T>, current: T, now = Date.now()): T | undefined {
  const target = stack.past.pop();
  if (target === undefined) return undefined;
  stack.future.push(current);
  // An undo is not part of the burst it just removed.
  stack.burstBase = null;
  stack.lastAt = now;
  return target;
}

/** The state to go forward to, or undefined when there is nothing to redo. */
export function redo<T>(stack: UndoStack<T>, current: T, now = Date.now()): T | undefined {
  const target = stack.future.pop();
  if (target === undefined) return undefined;
  stack.past.push(current);
  stack.burstBase = null;
  stack.lastAt = now;
  return target;
}

export const canUndo = (stack: UndoStack<unknown>) => stack.past.length > 0;
export const canRedo = (stack: UndoStack<unknown>) => stack.future.length > 0;
