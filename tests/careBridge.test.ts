/**
 * Tests for the 6 new USG Studio modules ported from CARE ERP.
 */
import { describe, expect, it } from "vitest";
import {
  scoreConfidence,
  buildReviewSet,
  toggleAccept,
  updateValue,
  acceptAll,
  rejectAll,
  getAcceptedVars,
  type MeasurementReviewSet,
} from "@/lib/usg/measurementReview";
import {
  isCriticalPathology,
  getCriticalSeverity,
  scanForCriticalFindings,
  severityColour,
  severityIcon,
  criticalAuditPayload,
} from "@/lib/usg/criticalFindings";
import {
  buildPregnancyTimeline,
  formatGa,
  type PregnancyTimeline,
} from "@/lib/usg/pregnancyTimeline";
import {
  getSuggestionsForPathology,
  getSuggestionsForPathologies,
  suggestionIcon,
  suggestionColour,
} from "@/lib/usg/organSuggestions";
import {
  runQualityCheck,
  acknowledgeItem,
} from "@/lib/usg/qualityCheck";
import {
  checkEligibility,
  buildDicomSrDocument,
} from "@/lib/usg/pacsReturn";

// ── Measurement Review ────────────────────────────────────────────────────

describe("measurementReview", () => {
  it("scores confidence: high when numeric + unit + concept", () => {
    expect(scoreConfidence("Biparietal Diameter", "85", "mm")).toBe("high");
  });

  it("scores confidence: medium when numeric + concept but no unit", () => {
    expect(scoreConfidence("Biparietal Diameter", "85", "")).toBe("medium");
  });

  it("scores confidence: low when non-numeric", () => {
    expect(scoreConfidence("Biparietal Diameter", "N/A", "mm")).toBe("low");
  });

  it("scores confidence: low when no concept name", () => {
    expect(scoreConfidence("", "85", "mm")).toBe("low");
  });

  it("builds a review set from SR extraction result", () => {
    const srResult = {
      vars: {
        ob_bpd: { bpd: "85" },
        ob_fl: { fl: "62" },
      },
      extras: { "Unknown Measurement": "12 mm" },
      matchedCount: 2,
    };
    const srMeasurements = [
      { conceptName: "Biparietal Diameter", value: "85", unit: "mm" },
      { conceptName: "Femur Length", value: "62", unit: "mm" },
    ];
    const set = buildReviewSet(srResult, srMeasurements);
    expect(set.totalMatched).toBe(3); // 2 matched + 1 unmapped
    expect(set.hasLowConfidence).toBe(true); // unmapped is low
    expect(set.measurements).toHaveLength(3);
  });

  it("toggles acceptance of one measurement", () => {
    const set: MeasurementReviewSet = {
      measurements: [
        { organ: "ob_bpd", varKey: "bpd", value: "85", unit: "mm", confidence: "high", source: "dicom_sr", accepted: true },
        { organ: "ob_fl", varKey: "fl", value: "62", unit: "mm", confidence: "high", source: "dicom_sr", accepted: true },
      ],
      totalMatched: 2,
      totalAccepted: 2,
      hasLowConfidence: false,
    };
    const toggled = toggleAccept(set, 0);
    expect(toggled.measurements[0]!.accepted).toBe(false);
    expect(toggled.totalAccepted).toBe(1);
  });

  it("updates a value manually and sets confidence to high", () => {
    const set: MeasurementReviewSet = {
      measurements: [
        { organ: "ob_bpd", varKey: "bpd", value: "85", unit: "mm", confidence: "low", source: "dicom_sr", accepted: false },
      ],
      totalMatched: 1,
      totalAccepted: 0,
      hasLowConfidence: true,
    };
    const updated = updateValue(set, 0, "86");
    expect(updated.measurements[0]!.value).toBe("86");
    expect(updated.measurements[0]!.confidence).toBe("high");
    expect(updated.measurements[0]!.source).toBe("manual");
    expect(updated.measurements[0]!.accepted).toBe(true);
  });

  it("accepts all measurements", () => {
    const set: MeasurementReviewSet = {
      measurements: [
        { organ: "ob_bpd", varKey: "bpd", value: "85", unit: "mm", confidence: "low", source: "dicom_sr", accepted: false },
      ],
      totalMatched: 1,
      totalAccepted: 0,
      hasLowConfidence: true,
    };
    const accepted = acceptAll(set);
    expect(accepted.totalAccepted).toBe(1);
    expect(accepted.hasLowConfidence).toBe(false);
  });

  it("rejects all measurements", () => {
    const set: MeasurementReviewSet = {
      measurements: [
        { organ: "ob_bpd", varKey: "bpd", value: "85", unit: "mm", confidence: "high", source: "dicom_sr", accepted: true },
      ],
      totalMatched: 1,
      totalAccepted: 1,
      hasLowConfidence: false,
    };
    const rejected = rejectAll(set);
    expect(rejected.totalAccepted).toBe(0);
  });

  it("extracts accepted vars as a composer-compatible map", () => {
    const set: MeasurementReviewSet = {
      measurements: [
        { organ: "ob_bpd", varKey: "bpd", value: "85", unit: "mm", confidence: "high", source: "dicom_sr", accepted: true },
        { organ: "ob_fl", varKey: "fl", value: "62", unit: "mm", confidence: "high", source: "dicom_sr", accepted: false },
        { organ: "_unmapped", varKey: "unknown", value: "12", unit: "mm", confidence: "low", source: "dicom_sr", accepted: true },
      ],
      totalMatched: 3,
      totalAccepted: 2,
      hasLowConfidence: true,
    };
    const vars = getAcceptedVars(set);
    expect(vars["ob_bpd"]).toEqual({ bpd: "85" });
    expect(vars["ob_fl"]).toBeUndefined(); // not accepted
    expect(vars["_unmapped"]).toBeUndefined(); // unmapped excluded
  });
});

// ── Critical Findings ─────────────────────────────────────────────────────

describe("criticalFindings", () => {
  it("identifies a critical pathology", () => {
    expect(isCriticalPathology("ob-ectopic")).toBe(true);
    expect(isCriticalPathology("liver-fatty-g1")).toBe(false);
  });

  it("returns severity for a critical pathology", () => {
    expect(getCriticalSeverity("ob-ectopic")).toBe("critical");
    expect(getCriticalSeverity("ob-iugr")).toBe("urgent");
    expect(getCriticalSeverity("liver-fatty-g1")).toBeNull();
  });

  it("scans selected pathologies for critical findings", () => {
    const selected = [
      { key: "liver-fatty-g1", label: "Fatty Liver Gr I", organ: "liver" },
      { key: "ob-ectopic", label: "Ectopic Pregnancy", organ: "ob_uterus" },
    ];
    const alerts = scanForCriticalFindings(selected);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.pathologyKey).toBe("ob-ectopic");
    expect(alerts[0]!.severity).toBe("critical");
    expect(alerts[0]!.message).toContain("Ectopic");
    expect(alerts[0]!.recommendation).toContain("Notify");
  });

  it("returns empty array when no critical pathologies selected", () => {
    const selected = [
      { key: "liver-fatty-g1", label: "Fatty Liver Gr I", organ: "liver" },
    ];
    const alerts = scanForCriticalFindings(selected);
    expect(alerts).toHaveLength(0);
  });

  it("provides severity colours and icons", () => {
    expect(severityColour("critical")).toContain("red");
    expect(severityColour("urgent")).toContain("orange");
    expect(severityColour("significant")).toContain("amber");
    expect(severityIcon("critical")).toBe("AlertOctagon");
    expect(severityIcon("urgent")).toBe("AlertTriangle");
  });

  it("builds an audit payload for critical findings", () => {
    const alerts = [
      { pathologyKey: "ob-ectopic", pathologyLabel: "Ectopic", organ: "ob_uterus", severity: "critical" as const, message: "test", recommendation: "test rec" },
    ];
    const payload = criticalAuditPayload(alerts);
    expect(payload.action).toBe("critical_finding_detected");
    expect(payload.details.count).toBe(1);
  });
});

// ── Pregnancy Timeline ─────────────────────────────────────────────────────

describe("pregnancyTimeline", () => {
  it("builds a timeline from obstetric reports", () => {
    const reports = [
      {
        id: 1,
        scanDate: "2026-01-15",
        stateJson: JSON.stringify({
          studyKey: "ob-anomaly",
          organs: [
            { organ: "ob_ga", vars: { weeks: "20", days: "0" }, text: "GA: 20 weeks 0 days" },
            { organ: "ob_efw", vars: { efw: "350" }, text: "EFW: 350 g" },
          ],
        }),
        studyKey: "ob-anomaly",
        status: "finalized",
      },
      {
        id: 2,
        scanDate: "2026-03-15",
        stateJson: JSON.stringify({
          studyKey: "ob-growth",
          organs: [
            { organ: "ob_ga", vars: { weeks: "28", days: "0" }, text: "GA: 28 weeks 0 days" },
            { organ: "ob_efw", vars: { efw: "1200" }, text: "EFW: 1200 g" },
          ],
        }),
        studyKey: "ob-growth",
        status: "finalized",
      },
    ];

    const timeline = buildPregnancyTimeline(reports);
    expect(timeline.totalVisits).toBe(2);
    expect(timeline.earliestGa).toBe(20);
    expect(timeline.latestGa).toBe(28);
    expect(timeline.gaRangeDisplay).toBe("20 wk → 28 wk");
    expect(timeline.points[0]!.efw).toBe(350);
    expect(timeline.points[1]!.efw).toBe(1200);
  });

  it("returns empty timeline for non-obstetric reports", () => {
    const reports = [
      {
        id: 1,
        scanDate: "2026-01-15",
        stateJson: JSON.stringify({
          studyKey: "wa-female",
          organs: [{ organ: "liver", vars: {}, text: "Liver normal" }],
        }),
        studyKey: "wa-female",
        status: "finalized",
      },
    ];
    const timeline = buildPregnancyTimeline(reports);
    expect(timeline.totalVisits).toBe(0);
    expect(timeline.earliestGa).toBeNull();
  });

  it("formats GA correctly", () => {
    expect(formatGa(28, 5)).toBe("28 wk 05 days");
    expect(formatGa(28, 0)).toBe("28 wk 00 days");
    expect(formatGa(null, null)).toBe("—");
  });

  it("detects IUGR risk when EFW is below threshold", () => {
    const reports = [
      {
        id: 1,
        scanDate: "2026-01-15",
        stateJson: JSON.stringify({
          studyKey: "ob-growth",
          organs: [
            { organ: "ob_ga", vars: { weeks: "32", days: "0" }, text: "GA: 32 weeks" },
            { organ: "ob_efw", vars: { efw: "1200" }, text: "EFW: 1200 g" }, // below 10th percentile for 32wk (~1650g)
          ],
        }),
        studyKey: "ob-growth",
        status: "finalized",
      },
    ];
    const timeline = buildPregnancyTimeline(reports);
    expect(timeline.hasIugrRisk).toBe(true);
  });

  it("detects macrosomia risk when EFW >= 4000g", () => {
    const reports = [
      {
        id: 1,
        scanDate: "2026-01-15",
        stateJson: JSON.stringify({
          studyKey: "ob-growth",
          organs: [
            { organ: "ob_ga", vars: { weeks: "38", days: "0" }, text: "GA: 38 weeks" },
            { organ: "ob_efw", vars: { efw: "4200" }, text: "EFW: 4200 g" },
          ],
        }),
        studyKey: "ob-growth",
        status: "finalized",
      },
    ];
    const timeline = buildPregnancyTimeline(reports);
    expect(timeline.hasMacrosomiaRisk).toBe(true);
  });
});

// ── Organ Suggestions ─────────────────────────────────────────────────────

describe("organSuggestions", () => {
  it("returns suggestions for a known pathology", () => {
    const suggestions = getSuggestionsForPathology("gb_cholelithiasis");
    expect(suggestions.length).toBeGreaterThanOrEqual(2);
    expect(suggestions.some((s) => s.kind === "measure")).toBe(true);
    expect(suggestions.some((s) => s.kind === "check")).toBe(true);
  });

  it("returns empty array for unknown pathology", () => {
    const suggestions = getSuggestionsForPathology("nonexistent-pathology");
    expect(suggestions).toEqual([]);
  });

  it("deduplicates suggestions for multiple pathologies", () => {
    const suggestions = getSuggestionsForPathologies(["gb_cholelithiasis", "gb-sludge"]);
    const texts = suggestions.map((s) => s.text);
    const unique = new Set(texts);
    expect(unique.size).toBe(texts.length);
  });

  it("provides icons and colours for each suggestion kind", () => {
    expect(suggestionIcon("measure")).toBe("Ruler");
    expect(suggestionIcon("check")).toBe("Stethoscope");
    expect(suggestionIcon("recommend")).toBe("ClipboardList");
    expect(suggestionIcon("compare")).toBe("GitCompare");

    expect(suggestionColour("measure")).toContain("sky");
    expect(suggestionColour("recommend")).toContain("violet");
  });

  it("returns emergency suggestion for testicular torsion", () => {
    const suggestions = getSuggestionsForPathology("testis-torsion-rt");
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]!.kind).toBe("recommend");
    expect(suggestions[0]!.text).toContain("EMERGENCY");
  });
});

// ── Quality Check ─────────────────────────────────────────────────────────

describe("qualityCheck", () => {
  it("blocks finalize when impression is empty", () => {
    const state = {
      studyKey: "wa-female",
      organs: [{ organ: "liver", pathology: null, custom: false, text: "Normal", vars: {} }],
      impressionOverride: null,
    };
    const resolved = {
      study: { key: "wa-female", label: "WA", title: "USG", technique: "USG", organs: [], allNormalImpression: [] },
      title: "USG",
      sections: [{ organ: "liver", label: "LIVER", text: "Normal" }],
      impression: [],
      suggestions: [],
      technique: "USG",
    };
    const result = runQualityCheck(state, resolved);
    expect(result.blockers).toBeGreaterThan(0);
    expect(result.canFinalize).toBe(false);
  });

  it("allows finalize when impression is present", () => {
    const state = {
      studyKey: "wa-female",
      organs: [{ organ: "liver", pathology: null, custom: false, text: "Normal", vars: {} }],
      impressionOverride: null,
    };
    const resolved = {
      study: { key: "wa-female", label: "WA", title: "USG", technique: "USG", organs: [], allNormalImpression: [] },
      title: "USG",
      sections: [{ organ: "liver", label: "LIVER", text: "Normal" }],
      impression: ["Normal study."],
      suggestions: [],
      technique: "USG",
    };
    const result = runQualityCheck(state, resolved);
    expect(result.canFinalize).toBe(true);
  });

  it("acknowledges a warning item", () => {
    const result = {
      items: [
        { kind: "missing_technique" as const, severity: "warning" as const, message: "No technique", acknowledged: false },
      ],
      blockers: 0,
      warnings: 1,
      canFinalize: true,
    };
    const acked = acknowledgeItem(result, 0);
    expect(acked.items[0]!.acknowledged).toBe(true);
    expect(acked.warnings).toBe(0);
  });
});

// ── PACS Return ───────────────────────────────────────────────────────────

describe("pacsReturn", () => {
  it("checks eligibility: all conditions met", () => {
    const eligibility = checkEligibility({
      status: "finalized",
      studyInstanceUid: "1.2.840.113619.2.55.3.604688119.971.202609030815001",
      patientName: "John Doe",
      pcpndtCompliant: true,
    });
    expect(eligibility.eligible).toBe(true);
    expect(eligibility.reasons).toHaveLength(0);
  });

  it("checks eligibility: not finalized", () => {
    const eligibility = checkEligibility({
      status: "draft",
      studyInstanceUid: "1.2.840.113619.2.55.3",
      patientName: "John Doe",
      pcpndtCompliant: true,
    });
    expect(eligibility.eligible).toBe(false);
    expect(eligibility.reasons).toContain("Report is not finalized");
  });

  it("checks eligibility: no StudyInstanceUID", () => {
    const eligibility = checkEligibility({
      status: "finalized",
      studyInstanceUid: null,
      patientName: "John Doe",
      pcpndtCompliant: true,
    });
    expect(eligibility.eligible).toBe(false);
    expect(eligibility.reasons).toContain("No StudyInstanceUID — report is not linked to a PACS study");
  });

  it("checks eligibility: empty patient name", () => {
    const eligibility = checkEligibility({
      status: "finalized",
      studyInstanceUid: "1.2.840.113619",
      patientName: "",
      pcpndtCompliant: true,
    });
    expect(eligibility.eligible).toBe(false);
    expect(eligibility.reasons).toContain("Patient name is empty");
  });

  it("builds a DICOM SR document with correct fields", () => {
    const payload = {
      studyInstanceUid: "1.2.840.113619.2.55.3",
      accessionNumber: "ACC123",
      patientName: "Doe^John",
      patientId: "P001",
      patientDob: "19900101",
      patientSex: "M",
      reportText: "Findings text",
      findings: "Liver normal",
      impression: "Normal study",
      studyDate: "2026-09-03",
      studyDescription: "USG Whole Abdomen",
      reportId: 42,
      reportSerial: "USG-0042",
    };
    const doc = buildDicomSrDocument(payload);
    // Patient fields
    expect((doc["00100010"] as { Value: unknown[] }).Value[0]).toEqual({ Alphabetic: "Doe^John" });
    expect((doc["00100020"] as { Value: string[] }).Value[0]).toBe("P001");
    // Study fields
    expect((doc["0020000D"] as { Value: string[] }).Value[0]).toBe("1.2.840.113619.2.55.3");
    expect((doc["00080050"] as { Value: string[] }).Value[0]).toBe("ACC123");
    // SR content
    expect(doc["0040A040"]).toBeDefined();
    expect(doc["0040A730"]).toBeDefined();
  });
});
