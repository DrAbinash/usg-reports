/**
 * USG Phase 3 tests — register discipline, combined findings, LMP
 * calculator, print upgrades (A5 / PROVISIONAL watermark / signature image)
 * and the one-file backup/restore round-trip.
 */
import { describe, expect, test } from "vitest";
import { initialState } from "@/lib/usg/studies";
import { USG_PATHOLOGIES_ALL } from "@/lib/usg/pathologies";
import {
  applyPathologies,
  applyPathology,
  makeLookup,
  normaliseState,
  resolve,
  selectedPathologies,
  setOrganVar,
} from "@/lib/usg/composer";
import { buildUsgReportHtml, formatUsgSerial } from "@/lib/usg/print";
import { eddFromLmp, formatEdd, gaFromLmp, lmpSummary, parseLmpInput } from "@/lib/usg/lmp";
import { parseScanDate, toScanDateInput } from "@/lib/usg/dates";
import { buildBackup, parseBackup, BACKUP_SETTINGS_KEYS } from "@/lib/usg/backup";

const lookupAll = makeLookup(USG_PATHOLOGIES_ALL);

const SETTINGS = {
  appTitle: "CARE Studio",
  hospitalName: "CARE Diagnostics",
  addressLine: "Main Road",
  phone: "12345",
  email: "",
  logoUrl: "",
  footerMessage: "",
  usgDoctorName: "Dr. Sugandha Priyadarshini",
  usgDoctorQual: "MBBS, MD",
  usgDoctorRegNo: "R-123",
  usgMachineLine: "This Scan has been proudly done on GE Voluson Pro 4-D USG Machine",
  usgShowMachine: true,
  usgFooterLine: "Kindly co-relate with clinico-pathological findings.",
  usgDeclarationLine: "",
  usgPrintPaper: "a4",
  usgSignatureUrl: "",
};

const patient = { name: "Test Patient", age: "40", sex: "F", referredBy: "Dr. X", date: "31-Aug-26" };

describe("Register discipline — serial formatting", () => {
  test("formatUsgSerial pads to 4 digits and never renumbers", () => {
    expect(formatUsgSerial(1)).toBe("USG-0001");
    expect(formatUsgSerial(12)).toBe("USG-0012");
    expect(formatUsgSerial(9999)).toBe("USG-9999");
    expect(formatUsgSerial(12345)).toBe("USG-12345"); // no truncation past 4
    expect(formatUsgSerial(0)).toBe("USG-0000");
  });

  test("serial prints in the patient strip; blank serial omits the cell", () => {
    const resolved = resolve(initialState("wa-female"), lookupAll, "t");
    const withSerial = buildUsgReportHtml(SETTINGS, { ...patient, serial: "USG-0007" }, resolved);
    expect(withSerial).toContain("USG-0007");
    const without = buildUsgReportHtml(SETTINGS, patient, resolved);
    expect(without).not.toContain("USG No.");
  });
});

describe("Combined findings — several pathologies on one organ", () => {
  const FATTY = "liver-fatty-g1";
  const HAEMANGIOMA = "liver-hemangioma";
  const HEPATOMEGALY = "liver-hepatomegaly-fatty-g1";

  test("two pathologies merge their texts as paragraphs, impressions and title fragments", () => {
    const base = initialState("wa-female");
    const fatty = USG_PATHOLOGIES_ALL.find((p) => p.key === FATTY)!;
    const haem = USG_PATHOLOGIES_ALL.find((p) => p.key === HAEMANGIOMA)!;

    const state = applyPathologies(base, "liver", [FATTY, HAEMANGIOMA], lookupAll);
    const liver = state.organs.find((o) => o.organ === "liver")!;

    // Text = both wordings, paragraph-joined, in click order.
    expect(liver.text).toBe([fatty.text, haem.text].join("\n\n"));
    expect(liver.pathologies).toEqual([FATTY, HAEMANGIOMA]);
    expect(liver.pathology).toBe(FATTY); // legacy mirror = first

    // Impression: both pathology lines first, then the doctor's trailing
    // normal summaries (the single-pathology rule, preserved).
    const r = resolve(state, lookupAll, "t");
    expect(r.impression).toEqual([
      ...fatty.impression,
      ...haem.impression,
      "Normal sized uterus with normal endometrial thickness.",
      "Bilateral adenexa normal in morphology.",
      "No POD collection.",
    ]);
    expect(r.title).toBe(`USG WHOLE ABDOMEN WITH ${[fatty.titleFragment, haem.titleFragment].map((f) => f!.toUpperCase()).join(" AND ")}`);
  });

  test("chips toggle — removing one returns to a clean single-pathology organ", () => {
    let state = applyPathologies(initialState("wa-female"), "liver", [FATTY, HAEMANGIOMA], lookupAll);
    state = applyPathologies(state, "liver", [FATTY], lookupAll); // deselect haemangioma
    const liver = state.organs.find((o) => o.organ === "liver")!;
    expect(liver.pathologies).toEqual([FATTY]);
    const fatty = USG_PATHOLOGIES_ALL.find((p) => p.key === FATTY)!;
    expect(liver.text).toBe(fatty.text);
  });

  test("clearing to [] restores the organ's normal wording and normal-only impression", () => {
    let state = applyPathologies(initialState("wa-female"), "liver", [FATTY, HAEMANGIOMA, HEPATOMEGALY], lookupAll);
    state = applyPathologies(state, "liver", [], lookupAll);
    const liver = state.organs.find((o) => o.organ === "liver")!;
    expect(liver.pathologies).toEqual([]);
    expect(liver.pathology).toBeNull();
    const study = initialState("wa-female");
    expect(liver.text).toBe(study.organs.find((o) => o.organ === "liver")!.text);
    const r = resolve(state, lookupAll, "t");
    expect(r.impression.join(" ")).not.toMatch(/fatty|haemangioma|hepatomegaly/i);
  });

  test("unknown / wrong-organ keys are dropped, duplicates collapse", () => {
    const state = applyPathologies(
      initialState("wa-female"),
      "liver",
      [FATTY, "no-such-pathology", "gb-stones", FATTY],
      lookupAll,
    );
    const liver = state.organs.find((o) => o.organ === "liver")!;
    expect(liver.pathologies).toEqual([FATTY]); // gb-stones belongs to the gall bladder card
  });

  test("typed measurements survive when any combined text uses the same token", () => {
    let state = initialState("kub");
    state = setOrganVar(state, "kidney_rt", "size", "8");
    state = applyPathologies(state, "kidney_rt", ["kidney-calculus", "kidney-rt-hydro"], lookupAll);
    const kidney = state.organs.find((o) => o.organ === "kidney_rt")!;
    expect(kidney.vars["size"]).toBe("8");
  });

  test("legacy single-pathology states still resolve identically (backward compat)", () => {
    // A draft saved by Phase 2: pathology set, no pathologies array, the
    // organ text already swapped to the pathology wording.
    const fatty = USG_PATHOLOGIES_ALL.find((p) => p.key === "liver-fatty-g1")!;
    const legacy = normaliseState({
      studyKey: "wa-female",
      organs: initialState("wa-female").organs.map((o) => {
        const { pathologies: _drop, ...rest } = o;
        return o.organ === "liver"
          ? { ...rest, pathology: "liver-fatty-g1", text: fatty.text }
          : rest;
      }),
      impressionOverride: null,
    });
    const legacyResolved = resolve(legacy, lookupAll, "t");

    const modern = applyPathology(initialState("wa-female"), "liver", "liver-fatty-g1", lookupAll);
    const modernResolved = resolve(modern, lookupAll, "t");

    expect(legacyResolved.impression).toEqual(modernResolved.impression);
    expect(legacyResolved.title).toBe(modernResolved.title);
    expect(legacyResolved.sections.find((s) => s.organ === "liver")!.text).toBe(
      modernResolved.sections.find((s) => s.organ === "liver")!.text,
    );
  });

  test("upper-abdomen normal line accounts for combined selections", () => {
    // Bladder carries TWO pathologies while the whole upper group stays
    // normal: the "Normal scan of upper abdomen." prefix must appear.
    let state = applyPathologies(initialState("wa-female"), "ub", ["ub-calculus", "ub-cystitis"], lookupAll);
    const r = resolve(state, lookupAll, "t");
    expect(r.impression[0]).toMatch(/normal scan of upper abdomen/i);
    // And with an upper organ affected the prefix must NOT appear.
    const withLiver = applyPathologies(state, "liver", [FATTY], lookupAll);
    expect(resolve(withLiver, lookupAll, "t").impression[0]).not.toMatch(/normal scan of upper abdomen/i);
  });

  test("selectedPathologies reads the combined list and falls back to legacy", () => {
    expect(selectedPathologies({ pathology: null, pathologies: [] })).toEqual([]);
    expect(selectedPathologies({ pathology: "x" })).toEqual(["x"]);
    expect(selectedPathologies({ pathology: "x", pathologies: ["a", "b"] })).toEqual(["a", "b"]);
    expect(selectedPathologies({ pathology: "x", pathologies: ["a", "", "b"] })).toEqual(["a", "b"]);
  });
});

describe("LMP calculator", () => {
  const lmp = new Date(2026, 0, 7); // 07-Jan-2026
  const on = new Date(2026, 3, 14); // 14-Apr-2026 — 97 days later

  test("GA = completed weeks + days since LMP", () => {
    expect(gaFromLmp(lmp, on)).toEqual({ weeks: 13, days: 6 });
    expect(gaFromLmp(lmp, lmp)).toEqual({ weeks: 0, days: 0 });
    // Future LMP clamps to zero, never negative.
    expect(gaFromLmp(on, lmp)).toEqual({ weeks: 0, days: 0 });
  });

  test("EDD = LMP + 280 days (Naegele), formatted dd-Mon-yyyy", () => {
    const edd = eddFromLmp(lmp);
    expect(edd.getTime() - lmp.getTime()).toBe(280 * 86_400_000);
    expect(formatEdd(edd)).toBe("14-Oct-2026");
    expect(lmpSummary(lmp, on).edd).toBe("14-Oct-2026");
  });

  test("LMP input parsing accepts only real yyyy-mm-dd dates", () => {
    expect(parseLmpInput("2026-01-07")?.getTime()).toBe(lmp.getTime());
    expect(parseLmpInput("2026-02-30")).toBeNull(); // no 30 Feb
    expect(parseLmpInput("07-01-2026")).toBeNull();
    expect(parseLmpInput("")).toBeNull();
  });

  test("LMP fills the antenatal biometry tokens {gaw}/{gad}/{edd}", () => {
    let state = initialState("ob");
    const summary = lmpSummary(lmp, on);
    state = setOrganVar(state, "biometry", "gaw", String(summary.weeks));
    state = setOrganVar(state, "biometry", "gad", String(summary.days));
    state = setOrganVar(state, "biometry", "edd", summary.edd);
    const r = resolve(state, lookupAll, "t");
    const biometry = r.sections.find((s) => s.organ === "biometry")!;
    expect(biometry.text).toContain("13 weeks");
    expect(biometry.text).toContain("6 days");
    expect(biometry.text).toContain("14-Oct-2026");
    expect(biometry.text).not.toContain("{edd}"); // no stray tokens on a printed report
  });
});

describe("Print upgrades — A5, PROVISIONAL watermark, signature image", () => {
  const resolved = resolve(initialState("wa-female"), lookupAll, "t");

  test("A4 by default; A5 switches the @page size and scales the sheet", () => {
    const a4 = buildUsgReportHtml(SETTINGS, patient, resolved);
    expect(a4).toContain("@page { size: A4;");
    expect(a4).not.toContain("size: A5");

    const a5 = buildUsgReportHtml({ ...SETTINGS, usgPrintPaper: "a5" }, patient, resolved);
    expect(a5).toContain("@page { size: A5;");
    expect(a5).toContain("max-width: 132mm");
  });

  test("drafts print watermarked + tagged; finalized prints clean", () => {
    const draft = buildUsgReportHtml(SETTINGS, { ...patient, provisional: true }, resolved);
    expect(draft).toContain('class="watermark"');
    expect(draft).toContain("PROVISIONAL");
    expect(draft).toContain("Provisional — not the final record");

    const final = buildUsgReportHtml(SETTINGS, patient, resolved);
    expect(final).not.toContain('class="watermark"');
    expect(final).not.toContain("Provisional");
  });

  test("classic style keeps a black watermark variant", () => {
    const draft = buildUsgReportHtml(
      { ...SETTINGS, usgPrintStyle: "classic" },
      { ...patient, provisional: true },
      resolved,
    );
    expect(draft).toContain("rgba(0, 0, 0, 0.08)");
  });

  test("scanned signature image replaces the empty signature rule", () => {
    const withSig = buildUsgReportHtml(
      { ...SETTINGS, usgSignatureUrl: "https://x/sig.png" },
      patient,
      resolved,
    );
    expect(withSig).toContain('class="sig-img"');
    expect(withSig).toContain('src="https://x/sig.png"');
    expect(withSig).not.toContain('<div class="line"></div>');

    const without = buildUsgReportHtml(SETTINGS, patient, resolved);
    expect(without).toContain('<div class="line"></div>');
    expect(without).not.toContain('class="sig-img"');
  });

  test("A5 + compact + watermark compose safely (all three layers)", () => {
    const html = buildUsgReportHtml(
      { ...SETTINGS, usgPrintPaper: "a5", usgPrintCompact: true },
      { ...patient, provisional: true, serial: "USG-0031" },
      resolved,
    );
    expect(html).toContain("size: A5");
    expect(html).toContain("font-size: 9.5pt"); // compact layer
    expect(html).toContain('class="watermark"');
    expect(html).toContain("USG-0031");
  });
});

describe("Scan date helpers", () => {
  test("parseScanDate accepts yyyy-mm-dd at local noon; junk → null", () => {
    const d = parseScanDate("2026-08-15");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getHours()).toBe(12); // timezone-safe noon
    expect(parseScanDate("15-08-2026")).toBeNull();
    expect(parseScanDate(undefined)).toBeNull();
    expect(parseScanDate(42)).toBeNull();
  });

  test("toScanDateInput round-trips and defaults to today", () => {
    expect(toScanDateInput(new Date(2026, 7, 5))).toBe("2026-08-05");
    expect(toScanDateInput(null)).toBe(toScanDateInput(new Date()));
  });
});

describe("Backup & restore — one JSON file of the studio personalisation", () => {
  test("buildBackup picks only whitelisted fields; secrets and patient data excluded", () => {
    const backup = buildBackup(
      {
        appTitle: "CARE Studio",
        hospitalName: "CARE Diagnostics",
        usgDoctorName: "Dr. Sugandha",
        usgPrintPaper: "a5",
        usgPrintCompact: true,
        pinHash: "SECRET",
        careApiKey: "SECRET",
        orthancPassword: "SECRET",
        patientName: "should-not-appear",
      },
      [{ organKey: "liver", label: "My Finding", findingText: "x", impressionLines: ["l"], titleFragment: "", sortOrder: 5 }],
    );
    expect(backup.format).toBe("usg-studio-backup");
    expect(backup.settings.usgDoctorName).toBe("Dr. Sugandha");
    expect(backup.settings.usgPrintPaper).toBe("a5");
    expect(JSON.stringify(backup)).not.toContain("SECRET");
    expect(JSON.stringify(backup)).not.toContain("patientName");
    expect(backup.customPathologies).toHaveLength(1);
    expect(BACKUP_SETTINGS_KEYS).not.toContain("pinHash");
  });

  test("parseBackup validates the format marker and tolerates junk entries", () => {
    const backup = buildBackup({ hospitalName: "H" }, []);
    const parsed = parseBackup(JSON.parse(JSON.stringify(backup)));
    expect(parsed.settings.hospitalName).toBe("H");

    expect(() => parseBackup({ format: "something-else" })).toThrow(/backup file/i);
    expect(() => parseBackup(null)).toThrow();
    expect(() => parseBackup({ format: "usg-studio-backup", version: 2 })).toThrow(/version/i);

    // Junk custom entries are skipped, not fatal.
    const withJunk = parseBackup({
      format: "usg-studio-backup",
      version: 1,
      settings: { hospitalName: "H", pinHash: "dropped" },
      customPathologies: [
        { organKey: "liver", label: "Good", findingText: "f", impressionLines: ["a"], titleFragment: "t", sortOrder: 1 },
        null,
        { organKey: "liver" }, // no label → skipped
        "junk",
      ],
    });
    expect(withJunk.customPathologies).toHaveLength(1);
    expect((parsed.settings as Record<string, unknown>).pinHash).toBeUndefined();
    expect("pinHash" in parsed.settings).toBe(false);
  });

  test("full round-trip: build → serialise → parse → identical settings + customs", () => {
    const original = buildBackup(
      { appTitle: "T", usgPrintStyle: "classic", usgPrintPaper: "a5", usgSignatureUrl: "http://s/s.png" },
      [
        {
          organKey: "gb",
          label: "Wall Thickening",
          findingText: "GB wall is {mm} mm thick.",
          impressionLines: ["Cholecystitis."],
          titleFragment: "cholecystitis",
          sortOrder: 7,
        },
      ],
    );
    const roundTripped = parseBackup(JSON.parse(JSON.stringify(original)));
    expect(roundTripped.settings).toEqual(original.settings);
    expect(roundTripped.customPathologies).toEqual(original.customPathologies);
  });
});
