/**
 * Guards for the load and unsaved-work fixes.
 *
 * Each rule here was measured in a real browser first (Playwright against the
 * production build: 22 keystrokes → 1 request; 500-row listing → 5.8 KB per row;
 * Settings/Insights arriving as one extra chunk each on click; the draft written
 * when the tab is hidden and when the composer is closed). These assertions are
 * the cheap CI-level net for the same wiring — they do not replace the browser
 * run, they stop a later edit from undoing it silently.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const COMPOSER = "src/components/studio/usg/UsgComposer.tsx";
const STUDIO = "src/components/studio/usg/UsgStudioView.tsx";
const QUEUE = "src/components/studio/usg/UsgQueuePicker.tsx";
const SHELL = "src/components/studio/AppShell.tsx";
const TOOLBAR = "src/components/studio/usg/composer/ComposerToolbar.tsx";

const read = (p: string) => readFileSync(p, "utf8");

describe("nothing warms up the archive on open", () => {
  it("the studio view prefetches only the row that is pointed at", () => {
    const src = read(STUDIO);
    expect(src).not.toMatch(/for \(const r of reports\.slice\(\d*\)\) prefetchReport/);
    expect(src).toMatch(/onMouseEnter=\{\(\) => onPrefetch\?\.\(\)\}/);
  });

  it("the queue picker never prefetches a patient's whole study list", () => {
    const src = read(QUEUE);
    expect(src).not.toMatch(/for \(const o of studies\.slice/);
    expect(src).toMatch(/prefetchReport\(order\.reportId\)/);
  });

  it("the register renders a page and offers the rest", () => {
    const src = read(STUDIO);
    expect(src).toMatch(/const REGISTER_PAGE = 100;/);
    expect(src).toMatch(/useState\(REGISTER_PAGE\)/);
    expect(src).toMatch(/filtered\.slice\(0, registerLimit\)/);
    expect(src).toMatch(/Show all \{filtered\.length\} reports/);
    // The page must be re-armed when the doctor filters, or a search after
    // "Show all" would still render the whole archive.
    expect(src).toMatch(/useEffect\(\(\) => setRegisterLimit\(REGISTER_PAGE\), \[query, statusFilter\]\)/);
  });

  it("Settings and Insights are split out of the first paint", () => {
    const src = read(SHELL);
    expect(src).toMatch(/import dynamic from "next\/dynamic"/);
    expect(src).toMatch(/dynamic\(\(\) => import\("\.\/SettingsView"\)/);
    expect(src).toMatch(/dynamic\(\(\) => import\("\.\/usg\/UsgInsightsView"\)/);
    expect(src).not.toMatch(/^import \{ SettingsView \} from/m);
    expect(src).not.toMatch(/^import \{ UsgInsightsView \} from/m);
  });
});

describe("typing does not become a fan-out", () => {
  it("both prior-study queries key on the settled name, not the keystrokes", () => {
    const src = read(COMPOSER);
    const byName = /queryKey: \["usg", "reports", "by-name", ([^\]]+)\]/.exec(src)?.[1] ?? "";
    const prior = /queryKey: \["usg", "reports", "prior-finalized", ([^\]]+)\]/.exec(src)?.[1] ?? "";
    expect(byName).toContain("settledName");
    expect(prior).toContain("settledName");
    expect(prior).toContain("settledPhone");
    expect(src).toMatch(/const t = setTimeout\(\(\) => \{\s*setSettledName\(patientName\);\s*setSettledPhone\(patientPhone\);\s*\}, 300\);/);
  });
});

describe("a draft survives the tab and the screen", () => {
  const src = read(COMPOSER);

  it("the newest snapshot is captured while rendering, not in an effect", () => {
    expect(src).toMatch(/latestSnapRef\.current = currentSnap;/);
    // The flush must read that ref: an effect-set ref misses the last edit
    // before an unmount, which is the exact edit being saved.
    expect(src).toMatch(/const snap = latestSnapRef\.current;/);
  });

  it("a hidden tab, a page being torn down and a closed composer all flush", () => {
    expect(src).toMatch(/document\.addEventListener\("visibilitychange", onVisibility\);/);
    expect(src).toMatch(/window\.addEventListener\("pagehide", flush\);/);
    const cleanup = /return \(\) => \{\s*document\.removeEventListener\("visibilitychange", onVisibility\);\s*window\.removeEventListener\("pagehide", flush\);\s*flush\(\);/.test(src);
    expect(cleanup).toBe(true);
  });

  it("the flush refuses a finalized report instead of resurrecting a draft", () => {
    const body = /const writeDraftNow = useCallback\(\(\) => \{[\s\S]*?\}, \[initialSnap\]\);/.exec(src)?.[0] ?? "";
    expect(body).toMatch(/if \(!snap \|\| isFinalRef\.current\) return;/);
    expect(body).toMatch(/if \(!snapshotDiffers\(\{ \.\.\.snap, savedAt: 0 \}, initialSnap\)\) return;/);
  });

  it("the doctor is told the draft was kept, and where it was kept from", () => {
    const bar = read(TOOLBAR);
    expect(bar).toMatch(/Draft kept at \{new Date\(lastAutosave\)\.toLocaleTimeString/);
    // It must sit outside the collapsible demography strip: a saved report
    // opens collapsed, and that is the screen the doctor is writing on.
    const kept = bar.indexOf("Draft kept at");
    const collapse = bar.indexOf("{!headerCollapsed ? (");
    expect(kept).toBeGreaterThan(-1);
    expect(kept).toBeLessThan(collapse);
    expect(bar).toMatch(/role="status"/);
  });

  it("the tour no longer promises a save that happens every second", () => {
    const tour = read("src/components/studio/usg/GuidedTour.tsx");
    expect(tour).not.toMatch(/every second/);
    expect(tour).toMatch(/Ctrl\+S or Save/);
  });
});
