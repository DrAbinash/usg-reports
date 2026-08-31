/**
 * USG Studio — builtin pathology quick-select catalog.
 *
 * Every entry is the doctor's own preferred wording, curated verbatim from the
 * USG format library (formats-usg corpus). Selecting an entry replaces ONLY
 * its organ's finding — the rest of the normal scaffold stays untouched — and
 * contributes its impression line(s). {tokens} are fill-in measurement slots.
 *
 * Dr Sugandha can add her own entries in the UI (persisted to the
 * UsgPathology table); this file is the immutable builtin set.
 */
import type { UsgPathologyDef, UsgVarDef } from "./types";

const V = (key: string, label: string, unit = "cm"): UsgVarDef => ({ key, label, unit });

const P = (p: Omit<UsgPathologyDef, "builtin">): UsgPathologyDef => ({ ...p, builtin: true });

export const USG_PATHOLOGIES: UsgPathologyDef[] = [
  // ── LIVER ────────────────────────────────────────────────────────────────
  P({
    key: "liver-fatty-g1", organ: "liver", label: "Fatty Liver — Gr I", category: "Liver",
    text: "Liver measures in mid-clavicular line {span} cm. Appears normal in morphology with mildly increased hepatic parenchymal echogenicity (Grade I Fatty Changes). No masses or focal pathology is noted. Intrahepatic biliary channels are not dilated. The portal vein is normal in appearance. It measures {pv} cm.",
    impression: ["Fatty infiltration of liver (Grade I)."],
    titleFragment: "grade i fatty changes",
    vars: [V("span", "Liver span (MCL)"), V("pv", "Portal vein")],
  }),
  P({
    key: "liver-hepatomegaly-fatty-g1", organ: "liver", label: "Hepatomegaly + Fatty Gr I", category: "Liver",
    text: "Liver is enlarged in size and measures in mid-clavicular line {span} cm. Appears normal in morphology with mildly increased hepatic parenchymal echogenicity (Grade I Fatty Changes). No masses or focal pathology is noted. Intrahepatic biliary channels are not dilated. The portal vein is normal in appearance. It measures {pv} cm.",
    impression: ["Hepatomegaly with fatty infiltration of liver (Grade I)."],
    titleFragment: "hepatomegaly with grade i fatty changes",
    vars: [V("span", "Liver span (MCL)"), V("pv", "Portal vein")],
  }),
  P({
    key: "liver-fatty-g2", organ: "liver", label: "Fatty Liver — Gr II", category: "Liver",
    text: "Liver measures in mid-clavicular line {span} cm. Shows moderately increased hepatic parenchymal echogenicity with mild attenuation and blurring of the portal vein radicles (Grade II fatty changes). No masses or focal pathology is noted. Intrahepatic biliary channels are not dilated.",
    impression: ["Grade II fatty changes of liver."],
    titleFragment: "grade ii fatty changes",
    vars: [V("span", "Liver span (MCL)")],
  }),
  P({
    key: "liver-coarse", organ: "liver", label: "Hepatomegaly + Coarse Echotexture", category: "Liver",
    text: "Liver is enlarged in size and measures in mid-clavicular line {span} cm. Appears coarse in hepatic parenchymal echogenicity. No masses or focal pathology is noted. Intrahepatic biliary channels are not dilated. The portal vein is normal in appearance. It measures {pv} cm.",
    impression: ["Hepatomegaly with coarse hepatic parenchymal echogenicity."],
    titleFragment: "hepatomegaly with coarse echotexture",
    vars: [V("span", "Liver span (MCL)"), V("pv", "Portal vein")],
  }),
  P({
    key: "liver-abscess", organ: "liver", label: "Liver Abscess", category: "Liver",
    text: "Liver is enlarged in size and measures in mid-clavicular line {span} cm. A well defined hypoechoic lesion ({d1} x {d2} cm) with thick irregular walls and internal debris is seen in the right lobe of liver, S/o Liver abscess. Rest of the hepatic parenchyma shows normal echogenicity. Intrahepatic biliary channels are not dilated.",
    impression: ["Hepatomegaly with a well defined hypoechoic lesion in the right lobe of liver S/o Liver abscess."],
    titleFragment: "liver abscess",
    vars: [V("span", "Liver span (MCL)"), V("d1", "Lesion L"), V("d2", "Lesion W")],
  }),
  P({
    key: "liver-hemangioma", organ: "liver", label: "Haemangioma", category: "Liver",
    text: "Liver appears normal in morphology and parenchymal echogenicity. A well defined hyperechoic lesion ({d1} x {d2} cm) with homogeneous echotexture is seen in the right lobe of liver, S/o Haemangioma. No masses or focal pathology elsewhere. Intrahepatic biliary channels are not dilated. The portal vein is normal in appearance.",
    impression: ["A well defined hyperechoic lesion in the right lobe of liver S/o Haemangioma."],
    titleFragment: "hepatic haemangioma",
    vars: [V("d1", "Lesion L"), V("d2", "Lesion W")],
  }),
  P({
    key: "liver-sol-mets", organ: "liver", label: "SOL / Metastasis", category: "Liver",
    text: "Liver is enlarged and measures in mid-clavicular line {span} cm. A large ill defined hypoechoic mass ({d1} x {d2} cm) occupying almost whole of the left lobe of liver. Multiple small hypoechoic lesions scattered in both lobes of liver. Intrahepatic biliary channels are not dilated. The portal vein is normal in appearance. It measures {pv} cm.",
    impression: ["Hepatomegaly with a large ill defined hypoechoic mass occupying almost whole of the left lobe of liver with multiple small hypoechoic lesions scattered in both lobes of liver.", "F/S/O Hepatic Ca with metastasis."],
    titleFragment: "hepatic sol with metastasis",
    suggestions: ["Suggested: CECT abdomen", "Suggested: FNAC"],
    vars: [V("span", "Liver span (MCL)"), V("d1", "Mass L"), V("d2", "Mass W"), V("pv", "Portal vein")],
  }),
  P({
    key: "liver-cysts-hydatid", organ: "liver", label: "Multiple Cysts (? Hydatid)", category: "Liver",
    text: "Liver is enlarged and measures in mid-clavicular line {span} cm. Appears normal in morphology. Smoothly marginated thin walled cystic lesions are seen predominantly in the right lobe of liver. Few fine echoes are seen within the cysts. No septations or solid components visualized.",
    impression: ["Hepatomegaly with multiple thin walled anechoic cysts in the right lobe of liver S/o ? Hydatid cyst."],
    titleFragment: "multiple hepatic cysts",
    vars: [V("span", "Liver span (MCL)")],
  }),
  P({
    key: "liver-ihbrd", organ: "liver", label: "Dilated IHBRD (Obstructive)", category: "Liver",
    text: "Liver measures in mid-clavicular line {span} cm. Appears normal in morphology and parenchymal echogenicity. No masses or focal pathology is noted. Intrahepatic biliary channels are dilated. The portal vein is normal in appearance. It measures {pv} cm.",
    impression: ["Dilated CBD and IHBRD."],
    titleFragment: "dilated ihbrd",
    vars: [V("span", "Liver span (MCL)"), V("pv", "Portal vein")],
  }),
  P({
    key: "liver-portal-cavernoma", organ: "liver", label: "Portal Cavernoma", category: "Liver",
    text: "Liver appears normal in morphology and parenchymal echogenicity. The portal vein measures {pv} cm. Dilated and tortuous vessels are seen at the portal confluence, S/o Portal cavernoma. Intrahepatic biliary channels are not dilated.",
    impression: ["Portal cavernoma."],
    titleFragment: "portal cavernoma",
    vars: [V("pv", "Portal vein")],
  }),

  // ── GALL BLADDER ─────────────────────────────────────────────────────────
  P({
    key: "gb-calculus", organ: "gb", label: "GB Calculus (Solitary)", category: "Gall Bladder",
    text: "Gall bladder is normal in physiological distension. A well defined echogenic structure ({size} cm) casting strong distal acoustic shadow is seen in the lumen of the gall bladder, suggestive of calculus. Wall thickness is normal. No pericholecystic collection. Sonographic Murphy's sign negative.",
    impression: ["Cholelithiasis."],
    titleFragment: "cholelithiasis",
    vars: [V("size", "Calculus size")],
  }),
  P({
    key: "gb-calculus-few", organ: "gb", label: "GB Calculus (Few)", category: "Gall Bladder",
    text: "Gall bladder is normal in physiological distension. Few well defined echogenic structures (largest {size} cm) casting strong distal acoustic shadow are seen in the lumen of the gall bladder, suggestive of calculi. Wall thickness is normal. No pericholecystic collection. Sonographic Murphy's sign negative.",
    impression: ["Cholelithiasis (Few calculi in GB lumen)."],
    titleFragment: "cholelithiasis",
    vars: [V("size", "Largest calculus")],
  }),
  P({
    key: "gb-calculus-impacted", organ: "gb", label: "Impacted Calculus (Neck)", category: "Gall Bladder",
    text: "Gall bladder is normal in physiological distension. An impacted well defined echogenic structure ({size} cm) casting strong distal acoustic shadow is seen at the neck of the gall bladder. GB wall is thickened. No pericholecystic collection. Sonographic Murphy's sign positive.",
    impression: ["Acute calculus cholecystitis — impacted calculus at the neck of GB."],
    titleFragment: "impacted gb calculus",
    vars: [V("size", "Calculus size")],
  }),
  P({
    key: "gb-cholecystitis", organ: "gb", label: "Cholecystitis (Wall Thickening)", category: "Gall Bladder",
    text: "Gall bladder is normal in physiological distension. No calculi are noted. GB wall is thickened and oedematous with maximum thickness of {wt} cm in the fundal region with positive sonographic Murphy's sign, S/o Cholecystitis. No pericholecystic collection.",
    impression: ["Cholecystitis."],
    titleFragment: "cholecystitis",
    vars: [V("wt", "Wall thickness")],
  }),
  P({
    key: "gb-polyp", organ: "gb", label: "GB Polyp", category: "Gall Bladder",
    text: "Gall bladder is normal in physiological distension. A small echogenic polyp attached to the anterior wall ({d1} x {d2} cm). No evidence of intraluminal calculus. Wall thickness is normal. No pericholecystic collection. Sonographic Murphy's sign negative.",
    impression: ["Gall bladder polyp."],
    titleFragment: "gall bladder polyp",
    vars: [V("d1", "Polyp L"), V("d2", "Polyp W")],
  }),
  P({
    key: "gb-contracted", organ: "gb", label: "Contracted GB", category: "Gall Bladder",
    text: "Gall bladder is contracted and wall is thickened. Lumen is almost completely collapsed. No pericholecystic collection.",
    impression: ["Contracted gall bladder."],
    titleFragment: "contracted gall bladder",
  }),

  // ── C.B.DUCT ─────────────────────────────────────────────────────────────
  P({
    key: "cbd-calculus", organ: "cbd", label: "CBD Calculus", category: "CBD",
    text: "C.B.D is dilated and measures {cbd} cm in diameter. A well defined echogenic focus ({size} cm) casting strong distal acoustic shadow is seen in the distal part of the C.B.D, S/o Choledocholithiasis.",
    impression: ["Dilated CBD with distal CBD calculus."],
    titleFragment: "choledocholithiasis",
    suggestions: ["Suggested: MRCP / ERCP"],
    vars: [V("cbd", "CBD diameter"), V("size", "Calculus size")],
  }),
  P({
    key: "cbd-dilated", organ: "cbd", label: "CBD Dilated", category: "CBD",
    text: "C.B.D is dilated and measures {cbd} cm in diameter. No evidence of intraluminal calculus. The most distal part of the C.B.D could not be evaluated due to overlying bowel gas.",
    impression: ["Dilated CBD."],
    titleFragment: "dilated cbd",
    vars: [V("cbd", "CBD diameter")],
  }),

  // ── PANCREAS ─────────────────────────────────────────────────────────────
  P({
    key: "pancreatitis-acute", organ: "pancreas", label: "Acute Pancreatitis", category: "Pancreas",
    text: "Pancreas appears bulky and heterogenous in echotexture with reduced parenchymal echogenicity. Peripancreatic fluid collection is seen. Pancreatic duct is not dilated.",
    impression: ["Acute pancreatitis."],
    titleFragment: "acute pancreatitis",
    suggestions: ["Suggested: S. Amylase / S. Lipase"],
  }),
  P({
    key: "pancreatitis-chronic", organ: "pancreas", label: "Chronic Pancreatitis", category: "Pancreas",
    text: "Pancreas appears reduced in size with increased parenchymal echogenicity and irregular outline. Pancreatic duct is dilated and measures {pd} cm, with evidence of intraductal calcification. No peripancreatic collection seen.",
    impression: ["Chronic pancreatitis with dilated pancreatic duct."],
    titleFragment: "chronic pancreatitis",
    vars: [V("pd", "Pancreatic duct")],
  }),

  // ── SPLEEN ───────────────────────────────────────────────────────────────
  P({
    key: "spleen-splenomegaly", organ: "spleen", label: "Splenomegaly", category: "Spleen",
    text: "Spleen is enlarged in size and measures {len} cm in length. Appears normal in morphology and parenchymal echogenicity. No evidence of focal lesion or S.O.L seen. No evidence of splenic collateral vessels.",
    impression: ["Splenomegaly."],
    titleFragment: "splenomegaly",
    vars: [V("len", "Spleen length")],
  }),
  P({
    key: "spleen-collaterals", organ: "spleen", label: "Splenomegaly + Collaterals", category: "Spleen",
    text: "Spleen is enlarged and measures {len} cm in length. Appears normal in morphology and parenchymal echogenicity. No evidence of focal lesion or S.O.L seen. Evidence of splenic collateral vessels is seen.",
    impression: ["Splenomegaly with splenic collateral vessels."],
    titleFragment: "splenomegaly with collaterals",
    vars: [V("len", "Spleen length")],
  }),

  // ── KIDNEYS (side-agnostic: {side} auto-fills Right/Left) ───────────────
  P({
    key: "kidney-calculus", organ: "kidney", label: "Renal Calculus", category: "Kidney",
    text: "{Side} kidney is normal in shape, size & position. A well defined echogenic focus ({size} cm) casting strong distal acoustic shadow is seen at the {loc} of the {side} kidney, S/o calculus. No hydronephrosis.",
    impression: ["{Side} nephrolithiasis ({size} cm calculus at the {loc})."],
    titleFragment: "{side} renal calculus",
    vars: [V("size", "Calculus size"), { key: "loc", label: "Location", unit: "calyx / pole" }],
  }),
  P({
    key: "kidney-calculus-multiple", organ: "kidney", label: "Renal Calculus (Multiple)", category: "Kidney",
    text: "{Side} kidney is normal in shape, size & position. There is evidence of few well defined echogenic foci (various sizes {s1}–{s2} cm), casting distal acoustic shadow S/o calculi in {side} kidney.",
    impression: ["{Side} nephrolithiasis (few calculi measuring {s1}–{s2} cm)."],
    titleFragment: "{side} nephrolithiasis",
    vars: [V("s1", "Smallest"), V("s2", "Largest")],
  }),
  P({
    key: "kidney-hydro-mild", organ: "kidney", label: "Hydronephrosis — Mild", category: "Kidney",
    text: "{Side} kidney is normal in shape, size & position. {Side} pelvicalyceal system is mildly dilated. No evidence of calculus, space occupying lesion or cyst is seen.",
    impression: ["{Side} mild hydronephrosis."],
    titleFragment: "{side} mild hydronephrosis",
  }),
  P({
    key: "kidney-hydro-mod", organ: "kidney", label: "Hydronephrosis — Moderate", category: "Kidney",
    text: "{Side} kidney is normal in shape & position. {Side} pelvicalyceal system is moderately dilated with thinning of renal parenchyma. No evidence of calculus or space occupying lesion is seen.",
    impression: ["{Side} moderate hydronephrosis."],
    titleFragment: "{side} moderate hydronephrosis",
  }),
  P({
    key: "kidney-hydro-gross", organ: "kidney", label: "Hydronephrosis — Gross", category: "Kidney",
    text: "{Side} kidney is enlarged in size. {Side} pelvicalyceal system is grossly dilated with thinning out of cortex. No evidence of calculus or space occupying lesion is seen.",
    impression: ["{Side} gross hydronephrosis with thinning out of cortex."],
    titleFragment: "{side} gross hydronephrosis",
  }),
  P({
    key: "kidney-cyst", organ: "kidney", label: "Simple Renal Cyst", category: "Kidney",
    text: "{Side} kidney is normal in shape, size & position. A well defined simple cyst ({d1} x {d2} cm) is seen at the {loc}. No evidence of calculus or hydronephrosis is seen.",
    impression: ["{Side} simple renal cortical cyst ({d1} x {d2} cm)."],
    titleFragment: "{side} renal cyst",
    vars: [V("d1", "Cyst L"), V("d2", "Cyst W"), { key: "loc", label: "Location", unit: "cortex / pole" }],
  }),
  P({
    key: "kidney-parapelvic-cyst", organ: "kidney", label: "Parapelvic Cyst", category: "Kidney",
    text: "{Side} kidney is normal in shape, size & position. A parapelvic cyst ({d1} x {d2} cm) is seen near the lower calyx of {side} kidney.",
    impression: ["{Side} parapelvic cyst (near the lower calyx)."],
    titleFragment: "{side} parapelvic cyst",
    vars: [V("d1", "Cyst L"), V("d2", "Cyst W")],
  }),
  P({
    key: "kidney-pckd", organ: "kidney", label: "Polycystic Kidneys", category: "Kidney",
    text: "{Side} kidney is enlarged in size and shows multiple cysts of varying sizes (largest {d1} x {d2} cm) replacing the renal parenchyma. No evidence of calculus or hydronephrosis is seen.",
    impression: ["{Side} polycystic kidney disease."],
    titleFragment: "{side} polycystic kidney",
    vars: [V("d1", "Largest cyst L"), V("d2", "Largest cyst W")],
  }),
  P({
    key: "kidney-parenchymal", organ: "kidney", label: "Renal Parenchymal Disease", category: "Kidney",
    text: "{Side} kidney is normal in shape & position. Increased renal parenchymal echogenicity with loss of cortico-medullary differentiation. No evidence of calculus, space occupying lesion, cyst or hydronephrosis is seen.",
    impression: ["Increased renal parenchymal echogenicity S/o Renal parenchymal disease."],
    titleFragment: "{side} renal parenchymal disease",
    suggestions: ["Suggested: Renal function test"],
  }),
  P({
    key: "kidney-ectopic", organ: "kidney", label: "Ectopic Kidney", category: "Kidney",
    text: "{Side} kidney is located ectopically in the {side} lower quadrant and is smaller in size.",
    impression: ["{Side} ectopic kidney located at {side} lower quadrant."],
    titleFragment: "{side} ectopic kidney",
  }),

  // ── URETERS ──────────────────────────────────────────────────────────────
  P({
    key: "ureter-calculus-distal", organ: "ureters", label: "Distal Ureteric Calculus", category: "Ureters",
    text: "A well defined echogenic focus ({size} cm), casting strong distal acoustic shadow is seen in {side} distal ureter. {Side} ureter is mildly dilated upto the calculus.",
    impression: ["{Side} distal ureteric calculus ({size} cm) with mild hydroureteronephrosis."],
    titleFragment: "{side} distal ureteric calculus",
    suggestions: ["Suggested: X-ray KUB"],
    vars: [V("size", "Calculus size")],
  }),
  P({
    key: "ureter-calculus-proximal", organ: "ureters", label: "Proximal Ureteric Calculus", category: "Ureters",
    text: "A well defined echogenic focus ({size} cm), casting strong distal acoustic shadow is seen in {side} proximal ureter. {Side} ureter is dilated upto the calculus.",
    impression: ["{Side} proximal ureteric calculus ({size} cm) with mild to moderate hydroureteronephrosis."],
    titleFragment: "{side} proximal ureteric calculus",
    suggestions: ["Suggested: X-ray KUB / IVU"],
    vars: [V("size", "Calculus size")],
  }),
  P({
    key: "ureter-calculus-vuj", organ: "ureters", label: "VUJ Calculus", category: "Ureters",
    text: "A well defined echogenic focus ({size} cm), casting strong distal acoustic shadow is seen at the {side} vesico-ureteric junction. {Side} ureter is dilated upto the calculus.",
    impression: ["{Side} Vesico-ureteric junction calculus with mild hydroureteronephrosis."],
    titleFragment: "{side} vuj calculus",
    vars: [V("size", "Calculus size")],
  }),

  // ── URINARY BLADDER ──────────────────────────────────────────────────────
  P({
    key: "ub-calculus", organ: "ub", label: "UB Calculus", category: "Bladder",
    text: "Urinary bladder is normal in outline and distension. A well defined echogenic focus ({size} cm) casting strong distal acoustic shadow is seen in the urinary bladder, S/o calculus. No evidence of mass or diverticulum is seen. Insignificant post void residual urine.",
    impression: ["Vesical calculus."],
    titleFragment: "vesical calculus",
    vars: [V("size", "Calculus size")],
  }),
  P({
    key: "ub-cystitis", organ: "ub", label: "Thickened UB Wall / Cystitis", category: "Bladder",
    text: "Urinary bladder is normal in outline and distension. Thickened UB wall. No evidence of calculus, mass or diverticulum is seen. Insignificant post void residual urine.",
    impression: ["Thickened UB wall S/o Cystitis."],
    titleFragment: "cystitis",
  }),
  P({
    key: "ub-mass", organ: "ub", label: "UB Mass", category: "Bladder",
    text: "Urinary bladder is normally distended. There is evidence of well defined lobulated hyperechoic mass (measuring {d1} x {d2} x {d3} cm) arising from the postero-lateral UB wall, protruding into the lumen. There is no evidence of calcification or haemorrhage.",
    impression: ["A well defined lobulated hyperechoic mass arising from the postero-lateral UB wall and protruding into the lumen."],
    titleFragment: "bladder mass",
    vars: [V("d1", "Mass L"), V("d2", "Mass W"), V("d3", "Mass H")],
  }),
  P({
    key: "ub-pvru-significant", organ: "ub", label: "Significant PVRU", category: "Bladder",
    text: "Urinary bladder is normal in outline and distension. No evidence of calculus, mass or diverticulum is seen. Significant post void residual urine Vol — {pvru} cc.",
    impression: ["Significant post void residual urine vol — {pvru} cc."],
    titleFragment: "significant pvru",
    vars: [V("pvru", "PVRU", "cc")],
  }),

  // ── PROSTATE ─────────────────────────────────────────────────────────────
  P({
    key: "prostate-enlarged", organ: "prostate", label: "Prostatomegaly", category: "Prostate",
    text: "Prostate is enlarged in size. It measures {p1} x {p2} x {p3} cm, corresponding to {vol} gms. No evidence of focal lesion or S.O.L noted.",
    impression: ["Prostatomegaly ({vol} gms)."],
    titleFragment: "prostatomegaly",
    vars: [V("p1", "L", "cm"), V("p2", "W", "cm"), V("p3", "H", "cm"), V("vol", "Volume", "gms")],
  }),
  P({
    key: "prostate-median-lobe", organ: "prostate", label: "Prostatomegaly + Median Lobe", category: "Prostate",
    text: "Prostate is enlarged in size. It measures {p1} x {p2} x {p3} cm, corresponding to {vol} gms with enlarged median lobe protruding {ml} cm at the bladder base.",
    impression: ["Prostatomegaly with enlarged median lobe protruding {ml} cm at the bladder base."],
    titleFragment: "prostatomegaly with median lobe",
    suggestions: ["Suggested: Serum PSA"],
    vars: [V("p1", "L", "cm"), V("p2", "W", "cm"), V("p3", "H", "cm"), V("vol", "Volume", "gms"), V("ml", "Protrusion")],
  }),
  P({
    key: "prostate-calculus", organ: "prostate", label: "Prostatic Calculus", category: "Prostate",
    text: "Prostate is normal in size and echotexture. An echogenic focus casting distal acoustic shadow is seen in the region of prostatic urethra S/o ? Calculus.",
    impression: ["An echogenic focus casting distal acoustic shadow in the region of prostatic urethra S/o ? Calculus."],
    titleFragment: "prostatic calculus",
  }),

  // ── UTERUS ───────────────────────────────────────────────────────────────
  P({
    key: "uterus-bulky", organ: "uterus", label: "Bulky Uterus", category: "Uterus",
    text: "Uterus is bulky in size and shape & measures {u1} x {u2} x {u3} cm. The uterus is positioned in anteversion with normal endometrial thickness ({et} cm). No focal pathology or abnormalities of outline are noted. The cervical echo is normal.",
    impression: ["Bulky uterus with endometrial thickness {et} cm."],
    titleFragment: "bulky uterus",
    vars: [V("u1", "L", "cm"), V("u2", "W", "cm"), V("u3", "H", "cm"), V("et", "Endometrium")],
  }),
  P({
    key: "uterus-bulky-hetero", organ: "uterus", label: "Bulky + Heterogenous Myometrium", category: "Uterus",
    text: "Uterus is bulky in size & measures {u1} x {u2} x {u3} cm. The uterus is positioned in anteversion with normal endometrial thickness ({et} cm) with heterogenous myometrium. No focal pathology or abnormalities of outline are noted. The cervical echo is normal.",
    impression: ["Bulky uterus with heterogenous myometrium."],
    titleFragment: "bulky uterus with heterogenous myometrium",
    vars: [V("u1", "L", "cm"), V("u2", "W", "cm"), V("u3", "H", "cm"), V("et", "Endometrium")],
  }),
  P({
    key: "uterus-fibroid-subserosal", organ: "uterus", label: "Fibroid — Subserosal", category: "Uterus",
    text: "Uterus is bulky in size and shape & measures {u1} x {u2} x {u3} cm. There is evidence of an ill defined hyperechoic subserosal lesion (measuring {d1} x {d2} cm) arising from {loc} uterine wall suggestive of Fibroid. The cervical echo is normal.",
    impression: ["Bulky uterus with {loc} subserosal fibroid."],
    titleFragment: "{loc} subserosal fibroid",
    vars: [V("u1", "L", "cm"), V("u2", "W", "cm"), V("u3", "H", "cm"), V("d1", "Fibroid L"), V("d2", "Fibroid W"), { key: "loc", label: "Location", unit: "anterior / posterior" }],
  }),
  P({
    key: "uterus-fibroid-intramural", organ: "uterus", label: "Fibroid — Intramural", category: "Uterus",
    text: "Uterus is bulky in size and shape & measures {u1} x {u2} x {u3} cm. There is evidence of an ill defined hyperechoic intramural lesion (measuring {d1} x {d2} cm) in {loc} region, suggestive of Fibroid. The cervical echo is normal.",
    impression: ["Bulky uterus with {loc} intramural fibroid."],
    titleFragment: "{loc} intramural fibroid",
    vars: [V("u1", "L", "cm"), V("u2", "W", "cm"), V("u3", "H", "cm"), V("d1", "Fibroid L"), V("d2", "Fibroid W"), { key: "loc", label: "Location", unit: "fundal / anterior / posterior" }],
  }),
  P({
    key: "uterus-fibroid-submucous", organ: "uterus", label: "Fibroid — Submucous", category: "Uterus",
    text: "Uterus is bulky in size and shape & measures {u1} x {u2} x {u3} cm. A large well defined mass ({d1} x {d2} cm) isoechoic to the myometrium, is seen in the uterine cavity surrounded by mild collection, arising from the posterior wall of the uterus. The cervical echo is normal.",
    impression: ["Bulky uterus with submucous fibroid."],
    titleFragment: "submucous fibroid",
    vars: [V("u1", "L", "cm"), V("u2", "W", "cm"), V("u3", "H", "cm"), V("d1", "Fibroid L"), V("d2", "Fibroid W")],
  }),
  P({
    key: "uterus-fibroid-cervical", organ: "uterus", label: "Fibroid — Cervical", category: "Uterus",
    text: "Uterus is enlarged in size and measures {u1} x {u2} x {u3} cm. The uterus is positioned in anteversion with normal endometrial thickness ({et} cm). A well defined homogeneous mass (size {d1} x {d2} cm) arising from the anterior lip of cervix.",
    impression: ["A well defined homogenous mass arising from the anterior lip of cervix. S/o ? Fibroid."],
    titleFragment: "cervical fibroid",
    vars: [V("u1", "L", "cm"), V("u2", "W", "cm"), V("u3", "H", "cm"), V("et", "Endometrium"), V("d1", "Mass L"), V("d2", "Mass W")],
  }),
  P({
    key: "uterus-et-thick", organ: "uterus", label: "Thickened Endometrium", category: "Uterus",
    text: "Uterus is enlarged in size and measures {u1} x {u2} x {u3} cm. The uterus is positioned in anteversion, with thickened endometrium ({et} cm). Endometrial echotexture is heterogenous. No focal pathology or abnormalities of outline are noted. The cervical echo is normal.",
    impression: ["Bulky uterus with thickened endometrium. Endometrial echotexture is heterogenous."],
    titleFragment: "thickened endometrium",
    vars: [V("u1", "L", "cm"), V("u2", "W", "cm"), V("u3", "H", "cm"), V("et", "Endometrium")],
  }),
  P({
    key: "uterus-retroverted", organ: "uterus", label: "Retroverted Uterus", category: "Uterus",
    text: "Uterus is normal in size and shape & measures {u1} x {u2} x {u3} cm. The uterus is positioned in retroversion with normal endometrial thickness ({et} cm). No focal pathology or abnormalities of outline are noted. The cervical echo is normal.",
    impression: ["Retroverted uterus with endometrial thickness {et} cm."],
    titleFragment: "retroverted uterus",
    vars: [V("u1", "L", "cm"), V("u2", "W", "cm"), V("u3", "H", "cm"), V("et", "Endometrium")],
  }),

  // ── ADNEXA ───────────────────────────────────────────────────────────────
  P({
    key: "adnexa-cyst-simple", organ: "adnexa", label: "Simple Ovarian Cyst", category: "Adnexa",
    text: "Ovaries are normally positioned. A well defined cystic lesion ({d1} x {d2} cm) is seen in the {side} adnexal region arising from the {side} ovary.",
    impression: ["{Side} adnexal simple cyst."],
    titleFragment: "{side} ovarian cyst",
    vars: [V("d1", "Cyst L"), V("d2", "Cyst W"), { key: "side", label: "Side", unit: "right / left" }],
  }),
  P({
    key: "adnexa-cyst-complex", organ: "adnexa", label: "Complex Cyst (Septations)", category: "Adnexa",
    text: "A complex cyst ({d1} x {d2} cm) seen in the {side} adnexal region arising from {side} ovary with internal septation.",
    impression: ["{Side} adnexal complex cyst with internal septation."],
    titleFragment: "{side} complex ovarian cyst",
    vars: [V("d1", "Cyst L"), V("d2", "Cyst W"), { key: "side", label: "Side", unit: "right / left" }],
  }),
  P({
    key: "adnexa-cyst-hemorrhagic", organ: "adnexa", label: "Haemorrhagic Cyst", category: "Adnexa",
    text: "A complex cystic lesion ({d1} x {d2} cm) in {side} adnexal region, arising from the {side} ovary with internal mesh like echoes.",
    impression: ["{Side} adnexal haemorrhagic cyst."],
    titleFragment: "{side} haemorrhagic cyst",
    vars: [V("d1", "Cyst L"), V("d2", "Cyst W"), { key: "side", label: "Side", unit: "right / left" }],
  }),
  P({
    key: "adnexa-luteal-cyst", organ: "adnexa", label: "Corpus Luteal Cyst", category: "Adnexa",
    text: "{Side} ovary is normal in size with a well defined thin walled hypoechoic cyst (size {d1} x {d2} cm) with fine internal echoes in {side} adnexal region, arising from the {side} ovary.",
    impression: ["A small {side} adnexal cyst with fine internal echoes. S/o ? Corpus Luteal Cyst."],
    titleFragment: "{side} corpus luteal cyst",
    vars: [V("d1", "Cyst L"), V("d2", "Cyst W"), { key: "side", label: "Side", unit: "right / left" }],
  }),
  P({
    key: "adnexa-dermoid", organ: "adnexa", label: "Dermoid Cyst", category: "Adnexa",
    text: "A well defined cystic lesion ({d1} x {d2} cm) is seen in the {side} adnexal region. Hyperechoic nodule is seen within the cyst S/o ? Dermoid Cyst.",
    impression: ["{Side} adnexal cyst (? Dermoid)."],
    titleFragment: "{side} dermoid cyst",
    vars: [V("d1", "Cyst L"), V("d2", "Cyst W"), { key: "side", label: "Side", unit: "right / left" }],
  }),
  P({
    key: "adnexa-dominant-follicle", organ: "adnexa", label: "Dominant Follicle", category: "Adnexa",
    text: "Ovaries are normally positioned. Normal in echotexture. Dominant follicle in {side} ovary. RT. Ovary measures {rov1} cm x {rov2} cm. LT. Ovary measures {lov1} cm x {lov2} cm.",
    impression: ["Bilateral adenexa normal in morphology. Dominant follicle in {side} ovary."],
    titleFragment: "dominant follicle",
    vars: [V("rov1", "RT ovary L"), V("rov2", "RT ovary W"), V("lov1", "LT ovary L"), V("lov2", "LT ovary W"), { key: "side", label: "Side", unit: "right / left" }],
  }),
  P({
    key: "adnexa-pcod", organ: "adnexa", label: "Bilateral Polycystic Ovaries", category: "Adnexa",
    text: "Ovaries are normally positioned. Multiple small cystic structures (5–6 mm) are arranged at the periphery in pearl of string fashion. The central stroma is echogenic. Features are suggestive of Polycystic ovaries. RT. Ovary measures {rov1} cm x {rov2} cm. LT. Ovary measures {lov1} cm x {lov2} cm.",
    impression: ["Bilateral polycystic ovaries."],
    titleFragment: "bilateral polycystic ovaries",
    vars: [V("rov1", "RT ovary L"), V("rov2", "RT ovary W"), V("lov1", "LT ovary L"), V("lov2", "LT ovary W")],
  }),
  P({
    key: "adnexa-ectopic", organ: "adnexa", label: "Ectopic Pregnancy", category: "Adnexa",
    text: "An ill defined tubo-ovarian mass in {side} adnexal region ({d1} x {d2} cm) with surrounding anechoic collection and strong probe tenderness.",
    impression: ["An ill defined tubo-ovarian mass in {side} adnexal region with surrounding anechoic collection and strong probe tenderness (UPT — Positive).", "F/S/O Ectopic Gestation."],
    titleFragment: "ectopic gestation",
    suggestions: ["Suggested: UPT"],
    vars: [V("d1", "Mass L"), V("d2", "Mass W"), { key: "side", label: "Side", unit: "right / left" }],
  }),

  // ── P.O.D ────────────────────────────────────────────────────────────────
  P({
    key: "pod-collection", organ: "pod", label: "Mild POD Collection", category: "P.O.D",
    text: "Mild collection is seen in Pouch of Douglas.",
    impression: ["Mild POD collection."],
    titleFragment: "pod collection",
  }),

  // ── R.I.F / APPENDIX ─────────────────────────────────────────────────────
  P({
    key: "rif-appendicitis", organ: "rif", label: "Acute Appendicitis", category: "R.I.F",
    text: "A non-compressible, blind ending tubular structure (diameter {d} cm) arising from the caecum in the right iliac fossa with positive probe tenderness, S/o Acute Appendicitis.",
    impression: ["Acute Appendicitis."],
    titleFragment: "acute appendicitis",
    vars: [V("d", "Diameter")],
  }),
  P({
    key: "rif-appendicular-lump", organ: "rif", label: "Appendicular Lump", category: "R.I.F",
    text: "A well defined heterogeneous lump ({d1} x {d2} cm) in the right iliac fossa with surrounding inflammatory changes and positive probe tenderness, S/o Appendicular lump.",
    impression: ["Appendicular lump in right iliac fossa."],
    titleFragment: "appendicular lump",
    vars: [V("d1", "Lump L"), V("d2", "Lump W")],
  }),

  // ── OTHERS ───────────────────────────────────────────────────────────────
  P({
    key: "others-gas", organ: "others", label: "Gaseous Abdomen", category: "Others",
    text: "Excessive bowel gas shadow in the abdominal cavity. No free peritoneal fluid / enlarged lymph nodes are seen.",
    impression: ["Gaseous abdomen."],
    titleFragment: "gaseous abdomen",
  }),
  P({
    key: "others-fluid-faeces", organ: "others", label: "Fluid & Faeces Loops", category: "Others",
    text: "Fluid and faeces filled bowel loops in the lower abdomen. Excessive bowel gas shadow in abdominal cavity.",
    impression: ["Fluid and faeces filled bowel loops in abdominal cavity.", "Gaseous abdomen."],
    titleFragment: "fluid and faeces filled bowel loops",
  }),
  P({
    key: "others-ascites-mild", organ: "others", label: "Ascites — Mild", category: "Others",
    text: "Mild anechoic collection in peritoneal cavity.",
    impression: ["Mild ascites."],
    titleFragment: "mild ascites",
  }),
  P({
    key: "others-ascites-mod", organ: "others", label: "Ascites — Moderate", category: "Others",
    text: "Moderate anechoic collection in peritoneal cavity with bowel loops floating within.",
    impression: ["Moderate ascites."],
    titleFragment: "moderate ascites",
  }),
  P({
    key: "others-ascites-gross", organ: "others", label: "Ascites — Gross", category: "Others",
    text: "Gross anechoic collection in the peritoneal cavity.",
    impression: ["Gross ascites."],
    titleFragment: "gross ascites",
  }),
  P({
    key: "others-mesenteric-nodes", organ: "others", label: "Mesenteric Lymphadenopathy", category: "Others",
    text: "Multiple enlarged mesenteric lymph nodes (largest size {d1} x {d2} cm) in periumbilical region and right iliac fossa with surrounding inflammation.",
    impression: ["Multiple enlarged mesenteric lymph nodes in periumbilical region and right iliac fossa with surrounding inflammation, S/o Mesenteric lymphadenopathy."],
    titleFragment: "mesenteric lymphadenopathy",
    vars: [V("d1", "Largest node L"), V("d2", "Largest node W")],
  }),

  // ── PAEDIATRIC (child whole abdomen — her Child/ formats) ─────────────────
  P({
    key: "others-intestinal-obstruction", organ: "others", label: "Intestinal Obstruction", category: "Paediatric",
    text: "Distended fluid and feces filled small bowel loops with to and fro movement of the contents. Mild interloop collection in peritoneal cavity.",
    impression: ["Distended fluid and feces filled small bowel loops with to and fro movement of the contents S/O Intestinal Obstruction.", "Mild interloop collection in peritoneal cavity."],
    titleFragment: "intestinal obstruction",
  }),
  P({
    key: "others-chps", organ: "others", label: "CHPS (Pyloric Stenosis)", category: "Paediatric",
    text: "Distended stomach. Thickened and elongated pyloric canal. No peristaltic movements through the canal. Canal length {len} cm & canal diameter {dia} cm. No enlarged mesenteric lymph nodes or intraperitoneal collection.",
    impression: ["Thickened and elongated pyloric canal S/O Congenital hypertrophic pyloric stenosis."],
    titleFragment: "congenital hypertrophic pyloric stenosis",
    suggestions: ["Suggested: Clinical correlation"],
    vars: [V("len", "Canal length"), V("dia", "Canal diameter")],
  }),
  P({
    key: "others-gastric-outlet-obstruction", organ: "others", label: "Gastric Outlet Obstruction", category: "Paediatric",
    text: "Grossly distended stomach filled with undigested food particles and fluid with to & fro movement of contents.",
    impression: ["Grossly distended stomach filled with undigested food particles and fluid S/O Gastric outlet obstruction."],
    titleFragment: "gastric outlet obstruction",
  }),

  // ── PREGNANCY — FETUS & PRESENTATION (antenatal) ─────────────────────────
  P({
    key: "fetus-breech", organ: "fetus", label: "Breech Presentation", category: "Pregnancy",
    text: "There is a Single live intrauterine fetus in breech presentation at the time of examination.",
    impression: ["A single live intrauterine fetus at {gaw} wk {gad} days of average gestational age in breech presentation."],
  }),
  P({
    key: "fetus-transverse", organ: "fetus", label: "Transverse Lie", category: "Pregnancy",
    text: "There is a Single live intrauterine fetus in transverse lie ( Head towards left) at the time of examination.",
    impression: ["A single live intrauterine fetus at {gaw} wk {gad} days of average gestational age in transverse lie ( Head towards left)."],
  }),
  P({
    key: "fetus-oblique", organ: "fetus", label: "Oblique Lie", category: "Pregnancy",
    text: "There is a Single live intrauterine fetus in Oblique lie ( Head downwards and towards left) at the time of examination.",
    impression: ["A single live intrauterine fetus at {gaw} wk {gad} days of average gestational age in Oblique lie ( Head downwards and towards left)."],
  }),
  P({
    key: "fetus-variable", organ: "fetus", label: "Variable Presentation", category: "Pregnancy",
    text: "There is a Single live intrauterine fetus in variable presentation at the time of examination.",
    impression: ["A single live intrauterine fetus at {gaw} wk {gad} days of average gestational age in variable presentation."],
  }),
  P({
    key: "fetus-tachycardia", organ: "fetus", label: "Fetal Tachycardia", category: "Pregnancy",
    text: "There is a Single live intrauterine fetus in cephalic presentation at the time of examination.\nFetal tachycardia ( {fhr2} bpm ).",
    impression: ["A single live intrauterine fetus at {gaw} wk {gad} days of average gestational age in cephalic presentation.", "Fetal tachycardia ( {fhr2} bpm )."],
    vars: [V("fhr2", "FHR recorded", "bpm")],
  }),
  P({
    key: "fetus-twins", organ: "fetus", label: "Twin Pregnancy", category: "Pregnancy",
    text: "There are two live intrauterine fetuses, both in variable presentation at the time of examination. F.H.R noted in both foetuses. Intertwin membrane is seen.",
    impression: ["Twin pregnancy at {gaw} weeks of average gestational age."],
  }),
  P({
    key: "fetus-iud", organ: "fetus", label: "IUD (No Cardiac Activity)", category: "Pregnancy",
    text: "There is a Single intrauterine fetus in cephalic presentation at the time of examination. No cardiac activity / fetal somatic movements seen.",
    impression: ["A single intrauterine fetus at {gaw} wk {gad} days of average gestational age with no cardiac activity — S/O Intrauterine death."],
    suggestions: ["Suggested: Follow up scan"],
  }),

  // ── PREGNANCY — FETAL SURVEY (antenatal) ─────────────────────────────────
  P({
    key: "anatomy-no-gross-anomaly", organ: "anatomy", label: "No Gross Anomalies Detected", category: "Pregnancy",
    // Cosmetic wording variant — no impression lines, no title fragment, so a
    // normal report stays "normal" when this alternative survey line is used.
    text: "No gross fetal congenital anomalies detected.",
    impression: [],
  }),
  P({
    key: "anatomy-anencephaly", organ: "anatomy", label: "Anencephaly", category: "Pregnancy",
    text: "The fetal skull vault and cerebral hemispheres are not visualised above the level of orbits — S/O Anencephaly. Rest of the fetal survey appears normal.",
    impression: ["Anencephaly fetus at {gaw} wk {gad} days of average gestational age."],
    titleFragment: "anencephaly",
  }),

  // ── PREGNANCY — PLACENTA & OS (antenatal) ────────────────────────────────
  P({
    key: "placenta-low-lying-reaching", organ: "placenta", label: "Low-lying — Reaching Os", category: "Pregnancy",
    text: "Placenta is located {position} ( maturity Grade {grade} ). The lower part is extending upto the lower segment, the lower margin of placenta is reaching upto the internal Os. Internal os is closed.",
    impression: ["{Position} low lying placenta, lower margin reaching upto the internal Os."],
    titleFragment: "low lying placenta",
    vars: [V("position", "Position (ant/post)", ""), V("grade", "Maturity grade", "")],
  }),
  P({
    key: "placenta-low-lying-distance", organ: "placenta", label: "Low-lying — {d} cm from Os", category: "Pregnancy",
    text: "Placenta is located {position} ( maturity Grade {grade} ). The lower part is extending upto the lower segment, the lower margin of placenta is {d} cm from the internal Os. Internal os is closed.",
    impression: ["{Position} low lying placenta, lower margin {d} cm from the internal Os."],
    titleFragment: "low lying placenta",
    vars: [V("position", "Position (ant/post)", ""), V("grade", "Maturity grade", ""), V("d", "Margin–Os distance")],
  }),
  P({
    key: "placenta-previa-partial", organ: "placenta", label: "Placenta Previa — Partial", category: "Pregnancy",
    text: "Placenta is located {position} ( maturity Grade {grade} ). The lower part is extending upto the lower segment, lower margin is partially covering internal Os. Internal os is closed.",
    impression: ["{Position} placenta previa, lower margin partially covering the internal Os."],
    titleFragment: "placenta previa",
    vars: [V("position", "Position (ant/post)", ""), V("grade", "Maturity grade", "")],
  }),
  P({
    key: "placenta-previa-complete", organ: "placenta", label: "Placenta Previa — Complete", category: "Pregnancy",
    text: "Placenta is located {position} ( maturity Grade {grade} ). The lower part is extending upto the lower segment, lower margin is completely covering internal Os. Internal os is closed.",
    impression: ["{Position} placenta previa, lower margin completely covering the internal Os."],
    titleFragment: "placenta previa",
    vars: [V("position", "Position (ant/post)", ""), V("grade", "Maturity grade", "")],
  }),

  // ── PREGNANCY — LIQUOR (antenatal) ───────────────────────────────────────
  P({
    key: "liquor-oligohydramnios", organ: "liquor", label: "Oligohydramnios", category: "Pregnancy",
    text: "Liquor AFI- {afi} cm (Oligohydramnios).",
    impression: ["Oligohydramnios ( AFI- {afi} cm)."],
    titleFragment: "oligohydramnios",
    vars: [V("afi", "AFI")],
  }),
  P({
    key: "liquor-polyhydramnios", organ: "liquor", label: "Polyhydramnios", category: "Pregnancy",
    text: "Liquor AFI- {afi} cm ( Largest pocket – {lp} cm ).",
    impression: ["Polyhydramnios ( AFI- {afi} cm)."],
    titleFragment: "polyhydramnios",
    vars: [V("afi", "AFI"), V("lp", "Largest pocket")],
  }),

  // ── PREGNANCY — GRAVID UTERUS (early pregnancy, ≤13 wks) ─────────────────
  P({
    key: "gravid-very-early", organ: "gravid-uterus", label: "Very Early (≤5 wks)", category: "Pregnancy",
    text: "Gravid uterus containing a single echogenic intrauterine embryo corresponding to {gaw} weeks & {gad} days of gestational age. Cardiac activity could not be visualised or traced.",
    impression: ["Gravid uterus containing a single echogenic intrauterine embryo corresponding to {gaw} weeks & {gad} days of gestational age. Cardiac activity could not be visualised or traced."],
    suggestions: ["Suggested: Follow up scan"],
    vars: [V("gaw", "GA weeks", ""), V("gad", "GA days", "")],
  }),
  P({
    key: "gravid-blighted-ovum", organ: "gravid-uterus", label: "Blighted Ovum", category: "Pregnancy",
    text: "Measures {u1} x {u2} x {u3} cm. Gravid uterus with a well defined intrauterine gestational sac corresponding to {gaw} wks {gad} days of average gestational age. No embryonic pole or yolk sac seen.",
    impression: ["Gravid uterus with a well defined intrauterine gestational sac corresponding to {gaw} wks {gad} days of average gestational age. No embryonic pole or yolk sac seen S/o Blighted Ovum."],
    suggestions: ["Suggested: Follow up scan"],
    vars: [V("u1", "Uterus L"), V("u2", "Uterus W"), V("u3", "Uterus H"), V("gaw", "GA weeks", ""), V("gad", "GA days", "")],
  }),
  P({
    key: "gravid-missed-abortion", organ: "gravid-uterus", label: "Missed Abortion", category: "Pregnancy",
    text: "Bulky anteverted uterus contains solitary intrauterine gestational sac with an foetus node within. The gestational sac is double walled with irregular outline. The foetal node shows:\n- No cardiac flickering.\n- No somatic movement.\n- No M-mode cardiac tracing (Heart Rate: Nil).\nOs is closed. Cervix appears long. The gestational age is {gaw} weeks {gad} days as per C.R.L measurements.\n\nC.R.L. measures : {crl} mm = {gaw} weeks {gad} days.",
    impression: ["A single intrauterine embryo at {gaw} weeks {gad} days of average gestational age. No cardiac activity or somatic movements seen.", "? Missed abortion."],
    suggestions: ["Suggested: Follow up scan"],
    vars: [V("crl", "C.R.L", "mm"), V("gaw", "GA weeks", ""), V("gad", "GA days", "")],
  }),
  P({
    key: "gravid-subchorionic-hematoma", organ: "gravid-uterus", label: "Subchorionic Hematoma", category: "Pregnancy",
    text: "Bulky anteverted uterus contains solitary intrauterine gestational sac with an alive foetus node within. The gestational sac is double walled with regular outline. An ill defined hypoechoic collection ( {d1} x {d2} cm) in the subchorionic region ? hematoma. The foetal node shows:\n- Active cardiac flickering.\n- Active somatic movement.\n- Regular M-mode cardiac tracing (Heart Rate: {fhr} bpm).\nOs is closed. Cervix appears long. The gestational age is {gaw} weeks {gad} days as per C.R.L measurements.\n\nC.R.L. measures : {crl} mm = {gaw} weeks {gad} days\n\nE.D.D : {edd}",
    impression: ["A single live intrauterine embryo at {gaw} weeks {gad} days of average gestational age with subchorionic hematoma."],
    vars: [V("d1", "Collection L"), V("d2", "Collection W"), V("crl", "C.R.L", "mm"), V("fhr", "Heart rate", "bpm"), V("edd", "E.D.D", "date"), V("gaw", "GA weeks", ""), V("gad", "GA days", "")],
  }),
  P({
    key: "gravid-rpoc", organ: "gravid-uterus", label: "RPOC", category: "Pregnancy",
    text: "Measures {u1} x {u2} x {u3} cm. The uterus is positioned in anteversion. An ill defined mixed echogenicity structure ( {d1} x {d2} cm ) is seen in the uterine cavity S/O ? Retained product conception. No focal pathology or abnormalities of outline are noted. The cervical echo is normal.",
    impression: ["An ill defined mixed echogenicity structure in the uterine cavity S/O ? Retained product conception."],
    titleFragment: "retained product conception",
    vars: [V("u1", "Uterus L"), V("u2", "Uterus W"), V("u3", "Uterus H"), V("d1", "Structure L"), V("d2", "Structure W")],
  }),
  P({
    key: "gravid-twin-early", organ: "gravid-uterus", label: "Twin (Early)", category: "Pregnancy",
    text: "Bulky anteverted uterus contains two intrauterine gestational sac with alive embryonic node within. The gestational sac is double walled with regular outline. The foetal node shows:\n- Active cardiac flickering.\n- Active somatic movement.\n- Regular M-mode cardiac tracing of embryo one (Heart Rate: {fhr1} bpm).\n- Regular M-mode cardiac tracing of embryo two (Heart Rate: {fhr2} bpm).\nOs is closed. Cervix appears long. The average gestational age is {gaw} weeks & {gad} days as per C.R.L measurements.\n\nC.R.L. measures of embryo one: {crl1} mm = {gaw} weeks {gad} days\nC.R.L. measures of embryo two: {crl2} mm = {gaw} weeks {gad} days\n\nE.D.D : {edd}",
    impression: ["Twin intrauterine pregnancy at {gaw} weeks {gad} days of average gestational age."],
    titleFragment: "twin pregnancy",
    vars: [V("crl1", "CRL embryo 1", "mm"), V("crl2", "CRL embryo 2", "mm"), V("fhr1", "HR embryo 1", "bpm"), V("fhr2", "HR embryo 2", "bpm"), V("edd", "E.D.D", "date"), V("gaw", "GA weeks", ""), V("gad", "GA days", "")],
  }),
];

/** Quick lookup by key. */
export function getPathology(key: string): UsgPathologyDef | undefined {
  return USG_PATHOLOGIES.find((p) => p.key === key);
}

// Part 2 catalog (thyroid, breast, scrotum, echo, doppler, chest, cranium,
// orbit, swelling, TVS/TRUS extras) — merged so every consumer sees one set.
import { USG_PATHOLOGIES_EXTRA } from "./pathologies-extra";

/** The complete builtin catalog: abdomen/obstetric + extended studies. */
export const USG_PATHOLOGIES_ALL: UsgPathologyDef[] = [...USG_PATHOLOGIES, ...USG_PATHOLOGIES_EXTRA];

/** Quick lookup by key across both parts. */
export function getPathologyAny(key: string): UsgPathologyDef | undefined {
  return USG_PATHOLOGIES_ALL.find((p) => p.key === key);
}
