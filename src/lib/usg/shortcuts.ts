/**
 * Shared keyboard / rush-workflow shortcut catalog.
 * Used by the tips ribbon (always-on reminder) and any overlay that lists keys.
 */

export type ShortcutEntry = {
  key: string;
  action: string;
  /** Short tip line shown in the collapsed ribbon rotation. */
  tip?: string;
  group: "composer" | "navigation" | "rush";
};

export const COMPOSER_SHORTCUTS: ShortcutEntry[] = [
  { key: "Ctrl + S", action: "Save draft", tip: "Save draft anytime with Ctrl+S", group: "composer" },
  { key: "Ctrl + Enter", action: "Finalize", tip: "Finalize with Ctrl+Enter when the report is ready", group: "composer" },
  { key: "Ctrl + K", action: "Switch study", tip: "Switch study with Ctrl+K", group: "composer" },
  { key: "Ctrl + P", action: "Print", tip: "Print / PDF with Ctrl+P", group: "composer" },
  { key: "N", action: "Normal · no sizes (whole study)", tip: "Peak-time: press N for Normal · no sizes", group: "rush" },
  { key: "1-9", action: "Toggle pathology chip (1st–9th)", tip: "Keys 1–9 toggle pathology chips on the open organ", group: "composer" },
  { key: "Space", action: "Open next organ", tip: "Space opens the next organ card", group: "navigation" },
  { key: "F", action: "Finalize (quality check)", tip: "F runs quality check then finalize", group: "composer" },
  { key: "P", action: "Print preview", tip: "P opens print preview", group: "composer" },
  { key: "/", action: "Focus search", tip: "Slash focuses search", group: "navigation" },
  { key: "?", action: "Show / hide shortcut tips", tip: "Press ? anytime to expand shortcut tips", group: "navigation" },
  { key: "Esc", action: "Close dialogs", tip: "Esc closes open dialogs", group: "navigation" },
];

/** Collapsed-ribbon tip pool (one shown at a time). */
export function rotatingTips(): string[] {
  return COMPOSER_SHORTCUTS.map((s) => s.tip).filter((t): t is string => !!t);
}

export const TIP_ROTATE_MS = 7000;
