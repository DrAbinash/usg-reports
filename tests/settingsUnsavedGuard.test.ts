/**
 * Guard: leaving the Settings screen must never throw away typed, unsaved work
 * in silence.
 *
 * Why this shipped unnoticed: AppShell renders <SettingsView /> only while
 * `view === "settings"`, so switching tabs UNMOUNTS it and every edit that had
 * not reached a Save button died with it — no toast, no badge, no undo. Two
 * paths made it worse: the feature toggles and the nightly-backup switch
 * adopted the server's whole settings object after their own single-key write,
 * wiping unsaved edits in the *other* tabs while the doctor was looking away.
 *
 * The navigation guard is tested for behaviour (it is plain store logic); the
 * screen's side is asserted against source text, because the property is
 * "no unsaved-state path exists" across a 1,700-line component.
 */
import { readFileSync } from "node:fs";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useStudio } from "@/lib/store";

const read = (p: string): string => readFileSync(p, "utf8");

const SETTINGS = "src/components/studio/SettingsView.tsx";
const SHELL = "src/components/studio/AppShell.tsx";

type Confirm = (m: string) => boolean;

describe("the nav guard asks before discarding Settings edits", () => {
  const asked: string[] = [];
  let answer = true;

  beforeEach(() => {
    asked.length = 0;
    answer = true;
    vi.stubGlobal("window", {
      confirm: ((m: string) => {
        asked.push(m);
        return answer;
      }) satisfies Confirm,
    });
    useStudio.setState({ view: "usg", settingsUnsaved: 0, openReportId: null, activeReportId: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("moves quietly when nothing is pending", () => {
    useStudio.setState({ view: "settings", settingsUnsaved: 0 });
    useStudio.getState().setView("usg");
    expect(useStudio.getState().view).toBe("usg");
    expect(asked).toEqual([]);
  });

  it("asks when work is pending, and staying keeps both the view and the count", () => {
    answer = false;
    useStudio.setState({ view: "settings", settingsUnsaved: 3 });
    useStudio.getState().setView("worklist");
    expect(asked).toHaveLength(1);
    expect(asked[0]).toContain("3 unsaved changes");
    expect(useStudio.getState().view).toBe("settings");
    expect(useStudio.getState().settingsUnsaved).toBe(3);
  });

  it("leaving anyway discards and takes the badge with it", () => {
    useStudio.setState({ view: "settings", settingsUnsaved: 2 });
    useStudio.getState().setView("insights");
    expect(useStudio.getState().view).toBe("insights");
    expect(useStudio.getState().settingsUnsaved).toBe(0);
  });

  it("never asks on the way INTO Settings", () => {
    useStudio.setState({ view: "usg", settingsUnsaved: 5 });
    useStudio.getState().setView("settings");
    expect(asked).toEqual([]);
    expect(useStudio.getState().view).toBe("settings");
  });

  it("says change for one and changes for many", () => {
    answer = false;
    useStudio.setState({ view: "settings", settingsUnsaved: 1 });
    useStudio.getState().setView("usg");
    expect(asked[0]).toContain("1 unsaved change on");
    expect(asked[0]).not.toContain("1 unsaved changes");
  });

  it("guards opening a report from the queue too, which also leaves Settings", () => {
    answer = false;
    useStudio.setState({ view: "settings", settingsUnsaved: 4 });
    useStudio.getState().openComposer("r_1");
    expect(useStudio.getState().view).toBe("settings");
    expect(useStudio.getState().openReportId).toBeNull();

    answer = true;
    useStudio.getState().openComposer("r_1");
    expect(useStudio.getState().view).toBe("usg");
    expect(useStudio.getState().openReportId).toBe("r_1");
  });
});

describe("Settings publishes its pending edits instead of losing them", () => {
  const src = read(SETTINGS);

  it("keeps the loaded snapshot it diffs against", () => {
    expect(src).toMatch(/loadedRef\.current = d\.settings \?\? null;/);
    expect(src).toMatch(/loadedRef\.current = r\.settings;/); // Save()
  });

  it("publishes the count to the store the guard reads", () => {
    expect(src).toMatch(/const unsaved = countUnsaved\(s, loadedRef\.current\);/);
    expect(src).toMatch(/setSettingsUnsaved\(unsaved\)/);
  });

  it("warns the browser before a refresh or a closed tab", () => {
    expect(src).toMatch(/addEventListener\("beforeunload"/);
  });

  it("counts numbers and strings as the same field, and ignores secret-presence flags", () => {
    // The print controls write numbers into fields the API returns as strings.
    expect(src).toMatch(/String\(a\[k\] \?\? ""\) !== String\(b\[k\] \?\? ""\)/);
    expect(src).toMatch(/if \(k\.endsWith\("Set"\)\) continue;/);
  });

  it("every save button on the screen shows what is still pending", () => {
    expect((src.match(/<SaveRow n=\{unsaved\}>/g) ?? []).length).toBe(4);
    // Each of the four still calls the same whole-screen save, which is why a
    // screen-wide count is the honest one.
    expect((src.match(/onClick=\{save\}/g) ?? []).length).toBe(3);
    expect(src).toMatch(/onClick=\{\(\) => void save\(\)\}/);
  });

  it("a single-key write never replaces the whole screen", () => {
    // Exactly three places may adopt the server's entire settings object, and
    // all three are paths that really did write everything: the first load,
    // Save, and a restore. The feature toggles, the nightly-backup switch and
    // the WhatsApp routing select each wrote ONE key and then swallowed the
    // whole blob — which is how they cleared edits made in another tab.
    expect((src.match(/setS\((?:r|d|fresh)\.settings\)/g) ?? []).length).toBe(3);
    const boolSetter = src.slice(src.indexOf("const setBool = async"), src.indexOf("const save = async"));
    expect(boolSetter).not.toContain("setS(r.settings)");
    expect(boolSetter).toContain("setS(before)"); // a failed switch is put back
    const routing = src.slice(src.indexOf("whatsappRouting: v"));
    expect(routing).not.toContain("setS(d.settings)");
    expect(routing).toContain("setS(before)");
    const backupSwitch = src.slice(
      src.indexOf("onCheckedChange={async (v)"),
      src.indexOf("Could not change the nightly backup setting"),
    );
    // One request: its own write. The old code fired a second GET purely to
    // re-adopt the whole screen.
    expect((backupSwitch.match(/fetch\("\/api\/settings"/g) ?? []).length).toBe(1);
    expect(backupSwitch).toContain("loadedRef.current = { ...(loadedRef.current ?? s), usgAutoBackup: v }");
  });

  it("a restore says what it costs before it costs it", () => {
    expect(src).toMatch(/Restoring a backup replaces what is shown here/);
  });
});

describe("the pending work is visible from the pinned header", () => {
  const src = read(SHELL);

  it("reads the store's unsaved count", () => {
    expect(src).toMatch(/useStudio\(\(st\) => st\.settingsUnsaved\)/);
  });

  it("marks the Settings entry in both nav forms", () => {
    expect((src.match(/n\.id === "settings" && settingsUnsaved > 0/g) ?? []).length).toBe(2);
  });
});
