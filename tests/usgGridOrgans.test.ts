/**
 * BPP grid organ engine — totals, print HTML, legacy migration.
 */
import { describe, expect, test } from "vitest";
import {
  coerceGridRows,
  defaultBppRows,
  deriveGridScoreTotal,
  isLegacyGridState,
  BPP_GRID_SCHEMA,
} from "@/lib/usg/gridOrgans";
import { getStudy, initialState } from "@/lib/usg/studies";
import { makeLookup, normaliseState, resolve, setOrganRows } from "@/lib/usg/composer";
import { buildUsgReportHtml, resolveMachineLine, type UsgPrintSettings } from "@/lib/usg/print";

const SETTINGS: UsgPrintSettings = {
  appTitle: "CARE Studio",
  hospitalName: "CARE Diagnostics",
  addressLine: "Deoghar",
  phone: "",
  email: "",
  logoUrl: "",
  footerMessage: "",
  usgDoctorName: "Dr. Sugandha Priyadarshini",
  usgDoctorQual: "MBBS, MD",
  usgDoctorRegNo: "R-1",
  usgMachineLine: "GE Voluson Pro 4-D",
  usgShowMachine: true,
  usgFooterLine: "Kindly co-relate.",
  usgDeclarationLine: "",
};

describe("BPP grid — score total (derived)", () => {
  test("default rows sum to 10/10", () => {
    const rows = defaultBppRows();
    expect(rows).toHaveLength(5);
    expect(deriveGridScoreTotal(rows)).toBe(10);
  });

  test("mixed scores derive correctly and are never stored as a cell", () => {
    const rows = defaultBppRows().map((r, i) =>
      i < 2 ? { ...r, cells: { ...r.cells, score: "0" } } : r,
    );
    expect(deriveGridScoreTotal(rows)).toBe(6);
    expect(rows.every((r) => !("total" in r.cells))).toBe(true);
  });
});

describe("BPP studies + getStudy (late push)", () => {
  test("ob-bpp and twin resolve with grid organs", () => {
    const s = getStudy("ob-bpp");
    expect(s).toBeTruthy();
    const bpp = s!.organs.find((o) => o.key === "bpp");
    expect(bpp?.kind).toBe("grid");
    expect(bpp?.grid?.fixedRows).toHaveLength(5);

    const twin = getStudy("ob-bpp-twin");
    expect(twin?.organs.find((o) => o.key === "bpp_a")?.kind).toBe("grid");
    expect(twin?.organs.find((o) => o.key === "bpp_b")?.kind).toBe("grid");
  });

  test("initialState seeds BPP rows", () => {
    const st = initialState("ob-bpp");
    const bpp = st.organs.find((o) => o.organ === "bpp");
    expect(bpp?.rows?.length).toBe(5);
    expect(deriveGridScoreTotal(bpp!.rows)).toBe(10);
  });
});

describe("normaliseState — grid migration (draft-only semantics)", () => {
  test("grid + rows coerces columns", () => {
    const raw = {
      studyKey: "ob-bpp",
      organs: [
        {
          organ: "bpp",
          pathology: null,
          text: "legacy ignored when rows present",
          vars: {},
          rows: [{ id: "breathing", cells: { score: "0" } }],
        },
      ],
      impressionOverride: null,
    };
    const st = normaliseState(raw, "ob-bpp");
    const bpp = st.organs.find((o) => o.organ === "bpp")!;
    expect(bpp.rows).toHaveLength(5);
    expect(bpp.rows!.find((r) => r.id === "breathing")!.cells.score).toBe("0");
    expect(bpp.rows!.find((r) => r.id === "movements")!.cells.variable).toContain("Fetal movements");
  });

  test("grid + legacy prose keeps text and leaves rows undefined", () => {
    const raw = {
      studyKey: "ob-bpp",
      organs: [
        {
          organ: "bpp",
          pathology: null,
          text: "Fetal breathing: 2. Fetal movement: 2. Total Score: 10/10.",
          vars: {},
        },
      ],
      impressionOverride: null,
    };
    const st = normaliseState(raw, "ob-bpp");
    const bpp = st.organs.find((o) => o.organ === "bpp")!;
    expect(bpp.rows).toBeUndefined();
    expect(bpp.text).toContain("Total Score: 10/10");
    const def = getStudy("ob-bpp")!.organs.find((o) => o.key === "bpp")!;
    expect(isLegacyGridState(def, bpp)).toBe(true);
  });

  test("coerceGridRows fills missing fixed ids", () => {
    const coerced = coerceGridRows(BPP_GRID_SCHEMA, [{ id: "tone", cells: { score: "0" } }]);
    expect(coerced.map((r) => r.id)).toEqual([
      "breathing",
      "movements",
      "tone",
      "nst",
      "afv",
    ]);
    expect(coerced.find((r) => r.id === "tone")!.cells.score).toBe("0");
  });
});

describe("print — BPP grid HTML table", () => {
  test("single BPP prints Variable|Score table with bold total", () => {
    let state = initialState("ob-bpp");
    state = setOrganRows(
      state,
      "bpp",
      defaultBppRows().map((r, i) =>
        i === 0 ? { ...r, cells: { ...r.cells, score: "0" } } : r,
      ),
    );
    const resolved = resolve(state, makeLookup(), "technique");
    const html = buildUsgReportHtml(
      SETTINGS,
      { name: "Test", age: "28", sex: "F", referredBy: "Dr X", date: "24-Sep-26" },
      resolved,
    );
    expect(html).toContain('class="grid-score-table"');
    expect(html).toContain("Variable");
    expect(html).toContain("Score");
    expect(html).toContain('class="grid-total"');
    expect(html).toMatch(/8\/10/);
    expect(html).toContain("Fetal breathing movement");
  });

  test("twin BPP prints side-by-side Fetus-A / Fetus-B", () => {
    const state = initialState("ob-bpp-twin");
    const resolved = resolve(state, makeLookup(), "technique");
    const html = buildUsgReportHtml(
      SETTINGS,
      { name: "Test", age: "30", sex: "F", referredBy: "Dr X", date: "24-Sep-26" },
      resolved,
    );
    expect(html).toContain("grid-twin-wrap");
    expect(html).toContain("Fetus-A");
    expect(html).toContain("Fetus-B");
    expect(html.match(/grid-score-table/g)?.length).toBeGreaterThanOrEqual(2);
  });
});

describe("P2b — machine line by studio", () => {
  test("studio override wins over global usgMachineLine", () => {
    expect(
      resolveMachineLine({
        ...SETTINGS,
        studioId: "clinic-a",
        machineLineByStudio: { "clinic-a": "Samsung HS40" },
      }),
    ).toBe("Samsung HS40");
    expect(resolveMachineLine({ ...SETTINGS, studioId: "other" })).toBe("GE Voluson Pro 4-D");
  });
});
