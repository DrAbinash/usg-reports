"use client";
/**
 * Back-compat: shortcuts live in the expandable tips ribbon now.
 * Kept so older imports of UsgShortcutOverlay still resolve; the ribbon
 * owns the "?" toggle and the detailed list.
 */
export { UsgTipsRibbon as UsgShortcutOverlay } from "./UsgTipsRibbon";
