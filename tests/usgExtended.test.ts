/**
 * USG extended studies tests — the 14 new study types (KUB, thyroid, breast,
 * scrotum, TVS, TRUS, echo, limb & carotid Doppler, chest, cranium, orbit,
 * swelling) plus the print engine v2 (measurement tables, classic style,
 * compact density, referral line, serial).
 */
import { describe, expect, test } from "vitest";
import { initialState, getStudy, USG_STUDIES } from "@/lib/usg/studies";
import { USG_PATHOLOGIES, USG_PATHOLOGIES_ALL } from "@/lib/usg/pathologies";
import { USG_PATHOLOGIES_EXTRA } from "@/lib/usg/pathologies-extra";
import { ORGAN_SIDE } from "@/lib/usg/composer";
import {
  applyPathology,
  makeLookup,
  pathologiesForOrgan,
  resolve,
  setOrganVar,
  substitute,
  switchStudy,
} from "@/lib/usg/composer";
import { buildUsgReportHtml } from "@/lib/usg/print";

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
};

const patient = { name: "Test Patient", age: "40", sex: "F", referredBy: "Dr. X", date: "31-Aug-26" };

/** Fresh state for a study with one pathology applied. */
function withPathology(studyKey: string, organ: string, pathology: string) {
  return applyPathology(initialState(studyKey), organ, pathology, lookupAll);
}

describe("Extended pathology catalog integrity", () => {
  test("no key collisions between part 1 and part 2 catalogs", () => {
    const keys = USG_PATHOLOGIES_ALL.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(USG_PATHOLOGIES_ALL.length).toBe(USG_PATHOLOGIES.length + USG_PATHOLOGIES_EXTRA.length);
  });

  test("every extra pathology's organ maps onto a real organ card (direct or side-shared)", () => {
    const allOrganKeys = new Set(USG_STUDIES.flatMap((s) => s.organs.map((o) => o.key)));
    // pathology organ key → organ keys it can land on (SIDE_SHARED in composer)
    const shared: Record<string, string[]> = {
      kidney: ["kidney_rt", "kidney_lt"],
      "thyroid-lobe": ["thyroid_rt", "thyroid_lt"],
      breast: ["breast_rt", "breast_lt"],
      testis: ["testis_rt", "testis_lt"],
      globe: ["globe_rt", "globe_lt"],
      carotid: ["carotid_rt", "carotid_lt"],
      pleura: ["pleura_rt", "pleura_lt"],
    };
    for (const p of USG_PATHOLOGIES_EXTRA) {
      const targets = shared[p.organ] ?? [p.organ];
      expect(targets.some((t) => allOrganKeys.has(t))).toBe(true);
    }
  });

  test("every extra pathology's impression and finding carry the same {tokens} as declared vars (minus side/site twins)", () => {
    for (const p of USG_PATHOLOGIES_EXTRA) {
      const declared = new Set((p.vars ?? []).map((v) => v.key));
      const used = new Set<string>();
      for (const m of (p.text + " " + p.impression.join(" ")).matchAll(/\{([a-zA-Z0-9_]+)\}/g)) {
        const t = m[1];
        used.add(t);
        used.add(t.charAt(0).toLowerCase() + t.slice(1)); // {Site} twin of {site}
      }
      for (const d of declared) expect(used.has(d)).toBe(true);
    }
  });
});

describe("KUB study", () => {
  test("normal resolve: measured kidneys, shared kidney/ureter library available", () => {
    const r = resolve(initialState("kub"), lookupAll, "technique");
    expect(r.title).toBe("USG KUB");
    expect(r.sections.find((s) => s.organ === "kidney_rt")!.text).toContain("___ cm");
    expect(r.impression).toEqual(["No significant abnormality detected in KUB region."]);
    // The kidney calculus chip from the abdomen library applies to KUB kidneys.
    const chips = pathologiesForOrgan(USG_PATHOLOGIES_ALL, "kidney_rt");
    expect(chips.some((c) => c.key === "kidney-calculus")).toBe(true);
    expect(pathologiesForOrgan(USG_PATHOLOGIES_ALL, "ureters").length).toBeGreaterThanOrEqual(3);
    expect(pathologiesForOrgan(USG_PATHOLOGIES_ALL, "ub").length).toBeGreaterThanOrEqual(3);
  });

  test("distal ureteric calculus swaps ONLY the ureters card and composes the impression", () => {
    const state = withPathology("kub", "ureters", "ureter-calculus-distal");
    const r = resolve(state, lookupAll, "t");
    expect(r.sections.find((s) => s.organ === "ureters")!.text).toContain("distal ureter");
    expect(r.sections.find((s) => s.organ === "kidney_rt")!.text).toContain("Right kidney measures ___ cm");
    expect(r.impression.join(" ")).toContain("ureteric calculus");
  });
});

describe("Thyroid study", () => {
  test("colloid cyst on the left lobe swaps only that lobe; the right lobe stays normal", () => {
    const state = withPathology("thyroid", "thyroid_lt", "thyroid-colloid-cyst");
    const r = resolve(state, lookupAll, "t");
    const lt = r.sections.find((s) => s.organ === "thyroid_lt")!;
    expect(lt.text).toContain("Left lobe is enlarged");
    expect(lt.text).toContain("starry sky appearence");
    expect(r.sections.find((s) => s.organ === "thyroid_rt")!.text).toContain("Right lobe measures ___ X ___ mm");
    expect(r.impression).toEqual(["Colloid cyst of left lobe of thyroid gland."]);
  });

  test("{side}/{Side} auto-substitute on the shared-lobe chips (kidney pattern)", () => {
    const state = applyPathology(initialState("thyroid"), "thyroid_rt", "thyroid-thyroiditis", lookupAll);
    const r = resolve(state, lookupAll, "t");
    expect(r.sections.find((s) => s.organ === "thyroid_rt")!.text).toContain("Right lobe is enlarged");
    expect(r.impression[0]).toContain("right lobe of thyroid");
  });

  test("the thyroid library is offered on BOTH lobe cards but not on isthmus", () => {
    const rt = pathologiesForOrgan(USG_PATHOLOGIES_ALL, "thyroid_rt");
    const lt = pathologiesForOrgan(USG_PATHOLOGIES_ALL, "thyroid_lt");
    const isthmus = pathologiesForOrgan(USG_PATHOLOGIES_ALL, "isthmus");
    expect(rt.some((p) => p.key === "thyroid-colloid-cyst")).toBe(true);
    expect(lt.some((p) => p.key === "thyroid-colloid-cyst")).toBe(true);
    expect(isthmus.some((p) => p.key === "thyroid-colloid-cyst")).toBe(false);
    expect(isthmus.some((p) => p.key === "thyroid-isthmus-bulky")).toBe(true);
  });
});

describe("Breast study", () => {
  test("carcinoma chip swaps one breast only, PSV substitutes into finding and impression", () => {
    let state = withPathology("breast", "breast_rt", "breast-carcinoma");
    state = setOrganVar(state, "breast_rt", "psv", "39.5");
    const r = resolve(state, lookupAll, "t");
    expect(r.sections.find((s) => s.organ === "breast_rt")!.text).toContain("PSV is high 39.5 cm/sec");
    expect(r.sections.find((s) => s.organ === "breast_lt")!.text).toContain("Fibro fatty tissue appears normal");
    expect(r.impression.join(" ")).toContain("39.5 cm/sec");
    expect(r.impression.join(" ")).toContain("Highly suspicious of malignancy");
    expect(r.suggestions).toContain("FNAC.");
  });
});

describe("Scrotum study", () => {
  test("epididymo-orchitis on left testis composes the side-substituted impression", () => {
    const state = withPathology("scrotum", "testis_lt", "testis-epididymo-orchitis");
    const r = resolve(state, lookupAll, "t");
    expect(r.sections.find((s) => s.organ === "testis_lt")!.text).toContain("Head, body and tail of epididymis");
    expect(r.impression).toEqual(["Left epididymo-orchitis ( ? Acute on chronic)."]);
    expect(r.sections.find((s) => s.organ === "testis_rt")!.text).toContain("normal blood flow pattern");
  });

  test("hydrocele lives on the sac card, not the testis cards", () => {
    const sac = pathologiesForOrgan(USG_PATHOLOGIES_ALL, "sac");
    expect(sac.some((p) => p.key === "sac-hydrocele-bilateral-mild")).toBe(true);
    const testis = pathologiesForOrgan(USG_PATHOLOGIES_ALL, "testis_rt");
    expect(testis.some((p) => p.key === "sac-hydrocele-bilateral-mild")).toBe(false);
  });
});

describe("TVS study", () => {
  test("inherits the gyn library: fibroid chip applies to the TVS uterus card", () => {
    const state = withPathology("tvs", "uterus", "uterus-fibroid-intramural");
    const r = resolve(state, lookupAll, "t");
    // The fibroid chip composes the study title the same way as whole abdomen.
    expect(r.title).toContain("TRANSVAGINAL SONOGRAPHY");
    expect(r.title).toContain("FIBROID");
    expect(r.impression.length).toBeGreaterThanOrEqual(1);
    expect(r.impression.join(" ")).toMatch(/fibroid/i);
  });

  test("nabothian cyst composes with measurement slots intact", () => {
    const state = withPathology("tvs", "uterus", "uterus-nabothian");
    const r = resolve(state, lookupAll, "t");
    expect(r.sections.find((s) => s.organ === "uterus")!.text).toContain("posterior lip of cervix");
    expect(r.impression.join(" ")).toContain("Nabothian cyst");
  });
});

describe("TRUS study", () => {
  test("measured prostatomegaly substitutes volume into the impression", () => {
    let state = withPathology("trus", "prostate", "prostate-trus-enlarged");
    state = setOrganVar(state, "prostate", "vol", "32.4");
    const r = resolve(state, lookupAll, "t");
    expect(r.sections.find((s) => s.organ === "prostate")!.text).toContain("32.4 gms");
    expect(r.impression[0]).toBe("Prostatomegaly ( 32.4 gms ).");
    // The prostate library from whole-abdomen studies is also available here.
    expect(pathologiesForOrgan(USG_PATHOLOGIES_ALL, "prostate").length).toBeGreaterThanOrEqual(6);
  });
});

describe("Echo study", () => {
  test("M-mode resolves as a measurement TABLE section; valves and findings as rows", () => {
    const r = resolve(initialState("echo"), lookupAll, "t");
    const mmode = r.sections.find((s) => s.organ === "echo-mmode")!;
    expect(mmode.kind).toBe("table");
    expect(mmode.text).toContain("LA ( Left Atrial Diameter )");
    expect(r.sections.find((s) => s.organ === "echo-valves")!.kind ?? "rows").toBe("rows");
  });

  test("print renders a real bordered measurement table with 10 M-mode rows and grey normal ranges", () => {
    const html = buildUsgReportHtml(SETTINGS, patient, resolve(initialState("echo"), lookupAll, "t"));
    expect(html).toContain('class="meas-block"');
    expect(html).toContain("<table class=\"meas\">");
    const rows = html.match(/<tr><th>/g) ?? [];
    expect(rows.length).toBeGreaterThanOrEqual(10);
    expect(html).toContain('class="norm"');
    expect(html).toContain("Normal 20 - 40 mm");
    // Non-table sections still render as organ rows.
    expect(html).toContain("2D ECHO PROFILES");
  });

  test("moderate MR replaces the valve card and composes the impression", () => {
    const state = withPathology("echo", "echo-valves", "echo-mr-mod");
    const r = resolve(state, lookupAll, "t");
    expect(r.sections.find((s) => s.organ === "echo-valves")!.text).toContain("moderate mitral regurgitation");
    expect(r.impression).toEqual(["Moderate mitral regurgitation."]);
    expect(r.sections.find((s) => s.organ === "echo-mmode")!.text).toContain("LVEF");
  });
});

describe("Doppler studies", () => {
  test("normal lower-limb impression is the doctor's all-caps summary", () => {
    const r = resolve(initialState("doppler-lower"), lookupAll, "t");
    expect(r.impression).toEqual(["NORMAL COLOUR DOPPLER STUDY OF BOTH LOWER LIMBS."]);
    expect(r.sections.map((s) => s.label)).toEqual(["ARTERIAL SYSTEM", "VENOUS SYSTEM", "SUBCUTANEOUS TISSUE"]);
  });

  test("DVT with typed side composes 'Deep vein thrombosis of left lower limb.'", () => {
    let state = withPathology("doppler-lower", "venous", "ll-venous-dvt");
    state = setOrganVar(state, "venous", "side", "left");
    const r = resolve(state, lookupAll, "t");
    expect(r.impression[0]).toBe("Deep vein thrombosis of left lower limb.");
    expect(r.suggestions).toContain("Follow up Doppler study.");
  });

  test("upper-limb variants apply on the same arterial/venous cards", () => {
    const r = resolve(withPathology("doppler-upper", "venous", "ul-venous-dvt"), lookupAll, "t");
    expect(r.title).toBe("COLOUR DOPPLER OF BOTH UPPER LIMBS");
    expect(r.impression[0]).toBe("Deep vein thrombosis of ___ upper limb.");
  });
});

describe("Carotid study", () => {
  test("plaque on the right side card fills {Side} and percent/PSV from vars", () => {
    let state = withPathology("carotid", "carotid_rt", "carotid-plaque");
    state = setOrganVar(state, "carotid_rt", "percent", "40");
    state = setOrganVar(state, "carotid_rt", "psv", "110");
    const r = resolve(state, lookupAll, "t");
    const text = r.sections.find((s) => s.organ === "carotid_rt")!.text;
    expect(text).toContain("Right common carotid artery shows eccentric atherosclerotic plaque");
    expect(text).toContain("about 40 %");
    expect(r.impression[0]).toBe("Atherosclerotic plaque in right common carotid artery with about 40 % luminal narrowing.");
  });
});

describe("Chest study", () => {
  test("right pleural effusion composes the side-substituted impression; left pleura stays normal", () => {
    const state = withPathology("chest", "pleura_rt", "pleura-effusion-moderate");
    const r = resolve(state, lookupAll, "t");
    expect(r.sections.find((s) => s.organ === "pleura_rt")!.text).toContain("Right pleural cavity shows moderate anechoic collection");
    expect(r.sections.find((s) => s.organ === "pleura_lt")!.text).toContain("Left pleura shows normal echogenicity");
    expect(r.impression[0]).toBe("Right moderate pleural effusion with mild collapse of underlying lung.");
    expect(r.suggestions).toContain("X-Ray Chest PA View");
  });
});

describe("Cranium & orbit studies", () => {
  test("hydrocephalus ladder applies to the ventricles card", () => {
    const r = resolve(withPathology("cranium", "ventricles", "cranium-hydro-moderate"), lookupAll, "t");
    expect(r.impression).toEqual(["Moderate hydrocephalus."]);
    expect(r.sections.find((s) => s.organ === "midline")!.text).toContain("Midline structures are in normal position");
  });

  test("retinal detachment on the left globe substitutes the side", () => {
    const r = resolve(withPathology("orbit", "globe_lt", "orbit-retinal-detachment"), lookupAll, "t");
    expect(r.impression).toEqual(["Left retinal detachment with subretinal fluid."]);
  });
});

describe("Swelling study", () => {
  test("lipoma with typed site flows into finding AND impression", () => {
    let state = withPathology("swelling", "lesion", "swelling-lipoma");
    state = setOrganVar(state, "lesion", "site", "anterior aspect of left thigh");
    const r = resolve(state, lookupAll, "t");
    const text = r.sections.find((s) => s.organ === "lesion")!.text;
    expect(text).toContain("bulky subcutaneous tissue at the anterior aspect of left thigh");
    expect(r.impression[0]).toContain("at the anterior aspect of left thigh S/O ? Lipoma");
    expect(r.suggestions).toContain("FNAC");
  });

  test("the hernia family lives on the lesion card with {site} tokens", () => {
    const chips = pathologiesForOrgan(USG_PATHOLOGIES_ALL, "lesion");
    for (const key of ["swelling-hernia-umbilical", "swelling-hernia-incisional", "swelling-hernia-inguinal"]) {
      expect(chips.some((p) => p.key === key)).toBe(true);
    }
  });
});

describe("Study switching into the new families", () => {
  test("wa-female → thyroid resets plain normals; a carried pathology keeps its text", () => {
    let state = initialState("wa-female");
    state = applyPathology(state, "liver", "liver-fatty-g1", lookupAll);
    const switched = switchStudy(state, "thyroid");
    expect(switched.studyKey).toBe("thyroid");
    // Liver does not exist in the thyroid study — dropped cleanly.
    expect(switched.organs.every((o) => ["thyroid_rt", "thyroid_lt", "isthmus", "submandibular", "parotid", "nodes", "vessels"].includes(o.organ))).toBe(true);
    expect(switched.organs.find((o) => o.organ === "thyroid_rt")!.text).toContain("Right lobe measures");
  });
});

describe("Print engine v2", () => {
  const resolved = resolve(withPathology("kub", "ureters", "ureter-calculus-distal"), lookupAll, "technique line");

  test("premium (default) keeps the gradient letterhead and adds the referral line + serial", () => {
    const html = buildUsgReportHtml(SETTINGS, { ...patient, serial: "USG-00AB12" }, resolved);
    expect(html).toContain("linear-gradient");
    expect(html).toContain("Thanks For Your Referral.");
    expect(html).toContain("USG-00AB12");
    expect(html).toContain("ULTRASOUND REPORT");
  });

  test("classic style is plain black-and-white serif — no gradients, no shadows", () => {
    const html = buildUsgReportHtml({ ...SETTINGS, usgPrintStyle: "classic" }, patient, resolved);
    expect(html).toContain("Georgia");
    expect(html).not.toContain("linear-gradient");
    expect(html).not.toContain("box-shadow");
    expect(html).not.toContain("border-radius: 1");
    expect(html).toContain('class="masthead"');
    expect(html).toContain("Thanks For Your Referral.");
  });

  test("compact density shrinks the body font", () => {
    const html = buildUsgReportHtml({ ...SETTINGS, usgPrintCompact: true }, patient, resolved);
    expect(html).toContain("body { font-size: 9.5pt; line-height: 1.38; }");
    expect(html).toContain("9.5pt");
  });

  test("no serial = no USG No. cell; multi-line findings keep their line breaks", () => {
    const html = buildUsgReportHtml(SETTINGS, patient, resolved);
    expect(html).not.toContain("USG No.");
    const echoHtml = buildUsgReportHtml(SETTINGS, patient, resolve(initialState("echo"), lookupAll, "t"));
    expect(echoHtml).toContain("<br/>"); // valve profiles multi-line block
  });

  test("unfilled measurement slots still render as blanks, never raw {tokens}", () => {
    const html = buildUsgReportHtml(SETTINGS, patient, resolve(initialState("echo"), lookupAll, "t"));
    expect(html).not.toMatch(/\{[a-zA-Z0-9_]+\}/);
    expect(html).toContain("___");
  });
});

describe("Side-token engine", () => {
  test("ORGAN_SIDE covers all seven paired structures", () => {
    expect(ORGAN_SIDE.thyroid_rt).toEqual({ side: "right", Side: "Right" });
    expect(ORGAN_SIDE.pleura_lt).toEqual({ side: "left", Side: "Left" });
    expect(substitute("{side} / {Side}", {}, "carotid_lt")).toBe("left / Left");
  });
});
