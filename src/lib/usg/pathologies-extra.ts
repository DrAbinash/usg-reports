/**
 * USG Studio — builtin pathology quick-select catalog, part 2.
 *
 * Entries for the extended study family: thyroid, breast, scrotum, TVS/TRUS
 * extras, echocardiography, limb & carotid Doppler, chest, cranium, orbit
 * and USG of swelling. Every finding is the doctor's own preferred wording,
 * curated verbatim from the formats-usg corpus; the few studies with no
 * corpus coverage (carotid, cranium, orbit, TRUS, upper-limb Doppler) use
 * standard textbook sonography phrasing in her house style.
 *
 * Side-aware entries use the shared-organ pattern (organ "thyroid-lobe"
 * applies to thyroid_rt AND thyroid_lt with {side}/{Side} auto-substituted)
 * — the same rule the kidney library already follows.
 */
import type { UsgPathologyDef, UsgVarDef } from "./types";

const V = (key: string, label: string, unit = "cm"): UsgVarDef => ({ key, label, unit });
const VS = (label = "Side (right/left)"): UsgVarDef => ({ key: "side", label, unit: "" });

const P = (p: Omit<UsgPathologyDef, "builtin">): UsgPathologyDef => ({ ...p, builtin: true });

export const USG_PATHOLOGIES_EXTRA: UsgPathologyDef[] = [
  // ── THYROID — lobe-level (shared organ "thyroid-lobe", {side}/{Side}) ──────
  P({
    key: "thyroid-goiter-lobe", organ: "thyroid-lobe", label: "Goitre — enlarged lobe, coarse", category: "Thyroid",
    text: "{Side} lobe is enlarged in size & measures {d1} X {d2} mm in AP diameter. Enlarged in size with coarse parenchymal echogenicity. No SOL or calcification seen. Color Doppler shows normal blood flow.",
    impression: ["Enlarged {side} lobe of thyroid with coarse parenchymal echogenicity S/o Goiter."],
    suggestions: ["FNAC"],
    vars: [V("d1", "Lobe AP", "mm"), V("d2", "Lobe TR", "mm")],
  }),
  P({
    key: "thyroid-thyroiditis", organ: "thyroid-lobe", label: "Thyroiditis — lobe changes", category: "Thyroid",
    text: "{Side} lobe is enlarged in size & measures {d1} cm in AP diameter. Parenchymal echogenicity is reduced with heterogeneous echotexture. No SOL or calcification seen. Color Doppler shows increased blood flow.",
    impression: ["Enlarged {side} lobe of thyroid with decreased parenchymal echogenicity, heterogeneous echotexture and increased vascularity."],
    suggestions: ["FNAC", "Thyroid function test"],
    vars: [V("d1", "Lobe AP")],
  }),
  P({
    key: "thyroid-acute-thyroiditis", organ: "thyroid-lobe", label: "Acute Thyroiditis — diffuse", category: "Thyroid",
    text: "Marked diffuse enlargement of the {side} lobe of thyroid gland. The glandular texture is inhomogeneous and hypo-echoic. Normal glandular texture is lost. On color flow imaging very high flow is seen in the gland. Thyroid inferno sign is positive.",
    impression: ["Marked diffusely enlarged highly vascular thyroid gland with loss of normal texture S/O ? Acute thyroiditis."],
    suggestions: ["Thyroid function test / FNAC", "Follow up scan."],
  }),
  P({
    key: "thyroid-mng", organ: "thyroid-lobe", label: "Multinodular Goitre — lobe", category: "Thyroid",
    text: "Enlarged {side} lobe of thyroid gland. There is evidence of heterogeneous lesion within with both solid and cystic components. Areas of calcification are also seen within. {Side} lobe measures ({d1} x {d2} cm).",
    impression: ["Enlarged {side} lobe with heterogeneous nodular lesion S/o Multinodular goiter."],
    suggestions: ["FNAC / Thyroid function test / Follow up scan."],
    vars: [V("d1", "Lobe L"), V("d2", "Lobe W")],
  }),
  P({
    key: "thyroid-multiple-nodules", organ: "thyroid-lobe", label: "Multinodular Hyperplasia — lobe", category: "Thyroid",
    text: "HRSG shows enlarged {side} lobe of thyroid gland. Multiple well defined nodular shadows are seen within. A small anechoic cystic lesion ({d1} x {d2} cm) is also seen within.",
    impression: ["Multi nodular hyperplasia of the {side} lobe of thyroid gland."],
    vars: [V("d1", "Cyst L"), V("d2", "Cyst W")],
  }),
  P({
    key: "thyroid-colloid-cyst", organ: "thyroid-lobe", label: "Colloid Cyst — starry sky", category: "Thyroid",
    text: "{Side} lobe is enlarged and measures {d1} mm in AP diameter. A thick walled cystic mass with multiple bright echogenic floating shadows in the cyst giving starry sky appearence. Color Doppler shows peripheral vascularity.",
    impression: ["Colloid cyst of {side} lobe of thyroid gland."],
    suggestions: ["Follow up scan / FNAC"],
    vars: [V("d1", "Lobe AP", "mm")],
  }),
  P({
    key: "thyroid-cyst-thin-walled", organ: "thyroid-lobe", label: "Thin-walled Cyst — floating echoes", category: "Thyroid",
    text: "{Side} lobe is enlarged and measures {d1} mm in AP diameter. A thin walled cystic mass ({d2} x {d3} cm) with echogenic floating shadows. Color Doppler shows peripheral vascularity.",
    impression: ["Bulky {side} lobe of thyroid gland with a thin walled cystic mass with echogenic floating shadows.", "D/D Colloid Cyst"],
    suggestions: ["Follow up scan / FNAC"],
    vars: [V("d1", "Lobe AP", "mm"), V("d2", "Cyst L"), V("d3", "Cyst W")],
  }),
  P({
    key: "thyroid-nodule", organ: "thyroid-lobe", label: "Solitary Nodule — lobe", category: "Thyroid",
    text: "{Side} lobe measures {d1} mm in AP diameter. It is normal in echotexture. A well defined homogeneous iso to hyperechoic nodular lesion ({d2} x {d3} mm) in {side} lobe of thyroid. The lesion is seen merging in the gland tissue. Color doppler flow both peripheral and central vascularity.",
    impression: ["A well defined nodular lesion in the {side} lobe of thyroid."],
    suggestions: ["FNAC / Follow up scan."],
    vars: [V("d1", "Lobe AP", "mm"), V("d2", "Nodule L", "mm"), V("d3", "Nodule W", "mm")],
  }),
  P({
    key: "thyroid-complex-mass", organ: "thyroid-lobe", label: "Complex Mass — solid + cystic", category: "Thyroid",
    text: "{Side} lobe of thyroid is enlarged in AP diameter. A well defined heteroechoic mass ({d1} x {d2} cm) in {side} lobe of thyroid with both solid and cystic components. Color doppler shows vascularity within the solid component and at periphery of the mass.",
    impression: ["Enlarged {side} lobe of thyroid with a well defined heteroechoic mass having both solid and cystic components."],
    suggestions: ["FNAC / Follow up scan."],
    vars: [V("d1", "Mass L"), V("d2", "Mass W")],
  }),
  P({
    key: "thyroid-hypoechoic-mass", organ: "thyroid-lobe", label: "Ill-defined Isoechoic Mass", category: "Thyroid",
    text: "{Side} lobe measures {d1} mm in AP diameter. It is normal in echotexture. An ill defined homogeneous isoechogenic mass ({d2} x {d3} mm) in {side} lobe of thyroid. The mass is seen merging in the gland tissue. On color doppler flow is seen in the mass.",
    impression: ["An ill defined homogeneous isoechogenic mass in {side} lobe of thyroid."],
    suggestions: ["FNAC / Follow up scan."],
    vars: [V("d1", "Lobe AP", "mm"), V("d2", "Mass L", "mm"), V("d3", "Mass W", "mm")],
  }),
  P({
    key: "thyroid-calcified-mass", organ: "thyroid-lobe", label: "Vascular Mass + Calcification", category: "Thyroid",
    text: "{Side} lobe is enlarged in size & measures {d1} X {d2} cm in AP diameter. A large well define hypervascular oval mass ( size-{d3} X {d4} cm ) with internal cystic changes and areas of calcification.",
    impression: ["Enlarged {side} lobe of thyroid and a large well define hypervascular oval mass with internal cystic changes and areas of calcification."],
    suggestions: ["FNAC"],
    vars: [V("d1", "Lobe AP"), V("d2", "Lobe TR"), V("d3", "Mass L"), V("d4", "Mass W")],
  }),

  // ── THYROID — isthmus / nodes / salivary glands ────────────────────────────
  P({
    key: "thyroid-isthmus-bulky", organ: "isthmus", label: "Bulky Isthmus with lesion", category: "Thyroid",
    text: "Isthmus is enlarged in size & measure {isth} mm. It is bulky with a hypoechoic lesion ({d1} x {d2} mm) within. Color Doppler shows increased blood flow.",
    impression: ["Bulky isthmus with a small hypoechoic lesion within."],
    suggestions: ["FNAC / Follow up scan."],
    vars: [V("d1", "Lesion L", "mm"), V("d2", "Lesion W", "mm")],
  }),
  P({
    key: "thyroid-nodes-cervical", organ: "nodes", label: "Cervical Lymphadenopathy", category: "Nodes",
    text: "Few enlarged bilateral cervical lymph nodes ( Largest size-{d1} X {d2} cm ).",
    impression: ["Few enlarged cervical lymph nodes."],
    suggestions: ["FNAC"],
    vars: [V("d1", "Largest L"), V("d2", "Largest W")],
  }),
  P({
    key: "thyroid-nodes-subcentimeter", organ: "nodes", label: "Subcentimeter Nodes — one side", category: "Nodes",
    text: "Few subcentimeter {side} cervical lymph nodes ( Largest size-{d1} X {d2} cm ).",
    impression: ["Few subcentimeter {side} cervical lymph nodes."],
    vars: [VS(), V("d1", "Largest L"), V("d2", "Largest W")],
  }),
  P({
    key: "thyroid-submand-inflammatory", organ: "submandibular", label: "Submandibular — Inflammatory", category: "Neck",
    text: "Bilateral sub mandibular glands are bulky with mildly decreased echotexture S/O Inflammatory changes. Color Doppler shows normal blood flow.",
    impression: ["Bulky bilateral submandibular glands with mildly decreased echotexture S/O Inflammatory changes."],
  }),
  P({
    key: "thyroid-submand-nodes", organ: "submandibular", label: "Submandibular Lymphadenopathy", category: "Neck",
    text: "Multiple enlarged lymph nodes are seen in bilateral sub mandibular region ( more on {side} side, largest measuring {d1} x {d2} cm). Color Doppler shows increased blood flow.",
    impression: ["Multiple enlarged submandibular lymph nodes."],
    vars: [VS(), V("d1", "Largest L"), V("d2", "Largest W")],
  }),
  P({
    key: "thyroid-parotid-mass", organ: "parotid", label: "Parotid Mass — suspicious", category: "Neck",
    text: "HRSG shows an irregular heterogeneous solid mass ({d1} x {d2} cm approx) invading the superficial and deep lobes of the parotid. The normal outline is lost with spiculated margin ( likely due to capsular breach ). On color doppler flow imaging increased vascularity of the mass is seen. On spectral tracing high flow is seen in the mass.",
    impression: ["An irregular heterogeneous vascular solid mass involving the superficial and deep lobes of the parotid with spiculated margin.", "Features are likely suggestive of malignant mass."],
    suggestions: ["FNAC"],
    vars: [V("d1", "Mass L"), V("d2", "Mass W")],
  }),

  // ── BREAST — side-level (shared organ "breast", {side}/{Side}) ─────────────
  P({
    key: "breast-fibroadenosis", organ: "breast", label: "Fibroadenosis — Early", category: "Breast",
    text: "Early fibroadenotic changes in {side} breast predominantly in upper outer quadrant. No focal mass lesion seen. Nipple & periareolar area shows mildly prominent ductules.",
    impression: ["Early Fibroadenotic changes in {side} breast."],
    suggestions: ["Follow up scan."],
  }),
  P({
    key: "breast-fibroadenoma", organ: "breast", label: "Fibroadenoma", category: "Breast",
    text: "HRSG shows a well defined encapsulated mobile soft tissue mass in {side} breast ({d1} x {d2} cm). The mass shows sharp margins with homogenous echotexture. No calcification or cystic necrosis is seen in the mass. Features are suggestive of Fibroadenoma. Rest of the {side} breast parenchyma is compressed by the mass.",
    impression: ["A well defined encapsulated soft tissue mass in {side} breast with sharp margins and homogenous echotexture without any calcification or cystic necrosis. Features are suggestive of Fibroadenoma."],
    suggestions: ["FNAC"],
    vars: [V("d1", "Mass L"), V("d2", "Mass W")],
  }),
  P({
    key: "breast-fibroadenoma-two", organ: "breast", label: "Fibroadenomas — Two", category: "Breast",
    text: "HRSG shows Two well defined encapsulated mobile soft tissue masses in {side} breast ( {d1} x {d2} cm at 12 O' clock and {d3} x {d4} cm at lower outer quadrant. The mass shows sharp margins with homogenous echotexture. No calcification or cystic necrosis is seen in the mass. Features are suggestive of Fibroadenoma.",
    impression: ["Two well defined encapsulated mobile soft tissue masses with sharp margins and homogenous echotexture in {side} breast.", "Features are suggestive of Fibroadenoma."],
    suggestions: ["FNAC"],
    vars: [V("d1", "Mass 1 L"), V("d2", "Mass 1 W"), V("d3", "Mass 2 L"), V("d4", "Mass 2 W")],
  }),
  P({
    key: "breast-fibroadenoma-degenerative", organ: "breast", label: "Fibroadenoma — with degeneration", category: "Breast",
    text: "A large well defined hypoechoic mobile mass ( size- {d1} X {d2} cm ) is seen in {side} lower inner quadrant. Half of the mass shows homogeneous echotexture whereas the other half shows degenerative changes with internal liquifaction.",
    impression: ["A large well defined hypoechoic mobile mass in {side} lower inner quadrant with degenerative changes and internal liquifaction.", "D/D Fibroadenoma with degenerative changes."],
    suggestions: ["Follow up scan / FNAC"],
    vars: [V("d1", "Mass L"), V("d2", "Mass W")],
  }),
  P({
    key: "breast-carcinoma", organ: "breast", label: "Carcinoma — highly suspicious", category: "Breast",
    text: "There is evidence of an irregularly outlined hypoechoic mass (measuring {d1} x {d2} cm) with speculated margins in the {side} upper inner quadrant. The mass is taller than wide with less through transmission of the sound waves. The mass is adherent to the anterior wall. Color doppler shows both central and peripheral vascularity. The PSV is high {psv} cm/sec. Rest of the {side} breast parenchyma shows homogenous echopattern with normal tissue echotexture.",
    impression: ["An irregularly outlined hypoechoic mass with speculated margins in the {side} upper inner quadrant with both central and peripheral vascularity and high peak systolic velocity - {psv} cm/sec.", "Highly suspicious of malignancy."],
    suggestions: ["FNAC."],
    vars: [V("d1", "Mass L"), V("d2", "Mass W"), V("psv", "PSV", "cm/sec")],
  }),
  P({
    key: "breast-mass-malignant", organ: "breast", label: "Large Ulcerating Mass", category: "Breast",
    text: "A large ill defined solid hypoechoic mass ( size {d1} X {d2} cm ) with irregular speculated margin, predominantly occupying the {side} lower outer quadrant, retro areolar region & upper outer quadrant. Areas of coarse calcification is seen within the mass. The mass is infiltrating the skin and subcutaneous tissue with ulcer formation. Color doppler shows moderate vascularity. Nipple is retracted.",
    impression: ["A large ulcerating {side} breast mass. F/S/O - ? Malignancy."],
    suggestions: ["Co-relation with FNAC is suggested."],
    vars: [V("d1", "Mass L"), V("d2", "Mass W")],
  }),
  P({
    key: "breast-abscess", organ: "breast", label: "Breast Abscess", category: "Breast",
    text: "There is evidence of a large well defined irregularly outlined hypoechoic collection ({d1} x {d2} cm vol-{vol} cc approx ) with fine internal echoes, in the {side} retroareolar region extending towards all the quadrants. The surrounding breast parenchyma is grossly inflamed with fat stranding. Nipple is retracted.",
    impression: ["Large {side} breast abscess."],
    vars: [V("d1", "Collection L"), V("d2", "Collection W"), V("vol", "Volume", "cc")],
  }),
  P({
    key: "breast-galactocele", organ: "breast", label: "Galactocele — mixed mass", category: "Breast",
    text: "A large ill defined mixed echogenicity mass ({d1} x {d2} cm) in {side} breast predominantly occupying the lower outer and upper outer quadrants.",
    impression: ["A large ill defined mixed echogenicity mass in {side} breast.", "D/D Galactocele / Evolving abscess"],
    suggestions: ["Follow up scan / FNAC"],
    vars: [V("d1", "Mass L"), V("d2", "Mass W")],
  }),
  P({
    key: "breast-intramammary-node", organ: "breast", label: "Intramammary Lymph Node", category: "Breast",
    text: "A subcentimeter intramammary lymph node ({d1} x {d2} cm) in the {side} upper outer quadrant. Rest of the breast parenchyma shows homogenous echopattern with normal tissue echotexture.",
    impression: ["A subcentimeter intramammary lymph node in the {side} upper outer quadrant."],
    suggestions: ["Follow up scan."],
    vars: [V("d1", "Node L"), V("d2", "Node W")],
  }),
  P({
    key: "breast-cellulitis", organ: "breast", label: "Cellulitis", category: "Breast",
    text: "Cellulitis with subcutaneous fat stranding at the {side} lower inner quadrant of the breast. Rest of the breast parenchyma is normal.",
    impression: ["Cellulitis with subcutaneous fat stranding at the {side} lower inner quadrant of the breast."],
  }),
  P({
    key: "breast-mastalgia", organ: "breast", label: "Mastalgia — tender breast", category: "Breast",
    text: "Mildly tender {side} breast predominantly in lower outer quadrants. No focal mass lesion seen. Rest of the fibro fatty tissue appears normal.",
    impression: ["Mildly tender {side} breast predominantly in lower outer quadrants."],
    suggestions: ["Follow up scan"],
  }),
  P({
    key: "breast-cysticercosis", organ: "breast", label: "Cysticercosis — cystic lesion", category: "Breast",
    text: "A small cystic lesion ({d1} x {d2} cm) with an eccentric calcific foci in {side} lower outer quadrant. Rest of the fibro fatty tissue appears normal.",
    impression: ["A small cystic lesion with an eccentric calcific foci, in {side} lower outer quadrant.", "Possibility of cysticercosis could not be ruled out."],
    vars: [V("d1", "Lesion L"), V("d2", "Lesion W")],
  }),
  P({
    key: "breast-duct-dilatation", organ: "breast", label: "Focal Duct Dilatation", category: "Breast",
    text: "Focal duct dilatation at {clock} O'clock position of {side} breast at retroareolar region. Rest of the breast parenchyma are normal in morphology.",
    impression: ["Focal duct dilatation at {clock} O'clock position of {side} breast at retroareolar region."],
    suggestions: ["FNAC / Mammogram."],
    vars: [{ key: "clock", label: "Clock position (e.g. 9)", unit: "" }],
  }),
  P({
    key: "breast-nodular-subareolar", organ: "breast", label: "Nodular Lesion — subareolar", category: "Breast",
    text: "A small ill defined nodular lesion ({d1} x {d2} cm) deep to the {side} nipple. Rest of the breast parenchyma are normal in morphology.",
    impression: ["A small ill defined nodular lesion deep to the {side} nipple."],
    suggestions: ["FNAC / Mammogram."],
    vars: [V("d1", "Lesion L"), V("d2", "Lesion W")],
  }),

  // ── AXILLA ──────────────────────────────────────────────────────────────────
  P({
    key: "axilla-nodes", organ: "axilla", label: "Axillary Lymphadenopathy", category: "Axilla",
    text: "Multiple enlarged {side} axillary lymph nodes with maintained echotexture ( largest size-{d1} X {d2} cm ).",
    impression: ["{Side} axillary lymphadenopathy."],
    suggestions: ["FNAC"],
    vars: [VS(), V("d1", "Largest L"), V("d2", "Largest W")],
  }),
  P({
    key: "axilla-lipoma", organ: "axilla", label: "Axilla — Lipoma", category: "Axilla",
    text: "A well defined large homogeneous mass at the anterior wall of {side} axilla. Its echogenicity is similar to that of subcutaneous fat. The mass is superficial and not invading the deeper structures. No enlarged {side} axillary lymph nodes.",
    impression: ["A well defined large homogeneous mass at the anterior wall of {side} axilla S/O ? Lipoma."],
    suggestions: ["FNAC."],
    vars: [VS()],
  }),

  // ── SCROTUM — testis level (shared organ "testis", {side}/{Side}) ───────────
  P({
    key: "testis-epididymo-orchitis", organ: "testis", label: "Epididymo-orchitis", category: "Testis",
    text: "Measures {t1} X {t2} mm. Enlarged in size, with decreased echogenicity. Head, body and tail of epididymis is enlarged, heterogenous in echotexture with few areas of calcification. Color Doppler shows increased vascularity.",
    impression: ["{Side} epididymo-orchitis ( ? Acute on chronic)."],
    vars: [V("t1", "Testis L", "mm"), V("t2", "Testis W", "mm")],
  }),
  P({
    key: "testis-epididymitis", organ: "testis", label: "Epididymitis", category: "Testis",
    text: "Measures {t1} X {t2} mm. Appear normal in size, shape and echotexture. {Side} epididymis is bulky and hypoechoic with increased vascularity on color doppler.",
    impression: ["Bulky and hypoechoic {side} epididymis with increased flow on color doppler.", "D/D Epididymitis."],
    vars: [V("t1", "Testis L", "mm"), V("t2", "Testis W", "mm")],
  }),
  P({
    key: "testis-orchitis", organ: "testis", label: "Orchitis", category: "Testis",
    text: "Measures {t1} X {t2} mm. Enlarged in size with decreased echogenicity and heterogenous echotexture. Color Doppler shows increased vascularity.",
    impression: ["{Side} orchitis."],
    vars: [V("t1", "Testis L", "mm"), V("t2", "Testis W", "mm")],
  }),
  P({
    key: "testis-undescended", organ: "testis", label: "Undescended Testis", category: "Testis",
    text: "Could not be visualised in the scrotal sac.",
    impression: ["Empty {side} scrotal sac ? Undescended {side} testis ( see inguinal region )."],
  }),
  P({
    key: "testis-abscess", organ: "testis", label: "Testicular Abscess", category: "Testis",
    text: "Measures {t1} X {t2} mm. Appear normal in size, shape and echotexture. A large collection ( Size- {d1} X {d2} cm ) with honeycomb appearance in extra testicular space of {side} scrotal sac. The normal testis is pushed to one side. Color Doppler shows increased vascularity.",
    impression: ["A large collection with honeycomb appearance in extra testicular space of {side} scrotal sac ? Testicular Abscess."],
    vars: [V("t1", "Testis L", "mm"), V("t2", "Testis W", "mm"), V("d1", "Collection L"), V("d2", "Collection W")],
  }),

  // ── SCROTAL SAC / CORD ─────────────────────────────────────────────────────
  P({
    key: "sac-hydrocele-bilateral-mild", organ: "sac", label: "Hydrocele — Bilateral Mild", category: "Sac",
    text: "Mild collection in bilateral scrotal sac.",
    impression: ["Bilateral mild hydrocele."],
  }),
  P({
    key: "sac-hydrocele-side", organ: "sac", label: "Hydrocele — One Side, Moderate-Gross", category: "Sac",
    text: "Moderate to gross collection in {side} scrotal sac.",
    impression: ["{Side} moderate to gross hydrocele."],
    vars: [VS()],
  }),
  P({
    key: "sac-hydrocele-bilateral-gross", organ: "sac", label: "Hydrocele — Bilateral Gross", category: "Sac",
    text: "Gross anechoic collection in bilateral scrotal sac.",
    impression: ["Bilateral gross hydrocele."],
  }),
  P({
    key: "sac-hydrocele-septated", organ: "sac", label: "Hydrocele — with Fine Septa", category: "Sac",
    text: "Collection in bilateral scrotal sac with fine septa seen within.",
    impression: ["Bilateral hydrocele with fine septa."],
  }),
  P({
    key: "cord-varicocele", organ: "cord", label: "Varicocele — cord vessels", category: "Cord",
    text: "{Side} spermatic cord is bulky with dilated and tortuous vessels. Valsalva's test is positive. Other side spermatic cord are normal in size with normal blood flow pattern.",
    impression: ["Thickened {side} spermatic cord with features of varicocele."],
    vars: [VS()],
  }),
  P({
    key: "cord-thickened", organ: "cord", label: "Cord — Thickened", category: "Cord",
    text: "{Side} spermatic cord is thickened. Other side spermatic cord are normal in size with normal blood flow pattern.",
    impression: ["Thickened {side} spermatic cord."],
    vars: [VS()],
  }),
  P({
    key: "cord-inguinal-hernia", organ: "cord", label: "Indirect Inguinal Hernia — irreducible", category: "Cord",
    text: "A well defined irreducible hernial sac is seen in the {side} inguinal region. The content appears to be bowel loops and its mesentry. Color doppler shows both arterial and venous flow within the sac content. The sac is reaching upto the superior margin of the {side} scrotal sac. The {side} spermatic cord is compressed.",
    impression: ["{Side} irreducible indirect inguinal hernia."],
    vars: [VS()],
  }),
  P({
    key: "cord-undescended-canal", organ: "cord", label: "Inguinal Canal — Undescended Testis", category: "Cord",
    text: "There is evidence of an oval hypoechoic structure in the {side} inguinal canal ? Undescended testis. Multiple enlarged bilateral inguinal lymph nodes.",
    impression: ["An oval hypoechoic structure in the {side} inguinal canal ? Undescended testis.", "Bilateral inguinal lymphadenopathy."],
    vars: [VS()],
  }),

  // ── UTERUS extras (TVS + lower abdomen) ─────────────────────────────────────
  P({
    key: "uterus-nabothian", organ: "uterus", label: "Infected Nabothian Cyst", category: "Uterus",
    text: "Uterus is normal in size and shape & measures {u1} x {u2} x {u3} cm. The uterus is positioned in anteversion, with normal endometrial thickness ({et} cm). A well defined cystic structure ({d1} x {d2} cm) with internal septation and echoes at the posterior lip of cervix. The cervical echo is otherwise normal.",
    impression: ["A well defined cystic structure with internal septation and echoes at the posterior lip of cervix. - ? Infected Nabothian cyst."],
    vars: [V("u1", "Uterus L"), V("u2", "Uterus W"), V("u3", "Uterus H"), V("et", "Endometrium"), V("d1", "Cyst L"), V("d2", "Cyst W")],
  }),
  P({
    key: "uterus-elongated-cervix", organ: "uterus", label: "Elongated Cervix + Follicles", category: "Uterus",
    text: "Uterus is normal in size and shape & measures {u1} x {u2} x {u3} cm. The uterus is positioned in anteversion, with normal endometrial thickness ({et} cm). No focal pathology or abnormalities of outline are noted. Elongated cervix with few nabothian follicles.",
    impression: ["Elongated cervix with few nabothian follicles."],
    vars: [V("u1", "Uterus L"), V("u2", "Uterus W"), V("u3", "Uterus H"), V("et", "Endometrium")],
  }),

  // ── PROSTATE extras (TRUS, measured) ────────────────────────────────────────
  P({
    key: "prostate-trus-enlarged", organ: "prostate", label: "Prostatomegaly — measured", category: "Prostate",
    text: "Prostate is enlarged in size and measures {p1} X {p2} X {p3} cm corresponding to approximately {vol} gms. Shows heterogeneous echotexture. No evidence of focal lesion, calcification or S.O.L noted.",
    impression: ["Prostatomegaly ( {vol} gms )."],
    vars: [V("p1", "Prostate L"), V("p2", "Prostate W"), V("p3", "Prostate H"), V("vol", "Volume", "gms")],
  }),
  P({
    key: "prostate-focal-lesion", organ: "prostate", label: "Focal Lesion — suspicious", category: "Prostate",
    text: "Prostate is enlarged in size and measures {p1} X {p2} X {p3} cm corresponding to approximately {vol} gms. A well defined hypoechoic focal lesion ({d1} x {d2} cm) is seen in the peripheral zone of the prostate. Colour Doppler shows increased vascularity within the lesion.",
    impression: ["A hypoechoic focal lesion in the peripheral zone of prostate with increased vascularity.", "? Suspicious of prostatic malignancy."],
    suggestions: ["Serum PSA", "TRUS-guided biopsy"],
    vars: [V("p1", "Prostate L"), V("p2", "Prostate W"), V("p3", "Prostate H"), V("vol", "Volume", "gms"), V("d1", "Lesion L"), V("d2", "Lesion W")],
  }),
  P({
    key: "prostate-prostatitis", organ: "prostate", label: "Prostatitis", category: "Prostate",
    text: "Prostate is mildly enlarged and measures {p1} X {p2} X {p3} cm corresponding to approximately {vol} gms. Shows increased parenchymal vascularity on colour Doppler with periurethral hypoechogenicity. No focal lesion or S.O.L noted.",
    impression: ["Features suggestive of prostatitis."],
    vars: [V("p1", "Prostate L"), V("p2", "Prostate W"), V("p3", "Prostate H"), V("vol", "Volume", "gms")],
  }),

  // ── ECHOCARDIOGRAPHY — valve profiles (organ "echo-valves") ─────────────────
  P({
    key: "echo-mr-mod", organ: "echo-valves", label: "Mitral Regurgitation — Moderate", category: "Valves",
    text: "Mitral Valve ( MV ) : The AML show normal cusps thickness and excursion, no calcification, no doming. Colour Doppler shows moderate mitral regurgitation.\nAortic Valve ( AoV ) : Normal thickness & excursions.\nTricuspid Valve ( TV ) : Normal cusps.\nPulmonary Valve ( PV ) : Pulmonary annulus & its branches are normal.\nIAS ( Interatrial Septum ) : Intact.\nIVS ( Interventricular Septum ) : Intact.\nPericardium : No effusion.\nLA / LVA Clot : None.",
    impression: ["Moderate mitral regurgitation."],
  }),
  P({
    key: "echo-mr-gross", organ: "echo-valves", label: "Mitral Regurgitation — Gross", category: "Valves",
    text: "Mitral Valve ( MV ) : The AML show thickened cusps with restricted excursion. Colour Doppler shows gross mitral regurgitation with a dilated LA cavity.\nAortic Valve ( AoV ) : Normal thickness & excursions.\nTricuspid Valve ( TV ) : Normal cusps.\nPulmonary Valve ( PV ) : Pulmonary annulus & its branches are normal.\nIAS ( Interatrial Septum ) : Intact.\nIVS ( Interventricular Septum ) : Intact.\nPericardium : No effusion.\nLA / LVA Clot : None.",
    impression: ["Gross mitral regurgitation."],
  }),
  P({
    key: "echo-ms", organ: "echo-valves", label: "Mitral Stenosis (Rheumatic)", category: "Valves",
    text: "Mitral Valve ( MV ) : Mitral valve is thickened with restricted opening and doming of the leaflets. Colour Doppler shows mitral stenosis with moderate mitral regurgitation.\nAortic Valve ( AoV ) : Normal thickness & excursions.\nTricuspid Valve ( TV ) : Normal cusps.\nPulmonary Valve ( PV ) : Pulmonary annulus & its branches are normal.\nIAS ( Interatrial Septum ) : Intact.\nIVS ( Interventricular Septum ) : Intact.\nPericardium : No effusion.\nLA / LVA Clot : None.",
    impression: ["Rheumatic mitral valve disease with mitral stenosis and regurgitation."],
  }),
  P({
    key: "echo-ar-mild", organ: "echo-valves", label: "Aortic Regurgitation — Mild", category: "Valves",
    text: "Mitral Valve ( MV ) : The AML show normal cusps thickness and excursion, no calcification, no doming.\nAortic Valve ( AoV ) : Normal thickness & excursions. Colour Doppler shows mild aortic regurgitation.\nTricuspid Valve ( TV ) : Normal cusps.\nPulmonary Valve ( PV ) : Pulmonary annulus & its branches are normal.\nIAS ( Interatrial Septum ) : Intact.\nIVS ( Interventricular Septum ) : Intact.\nPericardium : No effusion.\nLA / LVA Clot : None.",
    impression: ["Mild aortic regurgitation."],
  }),
  P({
    key: "echo-as", organ: "echo-valves", label: "Aortic Stenosis — calcified", category: "Valves",
    text: "Mitral Valve ( MV ) : The AML show normal cusps thickness and excursion, no calcification, no doming.\nAortic Valve ( AoV ) : Aortic valve is thickened and calcified with restricted opening. Peak gradient across the valve is {grad} mm Hg. Colour Doppler shows aortic stenosis with mild aortic regurgitation.\nTricuspid Valve ( TV ) : Normal cusps.\nPulmonary Valve ( PV ) : Pulmonary annulus & its branches are normal.\nIAS ( Interatrial Septum ) : Intact.\nIVS ( Interventricular Septum ) : Intact.\nPericardium : No effusion.\nLA / LVA Clot : None.",
    impression: ["Calcific aortic stenosis with peak gradient {grad} mm Hg."],
    vars: [V("grad", "Peak gradient", "mm Hg")],
  }),
  P({
    key: "echo-tr", organ: "echo-valves", label: "Tricuspid Regurgitation — Mild", category: "Valves",
    text: "Mitral Valve ( MV ) : The AML show normal cusps thickness and excursion, no calcification, no doming.\nAortic Valve ( AoV ) : Normal thickness & excursions.\nTricuspid Valve ( TV ) : Normal cusps. Colour Doppler shows mild tricuspid regurgitation.\nPulmonary Valve ( PV ) : Pulmonary annulus & its branches are normal.\nIAS ( Interatrial Septum ) : Intact.\nIVS ( Interventricular Septum ) : Intact.\nPericardium : No effusion.\nLA / LVA Clot : None.",
    impression: ["Mild tricuspid regurgitation."],
  }),
  P({
    key: "echo-pericardial-effusion", organ: "echo-valves", label: "Pericardial Effusion", category: "Valves",
    text: "Mitral Valve ( MV ) : The AML show normal cusps thickness and excursion, no calcification, no doming.\nAortic Valve ( AoV ) : Normal thickness & excursions.\nTricuspid Valve ( TV ) : Normal cusps.\nPulmonary Valve ( PV ) : Pulmonary annulus & its branches are normal.\nIAS ( Interatrial Septum ) : Intact.\nIVS ( Interventricular Septum ) : Intact.\nPericardium : Mild pericardial effusion.\nLA / LVA Clot : None.",
    impression: ["Mild pericardial effusion."],
  }),

  // ── ECHOCARDIOGRAPHY — other findings (organ "echo-others") ─────────────────
  P({
    key: "echo-lvh", organ: "echo-others", label: "LV Wall Hypertrophy", category: "Findings",
    text: "Mildly hypertrophied LV wall.\nSitus solitus, normal atrioventricular & ventriculo-arterial drainage with left sided aortic arch.\nNo PDA / ASD / VSD.\nNormal pulmonary trunk & its branches.\nNo chamber clot / valvular vegetations.",
    impression: ["Mildly hypertrophied LV wall."],
  }),
  P({
    key: "echo-dilated-cavities", organ: "echo-others", label: "Dilated LV & LA Cavities", category: "Findings",
    text: "Mildly dilated LV & LA cavities.\nSitus solitus, normal atrioventricular & ventriculo-arterial drainage with left sided aortic arch.\nNo PDA / ASD / VSD.\nNormal pulmonary trunk & its branches.\nNo chamber clot / valvular vegetations.",
    impression: ["Mildly dilated LV & LA cavities."],
  }),
  P({
    key: "echo-lv-dysfunction", organ: "echo-others", label: "LV Dysfunction", category: "Findings",
    text: "LV systolic function is reduced ( LVEF {lvef} % ).\nSitus solitus, normal atrioventricular & ventriculo-arterial drainage with left sided aortic arch.\nNo PDA / ASD / VSD.\nNormal pulmonary trunk & its branches.\nNo chamber clot / valvular vegetations.",
    impression: ["LV dysfunction ( LVEF {lvef} % )."],
    vars: [V("lvef", "LVEF", "%")],
  }),
  P({
    key: "echo-dcm", organ: "echo-others", label: "Dilated Cardiomyopathy", category: "Findings",
    text: "Mildly dilated LV & LA cavities with reduced LV systolic function ( LVEF {lvef} % ). Global hypokinesia of LV walls.\nSitus solitus, normal atrioventricular & ventriculo-arterial drainage with left sided aortic arch.\nNo PDA / ASD / VSD.\nNo chamber clot / valvular vegetations.",
    impression: ["Dilated cardiomyopathy with LV dysfunction ( LVEF {lvef} % )."],
    vars: [V("lvef", "LVEF", "%")],
  }),
  P({
    key: "echo-asd", organ: "echo-others", label: "Atrial Septal Defect", category: "Findings",
    text: "A large atrial septal defect ({d1} cm).\nViscero atrial situs solitus.\nAV and VA concordance.\nNormally related great arteries.\nNormal pulmonary trunk & its branches.",
    impression: ["Atrial septal defect ({d1} cm)."],
    vars: [V("d1", "ASD size")],
  }),
  P({
    key: "echo-vsd", organ: "echo-others", label: "Ventricular Septal Defect", category: "Findings",
    text: "Sub aortic perimembranous VSD ({d1} cm).\nViscero atrial situs solitus.\nAV and VA concordance.\nNormally related great arteries.\nNormal pulmonary trunk & its branches.",
    impression: ["Ventricular septal defect ({d1} cm)."],
    vars: [V("d1", "VSD size")],
  }),

  // ── LIMB DOPPLER — lower limbs (organs arterial / venous / subcut) ─────────
  P({
    key: "ll-arterial-calcification", organ: "arterial", label: "Femoral Wall Calcification", category: "Arterial",
    text: "Wall of the femoral artery shows circumferential calcification without any decrease of lumen. Rest of the arteries shows normal diameter with normal blood flow and triphasic spectral waveform. Popliteal artery with its divisions shows normal flow pattern and peak systolic velocity. Dorsalis pedis artery shows normal flow pattern.",
    impression: ["Arterial wall calcification without significant luminal narrowing."],
  }),
  P({
    key: "ll-arterial-occlusion", organ: "arterial", label: "Arterial Occlusion — one limb", category: "Arterial",
    text: "No colour flow could be demonstrated in the {side} femoral, popliteal and tibial arteries on colour Doppler and power Doppler scan. Spectral waveform is absent. Few collateral vessels are seen in the {side} thigh. Other side arteries show normal flow pattern with triphasic spectral waveform.",
    impression: ["Occlusion of {side} lower limb arteries."],
    vars: [VS()],
  }),
  P({
    key: "ll-arterial-monophasic", organ: "arterial", label: "Monophasic Waveform — one limb", category: "Arterial",
    text: "{Side} lower limb arteries show monophasic spectral waveform with reduced peak systolic velocity. Wall of the arteries shows no calcification or plaque. Other side arteries show normal triphasic spectral waveform.",
    impression: ["Monophasic waveform in {side} lower limb arteries S/O proximal flow limiting stenosis."],
    vars: [VS()],
  }),
  P({
    key: "ll-venous-dvt", organ: "venous", label: "DVT — one limb", category: "Venous",
    text: "Deep veins of the {side} lower limb are dilated and non-compressible with echogenic thrombus seen within. Augmentation test on {side} side was negative. Loss of phasicity is seen. No colour flow fill-in seen on compression. Other side deep veins show normal diameter having normal phasicity with normal compressibility.",
    impression: ["Deep vein thrombosis of {side} lower limb."],
    suggestions: ["Follow up Doppler study."],
    vars: [VS()],
  }),
  P({
    key: "ll-venous-varicose", organ: "venous", label: "Varicose Veins — one limb", category: "Venous",
    text: "{Side} long saphenous vein is dilated and tortuous with saphenofemoral incompetence on Valsalva. Perforators are seen on the {side} calf. Deep veins of the {side} lower limb show normal diameter having normal phasicity. Vessels compressibility is normal. No evidence of deep vein thrombosis is seen.",
    impression: ["Varicose veins of {side} lower limb with saphenofemoral incompetence."],
    vars: [VS()],
  }),
  P({
    key: "ll-subcut-edema", organ: "subcut", label: "Subcutaneous Edema", category: "Others",
    text: "Mild subcutaneous edema is seen in the lower limbs.",
    impression: ["Mild subcutaneous edema in the lower limbs."],
  }),
  P({
    key: "ll-subcut-cellulitis", organ: "subcut", label: "Cellulitis — one limb", category: "Others",
    text: "Subcutaneous tissue of the {side} lower limb is thickened, echogenic and inflammed. Colour Doppler shows mildly increased vascularity. Underlying muscles are normal in echogenicity.",
    impression: ["Cellulitis of {side} lower limb."],
    vars: [VS()],
  }),

  // ── LIMB DOPPLER — upper limbs ──────────────────────────────────────────────
  P({
    key: "ul-venous-dvt", organ: "venous", label: "DVT — one arm", category: "Venous",
    text: "Deep veins of the {side} upper limb are dilated and non-compressible with echogenic thrombus seen within. Augmentation test on {side} side was negative. No colour flow fill-in seen on compression. Other side deep veins show normal diameter having normal phasicity with normal compressibility.",
    impression: ["Deep vein thrombosis of {side} upper limb."],
    suggestions: ["Follow up Doppler study."],
    vars: [VS()],
  }),
  P({
    key: "ul-superficial-thrombophlebitis", organ: "venous", label: "Superficial Thrombophlebitis", category: "Venous",
    text: "{Side} cephalic vein is dilated and thrombosed. No flow could be seen on colour Doppler or power Doppler, upto the {side} elbow joint. There is mild surrounding inflammatory changes. Deep veins of the {side} upper limb show normal phasicity and compressibility.",
    impression: ["Superficial thrombophlebitis of {side} cephalic vein."],
    vars: [VS()],
  }),
  P({
    key: "ul-arterial-occlusion", organ: "arterial", label: "Radial Artery Occlusion", category: "Arterial",
    text: "No colour flow could be demonstrated in the {side} radial artery on colour Doppler and power Doppler scan. {Side} ulnar artery and palmar arch show normal flow pattern with compensatory increased flow. Brachial artery shows normal triphasic spectral waveform.",
    impression: ["Occlusion of {side} radial artery."],
    vars: [VS()],
  }),
  P({
    key: "ul-subcut-edema", organ: "subcut", label: "Subcutaneous Edema", category: "Others",
    text: "Mild subcutaneous edema is seen in the upper limbs.",
    impression: ["Mild subcutaneous edema in the upper limbs."],
  }),
  P({
    key: "ul-subcut-cellulitis", organ: "subcut", label: "Cellulitis — one arm", category: "Others",
    text: "Subcutaneous tissue of the {side} upper limb is thickened, echogenic and inflammed. Colour Doppler shows mildly increased vascularity. Underlying muscles are normal in echogenicity.",
    impression: ["Cellulitis of {side} upper limb."],
    vars: [VS()],
  }),

  // ── CAROTID DOPPLER (shared organ "carotid", {side}/{Side}) ─────────────────
  P({
    key: "carotid-plaque", organ: "carotid", label: "CCA Plaque — % narrowing", category: "Carotid",
    text: "{Side} common carotid artery shows eccentric atherosclerotic plaque with luminal narrowing of about {percent} %. Rest of the wall shows normal echogenicity. Colour Doppler shows flow across the plaque with peak systolic velocity of {psv} cm/s. {Side} ICA and ECA show normal flow pattern and peak systolic velocity.",
    impression: ["Atherosclerotic plaque in {side} common carotid artery with about {percent} % luminal narrowing."],
    vars: [V("percent", "Narrowing", "%"), V("psv", "PSV", "cm/s")],
  }),
  P({
    key: "carotid-ica-stenosis", organ: "carotid", label: "ICA Stenosis — significant", category: "Carotid",
    text: "{Side} internal carotid artery shows atherosclerotic plaque with significant luminal narrowing. Peak systolic velocity is {psv} cm/s and end diastolic velocity is {edv} cm/s. Colour Doppler shows aliasing and turbulent flow with spectral broadening at the stenotic segment.",
    impression: ["Significant stenosis of {side} internal carotid artery ( PSV {psv} cm/s )."],
    vars: [V("psv", "PSV", "cm/s"), V("edv", "EDV", "cm/s")],
  }),
  P({
    key: "carotid-ica-occlusion", organ: "carotid", label: "ICA Occlusion", category: "Carotid",
    text: "No colour flow could be demonstrated in the {side} internal carotid artery on colour Doppler and power Doppler scan. {Side} common carotid artery shows high resistance flow pattern with low diastolic flow. {Side} ECA shows compensatory increased flow.",
    impression: ["Occlusion of {side} internal carotid artery."],
  }),
  P({
    key: "carotid-intimal", organ: "carotid", label: "Intimal Thickening", category: "Carotid",
    text: "{Side} common carotid artery shows mild intimal thickening with no significant plaque or luminal narrowing. Colour Doppler shows normal flow pattern with triphasic spectral waveform.",
    impression: ["Mild intimal thickening of {side} common carotid artery."],
  }),
  P({
    key: "carotid-vertebral-reversal", organ: "carotid", label: "Vertebral Flow Reversal", category: "Carotid",
    text: "{Side} vertebral artery shows reversed ( retrograde ) flow direction. {Side} subclavian artery shows high velocity flow proximal to the vertebral origin. Basilar artery shows normal flow direction.",
    impression: ["Reversed flow in {side} vertebral artery S/O {side} subclavian steal phenomenon."],
  }),

  // ── CHEST — pleura level (shared organ "pleura", {side}/{Side}) ─────────────
  P({
    key: "pleura-effusion-mild", organ: "pleura", label: "Pleural Effusion — Mild", category: "Pleura",
    text: "{Side} pleural cavity shows mild anechoic collection with no septation. Underlying collapsed lung is not seen. No pleural thickening or nodule seen.",
    impression: ["{Side} mild pleural effusion."],
  }),
  P({
    key: "pleura-effusion-moderate", organ: "pleura", label: "Pleural Effusion — Moderate", category: "Pleura",
    text: "{Side} pleural cavity shows moderate anechoic collection. The underlying lung shows mild collapse with compressed lower lobe floating within the collection. No septation seen.",
    impression: ["{Side} moderate pleural effusion with mild collapse of underlying lung."],
    suggestions: ["X-Ray Chest PA View"],
  }),
  P({
    key: "pleura-effusion-gross", organ: "pleura", label: "Pleural Effusion — Gross", category: "Pleura",
    text: "{Side} pleural cavity shows gross anechoic collection with complete collapse of the underlying lung. The mediastinum is pushed to the opposite side.",
    impression: ["{Side} gross pleural effusion with complete collapse of underlying lung."],
    suggestions: ["X-Ray Chest PA View"],
  }),
  P({
    key: "pleura-empyema", organ: "pleura", label: "Empyema — septated", category: "Pleura",
    text: "{Side} pleural cavity shows collection with multiple thick septa and internal echoes and debris within. Underlying lung shows collapse with thickened pleura.",
    impression: ["{Side} pleural collection with multiple septa and debris S/O Empyema."],
    suggestions: ["X-Ray Chest PA View"],
  }),
  P({
    key: "pleura-thickening", organ: "pleura", label: "Pleural Thickening", category: "Pleura",
    text: "{Side} pleura is thickened and echogenic with no significant effusion. Lung sliding ( gliding sign ) is reduced. No pleural mass or nodule seen.",
    impression: ["{Side} pleural thickening."],
  }),
  P({
    key: "pleura-consolidation", organ: "pleura", label: "Consolidation + Collapse", category: "Pleura",
    text: "Ultrasound of {side} lung base shows echogenic consolidated lung with irregular margin and air bronchograms within. Colour Doppler shows normal branching pattern of pulmonary vessels within. Underlying diaphragm movements are reduced.",
    impression: ["Consolidation with collapse of {side} lower lobe."],
    suggestions: ["X-Ray Chest PA View"],
  }),
  P({
    key: "pleura-nodule", organ: "pleura", label: "Pleural Mass / Nodule", category: "Pleura",
    text: "A well defined hypoechoic nodular lesion ({d1} x {d2} cm) arising from the {side} visceral pleura with tip of the iceberg sign. Colour Doppler shows increased vascularity within.",
    impression: ["A pleural based nodular lesion in {side} pleural cavity."],
    vars: [V("d1", "Lesion L"), V("d2", "Lesion W")],
  }),

  // ── CHEST — wall & others ───────────────────────────────────────────────────
  P({
    key: "chest-wall-cellulitis", organ: "chest-wall", label: "Chest Wall Cellulitis", category: "Chest wall",
    text: "Subcutaneous tissue of the chest wall at the {site} is thickened, echogenic and inflammed S/O Cellulitis. No collection seen.",
    impression: ["Cellulitis of chest wall at the {site}."],
    vars: [{ key: "site", label: "Site (e.g. right lower chest)", unit: "" }],
  }),
  P({
    key: "chest-wall-abscess", organ: "chest-wall", label: "Chest Wall Abscess", category: "Chest wall",
    text: "A well defined subcutaneous hypoechoic collection ({d1} x {d2} cm) with fine internal echoes and surrounding fat stranding in the {site} of chest wall S/O Abscess with Cellulitis.",
    impression: ["Subcutaneous abscess with cellulitis in {site} of chest wall."],
    vars: [V("d1", "Collection L"), V("d2", "Collection W"), { key: "site", label: "Site (e.g. right lower chest)", unit: "" }],
  }),
  P({
    key: "chest-pericardial-effusion", organ: "chest-others", label: "Pericardial Effusion — Mild", category: "Others",
    text: "Mild collection is seen in pericardial cavity. Cardiac activity is normal. Bilateral pleural cavities are clear.",
    impression: ["Mild pericardial effusion."],
    suggestions: ["Echocardiography."],
  }),
  P({
    key: "chest-pericardial-effusion-gross", organ: "chest-others", label: "Pericardial Effusion — Gross", category: "Others",
    text: "Gross collection in pericardial cavity. Prominent hepatic veins and inferior vena cava ( congestive features ).",
    impression: ["Gross pericardial effusion.", "F/S/O Cardiac failure."],
    suggestions: ["Echocardiography."],
  }),
  P({
    key: "chest-others-nodes", organ: "chest-others", label: "Mediastinal Lymphadenopathy", category: "Others",
    text: "Multiple enlarged mediastinal and perihilar lymph nodes are seen ( largest {d1} x {d2} cm ).",
    impression: ["Mediastinal lymphadenopathy."],
    suggestions: ["X-Ray Chest PA View"],
    vars: [V("d1", "Largest L"), V("d2", "Largest W")],
  }),

  // ── CRANIUM (transfontanelle) ───────────────────────────────────────────────
  P({
    key: "cranium-hydro-mild", organ: "ventricles", label: "Hydrocephalus — Mild", category: "Ventricles",
    text: "Both lateral ventricles are mildly dilated with mild prominence of the occipital horns. Atrial width measures {w} mm. Third ventricle is normal. Fourth ventricle is normal.",
    impression: ["Mild hydrocephalus ( bilateral lateral ventricular dilatation )."],
    vars: [V("w", "Atrial width", "mm")],
  }),
  P({
    key: "cranium-hydro-moderate", organ: "ventricles", label: "Hydrocephalus — Moderate", category: "Ventricles",
    text: "Both lateral ventricles are moderately dilated with rounding of the frontal horns. Atrial width measures {w} mm. Third ventricle is also dilated. Extra-axial CSF spaces are reduced.",
    impression: ["Moderate hydrocephalus."],
    vars: [V("w", "Atrial width", "mm")],
  }),
  P({
    key: "cranium-hydro-gross", organ: "ventricles", label: "Hydrocephalus — Gross", category: "Ventricles",
    text: "Both lateral ventricles are grossly dilated with thinning of the cerebral mantle. Third ventricle is dilated. Extra-axial CSF spaces are obliterated.",
    impression: ["Gross hydrocephalus with thinning of cerebral mantle."],
    suggestions: ["Neurology / Paediatric consultation"],
  }),
  P({
    key: "cranium-subdural", organ: "midline", label: "Subdural Collection", category: "Midline",
    text: "Anechoic collection is seen in the subdural space over the {side} cerebral hemisphere ({d1} mm maximum depth) with widening of the interhemispheric fissure. Midline structures show mild shift to the opposite side. Cerebellum and posterior fossa appear normal.",
    impression: ["{Side} subdural collection with mild midline shift."],
    vars: [VS("Side (right/left)"), V("d1", "Max depth", "mm")],
  }),
  P({
    key: "cranium-pvl", organ: "parenchyma", label: "Periventricular Echogenicity (PVL)", category: "Parenchyma",
    text: "Increased periventricular echogenicity is seen in bilateral periventricular regions ( {side} more ) with no obvious cystic change. Rest of the parenchyma shows normal echogenicity.",
    impression: ["Bilateral periventricular echogenicity S/O periventricular leukomalacia changes."],
    vars: [VS("Side (right/left)")],
  }),
  P({
    key: "cranium-ivh", organ: "ventricles", label: "Intraventricular Haemorrhage", category: "Ventricles",
    text: "Echogenic material is seen within the {side} lateral ventricle with mild ventricular dilatation. Rest of the ventricular system is normal.",
    impression: ["Intraventricular haemorrhage {side} side ( Grade II )."],
    suggestions: ["Follow up cranial ultrasound"],
    vars: [VS("Side (right/left)")],
  }),

  // ── ORBIT — globe level (shared organ "globe", {side}/{Side}) ───────────────
  P({
    key: "orbit-vitreous-opacity", organ: "globe", label: "Vitreous Opacity", category: "Globe",
    text: "{Side} vitreous shows low level echogenic debris and echoes S/O vitreous opacity. No foreign body seen. Retina is in position.",
    impression: ["Vitreous opacity in {side} eye."],
  }),
  P({
    key: "orbit-vitreous-haemorrhage", organ: "globe", label: "Vitreous Haemorrhage", category: "Globe",
    text: "{Side} vitreous shows echogenic haemorrhage with layering and membranous strands. No foreign body seen. Retina is in position.",
    impression: ["Vitreous haemorrhage in {side} eye."],
  }),
  P({
    key: "orbit-retinal-detachment", organ: "globe", label: "Retinal Detachment", category: "Globe",
    text: "{Side} retina shows detachment with a thin echogenic membrane floating in the vitreous with insertions at the optic disc and ora serrata. Subretinal fluid is seen.",
    impression: ["{Side} retinal detachment with subretinal fluid."],
  }),
  P({
    key: "orbit-foreign-body", organ: "globe", label: "Intraocular Foreign Body", category: "Globe",
    text: "A highly echogenic focus ({d1} mm) with distal acoustic shadowing is seen in the {side} vitreous S/O intraocular foreign body. Surrounding vitreous shows echogenic debris.",
    impression: ["Intraocular foreign body in {side} eye."],
    vars: [V("d1", "FB size", "mm")],
  }),
  P({
    key: "orbit-retinoblastoma", organ: "globe", label: "Intraocular Mass — ? Retinoblastoma", category: "Globe",
    text: "A well defined intraocular mass ({d1} x {d2} cm) with dense calcification and acoustic shadowing is seen arising from the {side} retina. Colour Doppler shows increased vascularity within the mass.",
    impression: ["Intraocular calcified mass in {side} eye ? Retinoblastoma."],
    suggestions: ["CT orbit / MRI orbit", "Paediatric ophthalmology opinion"],
    vars: [V("d1", "Mass L"), V("d2", "Mass W")],
  }),
  P({
    key: "optic-thickening", organ: "optic", label: "Optic Nerve Thickening", category: "Nerve",
    text: "The {side} optic nerve shows increased diameter ({d1} mm) with increased echogenicity. No nerve sheath collection seen. Retrobulbar space is normal.",
    impression: ["Thickened {side} optic nerve."],
    vars: [VS("Side (right/left)"), V("d1", "Nerve diameter", "mm")],
  }),

  // ── SWELLING / SOFT TISSUE (organ keys: lesion / skin / deep) ───────────────
  P({
    key: "swelling-lipoma", organ: "lesion", label: "Lipoma", category: "Swelling",
    text: "HRSG shows bulky subcutaneous tissue at the {site}. An ill defined lesion ({d1} x {d2} cm), isoechoic to the subcutaneous fat is visualised S/O ? Lipoma. No internal vascularity could be demonstrated both on the colour Doppler and power Doppler scan.",
    impression: ["An ill defined lesion isoechoic to the subcutaneous fat at the {site} S/O ? Lipoma."],
    suggestions: ["FNAC"],
    vars: [{ key: "site", label: "Site (e.g. anterior left thigh)", unit: "" }, V("d1", "Lesion L"), V("d2", "Lesion W")],
  }),
  P({
    key: "swelling-abscess", organ: "lesion", label: "Abscess with Cellulitis", category: "Swelling",
    text: "A well defined hypoechoic collection ({d1} x {d2} cm) with fine internal echoes and surrounding fat stranding in the {site} S/O Abscess with Cellulitis. No internal vascularity could be demonstrated. However mild peripheral vascularity is seen.",
    impression: ["Abscess with cellulitis in the {site}."],
    suggestions: ["Follow up scan / FNAC"],
    vars: [{ key: "site", label: "Site (e.g. right periumbilical region)", unit: "" }, V("d1", "Collection L"), V("d2", "Collection W")],
  }),
  P({
    key: "swelling-collection-mixed", organ: "lesion", label: "Mixed Echoic Collection", category: "Swelling",
    text: "There is evidence of an elongated fusiform mixed echoic collection ({d1} x {d2} cm) at the {site} just deep to the subcutaneous layer. No internal vascularity could be demonstrated both on the colour Doppler and power Doppler scan. However mild peripheral vascularity is seen.",
    impression: ["Mixed echoic collection at the {site} S/O organised haematoma / abscess."],
    vars: [{ key: "site", label: "Site (e.g. lateral right thigh)", unit: "" }, V("d1", "Collection L"), V("d2", "Collection W")],
  }),
  P({
    key: "swelling-haemangioma", organ: "lesion", label: "Haemangioma", category: "Swelling",
    text: "HRSG shows an ill defined superficial lesion with multiple dilated serpentine structures (vessels) within at the {site} of size ({d1} x {d2} cm). Color doppler shows dilated vessels filled with blood. The vessels are very clear on power doppler.",
    impression: ["Haemangioma at the {site}."],
    suggestions: ["Angiography."],
    vars: [{ key: "site", label: "Site (e.g. left cheek)", unit: "" }, V("d1", "Lesion L"), V("d2", "Lesion W")],
  }),
  P({
    key: "swelling-cysticercosis", organ: "lesion", label: "Cysticercosis — muscle", category: "Swelling",
    text: "There is evidence of a well defined cystic lesion ({d1} x {d2} cm), with central echogenic nidus, at the {site} within the muscle. Colour doppler shows peripheral vascularity.",
    impression: ["A well defined cystic lesion with central echogenic nidus in the muscle at the {site}.", "D/D Myocysticercosis."],
    vars: [{ key: "site", label: "Site (e.g. lateral right arm)", unit: "" }, V("d1", "Lesion L"), V("d2", "Lesion W")],
  }),
  P({
    key: "swelling-lymph-nodes", organ: "lesion", label: "Enlarged Lymph Nodes", category: "Swelling",
    text: "Few enlarged lymph nodes are seen in the {site} ( largest {d1} x {d2} cm ). Cortex is thickened with maintained echotexture. Colour Doppler shows increased vascularity.",
    impression: ["Enlarged lymph nodes in the {site}."],
    suggestions: ["FNAC"],
    vars: [{ key: "site", label: "Site (e.g. right inguinal region)", unit: "" }, V("d1", "Largest L"), V("d2", "Largest W")],
  }),
  P({
    key: "swelling-mass", organ: "lesion", label: "Soft Tissue Mass — ? Lipoma", category: "Swelling",
    text: "A well defined large homogeneous mass ({d1} x {d2} cm) at the {site}. Its echogenicity is similar to that of subcutaneous fat. The mass is superficial and not invading the deeper structures. No internal vascularity could be demonstrated both on the colour Doppler and power Doppler scan.",
    impression: ["A well defined large homogeneous mass at the {site} S/O ? Lipoma / soft tissue tumour."],
    suggestions: ["FNAC."],
    vars: [{ key: "site", label: "Site (e.g. anterior wall of right axilla)", unit: "" }, V("d1", "Mass L"), V("d2", "Mass W")],
  }),
  P({
    key: "swelling-hernia-umbilical", organ: "lesion", label: "Hernia — Umbilical / Periumbilical", category: "Hernia",
    text: "A well defined anterior abdominal wall defect ({d1} cm) in {site} region. S/o- Hernia. Cough reflux is positive. Content is omentum. No probe tenderness.",
    impression: ["{Site} hernia."],
    vars: [V("d1", "Defect size"), { key: "site", label: "Site (e.g. periumbilical)", unit: "" }],
  }),
  P({
    key: "swelling-hernia-incisional", organ: "lesion", label: "Hernia — Incisional", category: "Hernia",
    text: "A well defined anterior abdominal wall defect ({d1} cm) at the {site} surgical scar. Cough reflux is positive. Content is bowel loops and omentum. S/o - Incisional Hernia.",
    impression: ["Incisional hernia at the {site} scar site."],
    vars: [V("d1", "Defect size"), { key: "site", label: "Site (e.g. lower midline)", unit: "" }],
  }),
  P({
    key: "swelling-hernia-irreducible", organ: "lesion", label: "Hernia — Irreducible / Obstructed", category: "Hernia",
    text: "A well defined anterior abdominal wall defect ({d1} cm) in the {site} region. Omentum and peritoneal fluid are the content. Probe tenderness is strongly positive. S/o - Irreducible / Obstructed hernia.",
    impression: ["{Site} irreducible / obstructed hernia."],
    vars: [V("d1", "Defect size"), { key: "site", label: "Site (e.g. supraumbilical)", unit: "" }],
  }),
  P({
    key: "swelling-hernia-inguinal", organ: "lesion", label: "Hernia — Inguinal", category: "Hernia",
    text: "Swelling in {side} inguinal region containing bowel loops & mild anechoic collection. Bilateral testis are in their respective scrotal sac. Cough reflux is positive.",
    impression: ["{Side} inguinal hernia."],
    vars: [VS()],
  }),
  P({
    key: "swelling-skin-cellulitis", organ: "skin", label: "Cellulitis — subcutaneous", category: "Skin",
    text: "Oedematous subcutaneous tissue at the {site} S/o Cellulitis. Colour Doppler shows mildly increased vascularity.",
    impression: ["Oedematous subcutaneous tissue at the {site} S/o Cellulitis."],
    vars: [{ key: "site", label: "Site (e.g. right upper quadrant)", unit: "" }],
  }),
  P({
    key: "swelling-deep-muscle-bulky", organ: "deep", label: "Bulky Muscle — strain/myositis", category: "Deep",
    text: "The muscle at the {site} is bulky and heterogeneous with mild increase in echogenicity. No collection or liquefaction seen. Colour Doppler shows normal vascularity. The underlying bone is normal.",
    impression: ["Bulky muscle at the {site} S/O muscle strain / myositis changes."],
    vars: [{ key: "site", label: "Site (e.g. medial right thigh)", unit: "" }],
  }),
];
