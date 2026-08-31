/**
 * v6 CARE bridge — pure-function tests: study guessing, modality filter,
 * age/sex split, SR parsing + slot mapping, Form F defaults/prefill/completeness.
 */
import { describe, expect, test } from "vitest";
import { guessStudyKey, isObStudyKey, orderSex, testSuggestsChild } from "../src/lib/usg/orderStudy";
import { isUltrasoundModality, splitAgeSex } from "../src/lib/usg/careClient";
import { mapSrToStudy, normaliseUnit, parseDicomSr, srIsObstetric } from "../src/lib/usg/srExtract";
import {
  applyComposerToFormF,
  buildFormFPrintHtml,
  defaultFormF,
  evaluateFormFCompleteness,
  prefillFormFFromOrder,
} from "../src/lib/usg/formf";
import type { UsgComposerState } from "../src/lib/usg/types";

// ── orderStudy: bill test name → studio study ───────────────────────────────

describe("guessStudyKey — bill-desk test names route to the right study", () => {
  test("obstetrics first (the Form F duty)", () => {
    expect(guessStudyKey("USG Pregnancy 2nd Trimester", "F")).toBe("ob");
    expect(guessStudyKey("Anomaly Scan", "F")).toBe("ob");
    expect(guessStudyKey("Growth scan / BPP", "F")).toBe("ob");
    expect(guessStudyKey("Obstetric Doppler", "F")).toBe("ob");
    expect(guessStudyKey("USG Early Pregnancy / Dating", "F")).toBe("ep");
    expect(guessStudyKey("TVS follicular study", "F")).toBe("tvs");
  });

  test("sex-aware abdomen routing", () => {
    expect(guessStudyKey("USG Whole Abdomen", "F")).toBe("wa-female");
    expect(guessStudyKey("USG Whole Abdomen", "M")).toBe("wa-male");
    expect(guessStudyKey("USG Lower Abdomen / Pelvis", "F")).toBe("la-female");
    expect(guessStudyKey("USG Pelvis", "M")).toBe("la-male");
    expect(guessStudyKey("USG Upper Abdomen", "F")).toBe("ua");
  });

  test("organ studies", () => {
    expect(guessStudyKey("USG KUB", "F")).toBe("kub");
    expect(guessStudyKey("USG Thyroid / Neck", "F")).toBe("thyroid");
    expect(guessStudyKey("Sonomammography both breasts", "F")).toBe("breast");
    expect(guessStudyKey("USG Scrotum", "M")).toBe("scrotum");
    expect(guessStudyKey("TRUS Prostate", "M")).toBe("trus");
    expect(guessStudyKey("2D Echo", "M")).toBe("echo");
    expect(guessStudyKey("Doppler both lower limbs", "M")).toBe("doppler-lower");
    expect(guessStudyKey("USG Cranium (infant)", "F")).toBe("cranium");
  });

  test("child routing and fallback", () => {
    expect(guessStudyKey("USG Abdomen", "F", true)).toBe("wa-child");
    expect(guessStudyKey("Paediatric abdomen screening", "M", true)).toBe("wa-child");
    expect(guessStudyKey("something unknown", "")).toBe("wa-female");
    expect(guessStudyKey("something unknown", "M")).toBe("wa-male");
  });

  test("ob study keys are the Form F families", () => {
    expect(isObStudyKey("ob")).toBe(true);
    expect(isObStudyKey("ep")).toBe(true);
    expect(isObStudyKey("wa-female")).toBe(false);
  });

  test("orderSex + child detection", () => {
    expect(orderSex("F")).toBe("F");
    expect(orderSex("male")).toBe("M");
    expect(orderSex(null)).toBe("F");
    expect(orderSex("F", true)).toBe("CHILD");
    expect(testSuggestsChild("USG abdomen child")).toBe(true);
    expect(testSuggestsChild("USG whole abdomen")).toBe(false);
  });
});

// ── careClient pure helpers ─────────────────────────────────────────────────

describe("careClient — ultrasound filter + age/sex split", () => {
  test("ultrasound modalities (ERP substring rule)", () => {
    expect(isUltrasoundModality("US")).toBe(true);
    expect(isUltrasoundModality("USG")).toBe(true);
    expect(isUltrasoundModality("Ultrasound")).toBe(true);
    expect(isUltrasoundModality("Doppler")).toBe(true);
    expect(isUltrasoundModality("OB US")).toBe(true);
    expect(isUltrasoundModality("MR")).toBe(false);
    expect(isUltrasoundModality("CT")).toBe(false);
    expect(isUltrasoundModality(null)).toBe(false);
    expect(isUltrasoundModality("")).toBe(false);
  });

  test("age strings like 54/F split", () => {
    expect(splitAgeSex("54/F")).toEqual({ age: "54", sex: "F" });
    expect(splitAgeSex("29/M")).toEqual({ age: "29", sex: "M" });
    expect(splitAgeSex("54")).toEqual({ age: "54", sex: "" });
    expect(splitAgeSex("")).toEqual({ age: "", sex: "" });
    expect(splitAgeSex("gravid 32")).toEqual({ age: "gravid 32", sex: "" });
  });
});

// ── SR extraction ───────────────────────────────────────────────────────────

/** Trimmed GE-style OB SR (ContentSequence, NUM items, code meanings). */
const OB_SR = {
  "00080018": { Value: ["1.2.840.113619.2.1.1"] },
  "0040A730": {
    Value: [
      {
        "0040A040": { Value: ["CONTAINER"] },
        "0040A043": { Value: [{ "00080104": { Value: ["Prenatal Ultrasound Study"] } }] },
        "0040A730": {
          Value: [
            {
              "0040A040": { Value: ["NUM"] },
              "0040A043": { Value: [{ "00080104": { Value: ["Biparietal Diameter"] } }] },
              "0040A300": { Value: [{ "0040A30A": { Value: [89] }, "004008EA": { Value: [{ "00080100": { Value: ["mm"] } }] } }] },
            },
            {
              "0040A040": { Value: ["NUM"] },
              "0040A043": { Value: [{ "00080104": { Value: ["Head Circumference"] } }] },
              "0040A300": { Value: [{ "0040A30A": { Value: [321] }, "004008EA": { Value: [{ "00080100": { Value: ["mm"] } }] } }] },
            },
            {
              "0040A040": { Value: ["NUM"] },
              "0040A043": { Value: [{ "00080104": { Value: ["Abdominal Circumference"] } }] },
              "0040A300": { Value: [{ "0040A30A": { Value: [30.1] }, "004008EA": { Value: [{ "00080100": { Value: ["cm"] } }] } }] },
            },
            {
              "0040A040": { Value: ["NUM"] },
              "0040A043": { Value: [{ "00080104": { Value: ["Femur Length"] } }] },
              "0040A300": { Value: [{ "0040A30A": { Value: [6.6] }, "004008EA": { Value: [{ "00080100": { Value: ["cm"] } }] } }] },
            },
            {
              "0040A040": { Value: ["NUM"] },
              "0040A043": { Value: [{ "00080104": { Value: ["Fetal Heart Rate"] } }] },
              "0040A300": { Value: [{ "0040A30A": { Value: [148] }, "004008EA": { Value: [{ "00080100": { Value: ["bpm"] } }] } }] },
            },
            {
              "0040A040": { Value: ["NUM"] },
              "0040A043": { Value: [{ "00080104": { Value: ["Cervix Length"] } }] },
              "0040A300": { Value: [{ "0040A30A": { Value: [3.4] }, "004008EA": { Value: [{ "00080100": { Value: ["cm"] } }] } }] },
            },
          ],
        },
      },
    ],
  },
};

describe("parseDicomSr — the ERP's ContentSequence walker", () => {
  test("pulls NUM measurements with names, values and units", () => {
    const sr = parseDicomSr(JSON.stringify(OB_SR));
    expect(sr.length).toBeGreaterThanOrEqual(6);
    const bpd = sr.find((m) => /biparietal/i.test(m.conceptName));
    expect(bpd?.value).toBe("89");
    expect(bpd?.unit).toBe("mm");
    expect(srIsObstetric(sr)).toBe(true);
  });

  test("malformed JSON yields nothing (never throws)", () => {
    expect(parseDicomSr("{not json")).toEqual([]);
    expect(parseDicomSr("null")).toEqual([]);
  });
});

describe("mapSrToStudy — machine SR fills the composer's slots", () => {
  const sr = parseDicomSr(JSON.stringify(OB_SR));

  test("OB biometry: mm values land, cm values convert to mm", () => {
    const { vars, matchedCount, extras } = mapSrToStudy(sr, "ob");
    expect(vars.biometry).toBeDefined();
    expect(vars.biometry.bpd).toBe("89");
    expect(vars.biometry.hc).toBe("321");
    expect(vars.biometry.ac).toBe("301"); // 30.1 cm → 301 mm
    expect(vars.biometry.fl).toBe("66"); // 6.6 cm → 66 mm
    expect(vars.biometry.fhr).toBe("148");
    expect(matchedCount).toBeGreaterThanOrEqual(5);
    // Cervix length has no slot in the OB study → surfaced, never lost
    expect(extras["Cervix Length"]).toBe("3.4 cm");
  });

  test("slots only fill when the study carries that organ", () => {
    const { vars } = mapSrToStudy(sr, "kub");
    expect(vars.biometry).toBeUndefined(); // KUB has no biometry organ
  });

  test("renal lengths route to kidney slots in cm", () => {
    const renalSr = [
      { conceptName: "Right kidney length", value: "10.8", unit: "cm" },
      { conceptName: "Left kidney", value: "98", unit: "mm" },
    ];
    const { vars } = mapSrToStudy(renalSr, "kub");
    expect(vars.kidney_rt?.span).toBe("10.8");
    expect(vars.kidney_lt?.span).toBe("9.8"); // 98 mm → 9.8 cm
  });
});

describe("normaliseUnit — machine units to slot units", () => {
  test("cm→mm, mm→cm, kg→g, ambiguous heuristics", () => {
    expect(normaliseUnit("8.9", "cm", "mm")).toBe("89");
    expect(normaliseUnit("89", "mm", "mm")).toBe("89");
    expect(normaliseUnit("98", "mm", "cm")).toBe("9.8");
    expect(normaliseUnit("2.4", "kg", "g")).toBe("2400");
    expect(normaliseUnit("9", "", "mm")).toBe("90"); // 9 with no unit is cm in OB context
    expect(normaliseUnit("12", "", "cm")).toBe("12"); // 12 with no unit is cm
    expect(normaliseUnit("abc", "cm", "mm")).toBe("abc");
  });
});

// ── Form F ──────────────────────────────────────────────────────────────────

const S = {
  pcpndtCentreName: "CARE DIAGNOSTICS\nSubhash Chowk, Deoghar",
  pcpndtRegistrationNo: "34/2020",
  pcpndtPlace: "DEOGHAR",
  usgDoctorName: "Dr. Sugandha Priyadarshini",
  usgDoctorQual: "MBBS, DMRD",
  usgDoctorRegNo: "MCI/27962",
};

describe("Form F defaults + bill-desk prefill", () => {
  test("fixed clinic details arrive pre-filled", () => {
    const f = defaultFormF(S);
    expect(f.centreName).toContain("CARE DIAGNOSTICS");
    expect(f.registrationNo).toBe("34/2020");
    expect(f.doctorName).toBe("Dr. Sugandha Priyadarshini");
    expect(f.doctorRegNo).toBe("MCI/27962");
    expect(f.place).toBe("DEOGHAR");
    expect(f.procedure).toContain("ULTRASONOGRAPHY");
    expect(f.ultrasoundResult).toBe("normal");
    expect(f.invasiveProcedure).toBe("notdone");
  });

  test("order demographics prefill without touching fixed details", () => {
    const base = defaultFormF(S);
    const f = prefillFormFFromOrder(base, {
      accessionNumber: "CARE-24101",
      patientName: "Rina Devi",
      patientAge: "26",
      patientPhone: "9876543210",
      patientAddress: "Jasidih, Deoghar",
      billNumber: "BILL-77",
      referringDoctor: "Dr. Kumar",
      testName: "USG Pregnancy 3rd Trimester",
      studyDate: new Date("2026-09-01T04:30:00Z"),
    });
    expect(f.patientName).toBe("Rina Devi");
    expect(f.age).toBe("26");
    expect(f.address).toBe("Jasidih, Deoghar");
    expect(f.mobile).toBe("9876543210");
    expect(f.referredBy).toBe("Doctor");
    expect(f.referredByName).toBe("Dr. Kumar");
    expect(f.procedurePurpose).toBe("USG Pregnancy 3rd Trimester");
    expect(f.procedureDate).toBe("2026-09-01");
    expect(f.centreName).toBe(base.centreName); // fixed untouched
  });
});

describe("Form F completeness — the ERP's four predicates", () => {
  test("all four present → complete", () => {
    expect(
      evaluateFormFCompleteness({
        idCardVerified: true,
        husbandFatherName: "Sohan Kumar",
        address: "Jasidih",
        consentDate: "",
        procedureDate: "2026-09-01",
      }),
    ).toEqual({ complete: true, missing: [] });
  });

  test("each missing predicate named (ERP wording)", () => {
    const { complete, missing } = evaluateFormFCompleteness({
      idCardVerified: false,
      husbandFatherName: "",
      address: " ",
      consentDate: "",
      procedureDate: "",
    });
    expect(complete).toBe(false);
    expect(missing).toContain("ID Card must be verified.");
    expect(missing).toContain("Husband/Father Name is required.");
    expect(missing).toContain("Address is required.");
    expect(missing).toContain("Consent Date or Procedure Date is required.");
  });
});

describe("Form F ← composer state lift (GA + result)", () => {
  const state = {
    studyKey: "ob",
    impressionOverride: null,
    organs: [
      { organ: "fetus", pathology: null, pathologies: [], custom: false, text: "", vars: {} },
      { organ: "biometry", pathology: null, pathologies: [], custom: false, text: "", vars: { gaw: "28", gad: "5" } },
      { organ: "placenta", pathology: null, pathologies: [], custom: false, text: "", vars: {} },
    ],
  } as unknown as UsgComposerState;

  test("GA lifts; pathology suggests abnormal", () => {
    const f = applyComposerToFormF(defaultFormF(S), state);
    expect(f.gestationalAgeWeeks).toBe("28");
    expect(f.gestationalAgeDays).toBe("5");
    expect(f.ultrasoundResult).toBe("normal");
    const withPathology = {
      ...state,
      organs: state.organs.map((o) => (o.organ === "placenta" ? { ...o, pathologies: ["placenta-previa"] } : o)),
    } as UsgComposerState;
    const f2 = applyComposerToFormF(defaultFormF(S), withPathology);
    expect(f2.ultrasoundResult).toBe("abnormal");
  });
});

describe("Form F print HTML — statutory sheet", () => {
  test("renders the fixed details and escaped demographics", () => {
    const f = defaultFormF(S);
    f.patientName = 'Rina <Devi>';
    f.husbandFatherName = "Sohan";
    f.address = "Jasidih";
    const html = buildFormFPrintHtml(f);
    expect(html).toContain("FORM F");
    expect(html).toContain("FORM FOR MAINTENANCE OF RECORD IN RESPECT OF PREGNANT WOMAN");
    expect(html).toContain("CARE DIAGNOSTICS, Subhash Chowk, Deoghar");
    expect(html).toContain("34/2020");
    expect(html).toContain("Dr. Sugandha Priyadarshini");
    expect(html).toContain("DECLARATION OF PREGNANT WOMAN");
    expect(html).toContain("DECLARATION OF DOCTOR");
    // HTML-escaped so the statutory sheet can never be injected into
    expect(html).toContain("Rina &lt;Devi&gt;");
    expect(html).not.toContain("Rina <Devi>");
    expect(html).toContain("@page");
  });
});
