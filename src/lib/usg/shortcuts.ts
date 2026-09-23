/**
 * Shared keyboard / rush-workflow shortcut catalog.
 * Only list shortcuts that are actually wired — the tips ribbon teaches trust.
 */

export type ShortcutEntry = {
  key: string;
  action: string;
  /** Short tip line shown in the collapsed ribbon rotation. */
  tip?: string;
  group: "composer" | "navigation" | "rush" | "worklist";
};

export const COMPOSER_SHORTCUTS: ShortcutEntry[] = [
  { key: "Ctrl + S", action: "Save draft", tip: "Save draft anytime with Ctrl+S", group: "composer" },
  { key: "Ctrl + Enter", action: "Finalize (skip QC when clean NP)", tip: "Ctrl+Enter finalizes — clean NP skips the checklist", group: "composer" },
  { key: "Ctrl + Shift + Enter", action: "Finalize + Print", tip: "Ctrl+Shift+Enter finalizes and prints in one step", group: "rush" },
  { key: "Ctrl + P", action: "Print", tip: "Print with Ctrl+P", group: "composer" },
  { key: "Ctrl + K", action: "Switch study", tip: "Switch study with Ctrl+K", group: "composer" },
  { key: "N", action: "Normal · no sizes (whole study)", tip: "Peak-time: press N for Normal · no sizes", group: "rush" },
  { key: "F", action: "Open quality checklist", tip: "F opens the quality checklist before finalize", group: "composer" },
  { key: "P", action: "Print", tip: "P prints when you are not typing", group: "composer" },
  { key: "1-9", action: "Toggle pathology chip (1st–9th)", tip: "Keys 1–9 toggle chips on the focused organ", group: "composer" },
  { key: "Space", action: "Focus next organ", tip: "Space moves to the next organ card", group: "navigation" },
  { key: "?", action: "Show / hide shortcut tips", tip: "Press ? anytime to expand shortcut tips", group: "navigation" },
  { key: "Esc", action: "Close dialogs", tip: "Esc closes open dialogs", group: "navigation" },
];

export const WORKLIST_SHORTCUTS: ShortcutEntry[] = [
  { key: "J / K", action: "Move focus up / down", tip: "Worklist: J/K move between orders", group: "worklist" },
  { key: "N", action: "Start NP · no sizes", tip: "Worklist: N starts the focused order as NP", group: "worklist" },
  { key: "Enter", action: "Start report (measured)", tip: "Worklist: Enter opens the focused order", group: "worklist" },
  { key: "F", action: "Start NP + Fatty Gr I", tip: "Worklist: F starts NP + Fatty Gr I · no size", group: "worklist" },
];

/** Collapsed-ribbon tip pool (one shown at a time). */
export function rotatingTips(): string[] {
  return [...COMPOSER_SHORTCUTS, ...WORKLIST_SHORTCUTS]
    .map((s) => s.tip)
    .filter((t): t is string => !!t);
}

export const TIP_ROTATE_MS = 7000;
