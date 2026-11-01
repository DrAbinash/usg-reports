/**
 * The composer's image pane has three states: showing OHIF, hidden by the
 * layout (the sidebar renders its own "images are hidden — click to open"
 * button for that), or absent because the report carries no StudyInstanceUID.
 *
 * Only the last one used to be silent, and it read as a broken viewer: the
 * operator reported "embedded OHIF is not seen after the update" while nothing
 * in the viewer code had changed. An absent pane must name its own reason.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("the unlinked-report viewer state explains itself", () => {
  const zone = readFileSync("src/components/studio/usg/composer/PreviewZone.tsx", "utf8");

  it("renders a strip instead of nothing when there is no study identifier", () => {
    expect(zone).toContain('data-testid="viewer-unlinked-strip"');
    expect(zone).toMatch(/No study linked to this report/);
  });

  it("hangs off the same orderUid check that gates the viewer", () => {
    // Otherwise the strip can outlive the gate it describes and go stale.
    expect(zone).toMatch(/\{orderUid \? \(\s*<UsgViewerSidebar[\s\S]*?\)\s*:\s*\(/);
  });
});
