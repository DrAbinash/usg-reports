// @vitest-environment jsdom
/**
 * Auto-fill Impression is one click, and one click means one click.
 *
 * It used to open "Replace existing impression?" whenever the impression box was
 * not empty. The standing instruction on automation in this clinic is that auto
 * means easy, not closed eyes — the doctor reads every report before signing —
 * and the interrupt fired on the case he uses most: re-running the draft after
 * editing it. The overwrite is undoable instead (the write goes through the
 * composer's undo funnel, so Ctrl+Z puts his text back) and the toast says so.
 *
 * The harness below holds the state for real, so what is asserted is what ends up
 * on screen, not what a callback was handed. jsdom still lays nothing out: every
 * box measures 0×0 here, and "shown" means "in the DOM".
 */
import { readFileSync } from "node:fs";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const toasts: string[] = [];
vi.mock("sonner", () => ({
  toast: {
    success: (m: string) => toasts.push(m),
    message: (m: string) => toasts.push(m),
    warning: (m: string) => toasts.push(m),
    error: (m: string) => toasts.push(m),
  },
}));

import { ImpressionZone, type ImpressionZoneProps } from "@/components/studio/usg/composer/ImpressionZone";
import { makeLookup, normaliseState, resolve } from "@/lib/usg/composer";
import { USG_PATHOLOGIES_ALL } from "@/lib/usg/pathologies";
import type { UsgComposerState } from "@/lib/usg/types";

const HIS_TEXT = "Right renal calculus. Clinical correlation advised.";
const lookup = makeLookup(USG_PATHOLOGIES_ALL);

function seed(studyKey: string, organs: unknown[], impression: string | null): UsgComposerState {
  const s = normaliseState({ studyKey, organs }, studyKey, {}) as UsgComposerState;
  s.impressionOverride = impression;
  return s;
}

const DRAFTED = () =>
  seed("wa-male", [{ organ: "liver", pathologies: ["liver-fatty-g1"], text: "Liver is enlarged.", vars: {} }], HIS_TEXT);

let writes = 0;

function Harness({ initial, studyKey = "wa-male" }: { initial: UsgComposerState; studyKey?: string }) {
  const [state, setState] = useState<UsgComposerState>(initial);
  // Typed as the component's own props: if the zone ever needs something the
  // composer no longer gives it, this is where the build says so.
  const props: ImpressionZoneProps = {
    resolved: resolve(state, lookup, "Routine transabdominal scan.", {}),
    state,
    setState: (next) => {
      writes++;
      setState(next);
    },
    isFinal: false,
    studyKey,
    impressionManual: !!state.impressionOverride,
    setImpressionManual: () => {},
    enableBirads: false,
    birads: null,
    setBirads: () => {},
    priorFinalized: [],
    savedId: "rep-1",
    pathologies: USG_PATHOLOGIES_ALL,
  };
  return <ImpressionZone {...props} />;
}

function mount(initial: UsgComposerState, studyKey?: string) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <Harness initial={initial} studyKey={studyKey} />
    </QueryClientProvider>,
  );
}

const button = () => screen.getByRole("button", { name: /Auto-fill Impression/ });

beforeEach(() => {
  toasts.length = 0;
  // Reset here, never in the component: the click itself re-renders the harness,
  // and a counter cleared on render reads zero for a write that did happen.
  writes = 0;
});

afterEach(cleanup);

describe("one click, no interrupt", () => {
  it("replaces a typed impression, with no dialog in between", async () => {
    mount(DRAFTED());
    expect(screen.getByDisplayValue(HIS_TEXT)).toBeTruthy();
    await userEvent.click(button());

    // Two clicks and a modal used to stand here; the box now holds the draft.
    // More than one textarea is mounted (impression + advice), so the assertion
    // is about his sentence being gone and a draft being present.
    expect(screen.queryByText("Replace existing impression?")).toBeNull();
    expect(writes).toBe(1);
    expect(screen.queryByDisplayValue(HIS_TEXT)).toBeNull();
    const values = screen.getAllByRole("textbox").map((t) => (t as HTMLTextAreaElement).value);
    expect(values.some((v) => v.trim().length > 10 && v !== HIS_TEXT)).toBe(true);
  });

  it("names the way back to his own text", async () => {
    mount(DRAFTED());
    await userEvent.click(button());
    expect(toasts.some((m) => /replaced/i.test(m))).toBe(true);
    expect(toasts.some((m) => /Ctrl\+Z/i.test(m))).toBe(true);
    // The promise is only good if the composer's own hotkey answers, and it
    // stands down while a field has the focus. After one click the focus is the
    // button — measured here rather than assumed, because the copy says it.
    const active = document.activeElement as HTMLElement | null;
    expect(active?.tagName).toBe("BUTTON");
    expect(["INPUT", "TEXTAREA", "SELECT"].includes(active?.tagName ?? "")).toBe(false);
    expect(active?.isContentEditable ?? false).toBe(false);
  });

  it("says so, and writes nothing, when the study has nothing to compose yet", async () => {
    // A pregnancy scan with no biometry typed: the deterministic composer has no
    // lines to offer, so the click has to explain that rather than blank the
    // impression already in the box.
    mount(seed("ob-pregnancy", [], HIS_TEXT), "ob-pregnancy");
    await userEvent.click(button());
    expect(writes).toBe(0);
    expect(toasts.join(" ")).toMatch(/Nothing to auto-fill/i);
    expect(screen.getByDisplayValue(HIS_TEXT)).toBeTruthy();
  });

  it("does not hold a funeral over text that was never there", async () => {
    mount(seed("wa-male", [{ organ: "liver", pathologies: ["liver-fatty-g1"], text: "", vars: {} }], null));
    await userEvent.click(button());
    expect(writes).toBe(1);
    expect(toasts.join(" ")).not.toMatch(/replaced/i);
  });
});

describe("the overwrite is undoable because it goes through the composer funnel", () => {
  it("the zone is handed the state setter that owns the undo stack", () => {
    // UsgComposer owns the stack and passes setState down. If a caller ever hands
    // the raw setter instead, the auto-fill stops being undoable and the toast
    // above becomes a lie — so the call site is pinned with it.
    const src = readFileSync("src/components/studio/usg/UsgComposer.tsx", "utf8");
    expect(src).toMatch(/setState=\{setState\}/);
    expect(src).not.toMatch(/setState=\{setRawState\}/);
  });
});
