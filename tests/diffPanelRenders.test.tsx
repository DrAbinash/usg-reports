// @vitest-environment jsdom
/**
 * The Δ panel renders what it is given — in a DOM, not in a string.
 *
 * `computeDiff` is covered by tests/usgDiff.test.ts and the wiring that opens a
 * comparison by tests/priorStudyCompare.test.ts. Neither one can see the panel
 * itself, and the defects that live in a component are of the kind no
 * node-environment test has caught in this repo: a prop carried all the way in
 * and never rendered, a unit glued to a word, a body still open when the header
 * says it closed. So this file mounts the real component in jsdom and asks what
 * a doctor would read.
 *
 * Note what jsdom cannot do: it lays nothing out, so every box is 0×0 and
 * "visible" here means "in the DOM". Overlap, size and scroll still have to be
 * measured in a browser.
 */
import { readFileSync } from "node:fs";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { UsgDiffPanel, type DiffSource } from "@/components/studio/usg/UsgDiffPanel";
import { USG_PATHOLOGIES_ALL } from "@/lib/usg/pathologies";
import type { UsgComposerState } from "@/lib/usg/types";

const SPAN_ROW = "LIVER — Liver span (MCL)";

function state(over: Record<string, unknown> = {}): UsgComposerState {
  return {
    studyKey: "wa-male",
    organs: [
      { organ: "liver", pathology: "liver-fatty-g1", pathologies: ["liver-fatty-g1"], text: "", vars: { span: "13.5" } },
    ],
    ...over,
  } as unknown as UsgComposerState;
}

const PRIOR: DiffSource = {
  id: "prior-1",
  serial: "USG-005150",
  date: "08 Oct 2026",
  stateJson: JSON.stringify(state()),
  impression: "Grade I fatty liver.\nNo other abnormality.",
};

function panel(current: UsgComposerState, props: Record<string, unknown> = {}) {
  return render(
    <UsgDiffPanel source={PRIOR} state={current} pathologies={USG_PATHOLOGIES_ALL} {...props} />,
  );
}

/** The liver card with the span set to something else. */
function today(span: string, extra: Record<string, unknown> = {}) {
  return state({ organs: [{ organ: "liver", pathologies: ["liver-fatty-g1"], text: "", vars: { span } }], ...extra });
}

afterEach(cleanup);

describe("the header names the scan being compared", () => {
  it("carries the register number and the date of the prior report", () => {
    panel(state());
    const toggle = screen.getByRole("button", { name: /Δ vs previous scan/ });
    expect(toggle.textContent).toContain("USG-005150");
    expect(toggle.textContent).toContain("08 Oct 2026");
  });

  it("says so plainly when nothing has moved since the last scan", () => {
    panel(state());
    expect(screen.getByText("no changes yet — identical to the last scan")).toBeTruthy();
    expect(screen.queryByText(SPAN_ROW)).toBeNull();
  });
});

describe("a measurement that was emptied reads as emptied", () => {
  it("renders the word cleared, never the word with a unit after it", () => {
    // The span is deleted between the scans. The row has to read "13.5 cm →
    // cleared", not "cleared cm": the unit belonged to the number that went, not
    // to the absence of one that came.
    panel(today(""));
    const row = screen.getByText(SPAN_ROW).parentElement;
    expect(row?.textContent).toContain("13.5 cm");
    expect(row?.textContent).toContain("cleared");
    expect(row?.textContent).not.toMatch(/cleared\s+cm/);
  });

  it("keeps the unit when there is a number for it to belong to", () => {
    panel(today("15.2"));
    const row = screen.getByText(SPAN_ROW).parentElement;
    expect(row?.textContent).toContain("13.5 cm");
    expect(row?.textContent).toContain("15.2 cm");
  });
});

describe("a control appears only when it does something", () => {
  it("offers stop comparing only for a comparison that can be closed, and calls back", async () => {
    const calls: string[] = [];
    const moved = today("15.2");

    const first = panel(moved);
    expect(screen.queryByRole("button", { name: /stop comparing/ })).toBeNull();
    first.unmount();

    panel(moved, { onDismiss: () => calls.push("dismiss") });
    await userEvent.click(screen.getByRole("button", { name: /stop comparing/ }));
    expect(calls).toEqual(["dismiss"]);
  });

  it("offers to fill empty slots only when the composer can fill them", async () => {
    const calls: string[] = [];
    const first = panel(state());
    expect(screen.queryByRole("button", { name: /Fill empty slots from prior/ })).toBeNull();
    first.unmount();

    panel(state(), { onCopyForward: () => calls.push("copy") });
    await userEvent.click(screen.getByRole("button", { name: /Fill empty slots from prior/ }));
    expect(calls).toEqual(["copy"]);
  });
});

describe("collapsing hides the changes and keeps the header", () => {
  it("closes and reopens on the header click", async () => {
    // Grade II today: the span moved, one finding came, one went.
    const grade2 = state({
      organs: [
        { organ: "liver", pathology: "liver-fatty-g2", pathologies: ["liver-fatty-g2"], text: "", vars: { span: "15.2" } },
      ],
      impressionOverride: "Grade II fatty liver with hepatomegaly.",
    });
    panel(grade2);
    expect(screen.getByText(SPAN_ROW)).toBeTruthy();
    expect(screen.getByText("3 changes")).toBeTruthy();

    const toggle = screen.getByRole("button", { name: /Δ vs previous scan/ });
    await userEvent.click(toggle);
    expect(screen.queryByText(SPAN_ROW)).toBeNull();
    expect(screen.getByRole("button", { name: /Δ vs previous scan/ })).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: /Δ vs previous scan/ }));
    expect(screen.getByText(SPAN_ROW)).toBeTruthy();
  });
});

describe("the panel is mounted where the doctor sees it", () => {
  it("the composer's comparison reaches the panel through the toolbar", () => {
    // A prop a component accepts but its caller never passes is the exact failure
    // this file exists to catch — and here the value crosses two files, so both
    // links are asserted. The panel above proves it honours onDismiss; these
    // prove the studio actually gives it one.
    const composer = readFileSync("src/components/studio/usg/UsgComposer.tsx", "utf8");
    const toolbar = readFileSync("src/components/studio/usg/composer/ComposerToolbar.tsx", "utf8");
    expect(composer).toMatch(/onDismissDiff=\{priorDiff \? clearPriorDiff : undefined\}/);
    expect(composer).toMatch(/shownDiffSource = priorDiff \?\? diffSource \?\? null/);
    expect(toolbar).toMatch(/onDismiss=\{onDismissDiff\}/);
  });
});
