/**
 * v6.21 professional print layout — referee for the changes that took the
 * printed sheet to the clinic's specimen format.
 *
 *   • The verification QR sits on the signature line, to its left, and no
 *     longer costs a band under the footer rule. Settings → Print layout
 *     switches it off across print, PDF and share.
 *   • The premium masthead is led by the logo plate alone — the white clinic
 *     name beside it only duplicated the wordmark.
 *   • The register number left the patient strip on both templates.
 *   • Advice prints on one line; the PC-PNDT declaration band is thinner.
 *   • "Auto fill A4" stretches the sheet so a short study has no blank band
 *     under the signature, without touching type size.
 *   • The sidebar template no longer reserves an empty image column, and —
 *     the compliance one — finally carries the PC-PNDT declaration it omitted.
 */
import { describe, expect, test } from "vitest";
import { PDFDocument } from "pdf-lib";
import { buildUsgReportHtml } from "@/lib/usg/print";
import { buildUsgReportPdf } from "@/lib/usg/pdf";
import { initialState } from "@/lib/usg/studies";
import { makeLookup, resolve } from "@/lib/usg/composer";
import { USG_PATHOLOGIES_ALL } from "@/lib/usg/pathologies";
import { updateSettings, getSettings } from "@/lib/settings";

const lookup = makeLookup(USG_PATHOLOGIES_ALL);

const BASE = {
  appTitle: "CARE USG Studio",
  hospitalName: "CARE DIAGNOSTICS",
  addressLine: "Subhash Chowk, Deoghar",
  phone: "06432-220450",
  email: "care@diagnostics.in",
  logoUrl: "",
  footerMessage: "Precision. Compassion. Care.",
  registrationNo: "J/12345",
  usgDoctorName: "Dr. Sugandha",
  usgDoctorQual: "MBBS, MD",
  usgDoctorRegNo: "J/12345",
  usgMachineLine: "GE Voluson Pro",
  usgShowMachine: true,
  usgFooterLine: "Correlate clinically.",
  usgDeclarationLine: "",
  usgPrintStyle: "premium",
};

const PATIENT = { name: "Rani Devi", age: "26", sex: "F", referredBy: "Dr. Kumar", date: "01-Oct-2026", serial: "USG-0001" };
const QR = { dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==" };

const ob = () => resolve(initialState("ob"), lookup, "Antenatal scan.");
const wa = () => resolve(initialState("wa-female"), lookup, "Routine transabdominal scan.");

describe("verification QR on the signature line", () => {
  test("renders inside .sig-block, before the signature, and not in the footer", () => {
    const html = buildUsgReportHtml(BASE as never, PATIENT, wa(), [], QR);
    const sig = html.slice(html.indexOf('class="sig-block"'), html.indexOf('class="footer"'));
    expect(sig).toContain('class="qr-wrap"');
    expect(sig).toContain('class="qr"');
    expect(sig).toContain("scan to verify");
    // QR precedes the signed name on the same row.
    expect(sig.indexOf("qr-wrap")).toBeLessThan(sig.indexOf('class="sig"'));
    // The footer band is now just footer text + clinic name.
    const footer = html.slice(html.indexOf('class="footer"'));
    expect(footer).not.toContain("qr-wrap");
  });

  test("Settings off removes the QR from print", () => {
    const html = buildUsgReportHtml(
      { ...BASE, usgPrintQrEnabled: false } as never,
      PATIENT,
      wa(),
      [],
      QR,
    );
    expect(html).not.toContain('class="qr"');
    expect(html).not.toContain("scan to verify");
  });

  test("absent setting keeps the QR (default true for existing rows)", () => {
    const html = buildUsgReportHtml(BASE as never, PATIENT, wa(), [], QR);
    expect(html).toContain('class="qr"');
  });

  test("the sidebar template puts the QR on its signature row too", () => {
    const html = buildUsgReportHtml(
      { ...BASE, usgPrintStyle: "premium_sidebar" } as never,
      PATIENT,
      wa(),
      [],
      QR,
    );
    const sig = html.slice(html.indexOf('class="signature-block"'), html.indexOf('class="footer-band"'));
    expect(sig).toContain('class="qr"');
    expect(sig).toContain("scan to verify");
  });

  test("PDF: off embeds exactly one fewer image than on", async () => {
    const png =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC";
    const qrPng = new Uint8Array(
      await (await import("qrcode")).default.toBuffer("http://x/verify?d=1", { margin: 1, width: 120 }),
    );
    const count = async (settings: Record<string, unknown>) => {
      const bytes = await buildUsgReportPdf({
        settings: settings as never,
        patient: PATIENT,
        resolved: wa(),
        images: [{ dataUrl: png, caption: "still" }],
        qrPng,
      });
      const doc = await PDFDocument.load(bytes);
      const raw = Buffer.from(bytes).toString("latin1");
      return (raw.match(/\/Subtype\s*\/Image/g) ?? []).length + doc.getPageCount() * 0;
    };
    const on = await count({ ...BASE, usgPrintQrEnabled: true });
    const off = await count({ ...BASE, usgPrintQrEnabled: false });
    expect(on - off).toBe(1);
  });
});

describe("branded header without the duplicated wordmark", () => {
  test("premium masthead carries the logo plate and no white clinic name", () => {
    const html = buildUsgReportHtml(BASE as never, PATIENT, wa(), [], null);
    const masthead = html.slice(html.indexOf('class="masthead"'), html.indexOf('class="patient"'));
    expect(masthead).toContain('class="logo-slot"');
    expect(masthead).not.toContain('class="hospital"');
    // The clinic name still prints in the footer.
    expect(html.slice(html.indexOf('class="footer"'))).toContain("CARE DIAGNOSTICS");
  });

  test("classic keeps its name — it may print with no logo at all", () => {
    const html = buildUsgReportHtml({ ...BASE, usgPrintStyle: "classic" } as never, PATIENT, wa(), [], null);
    expect(html).toContain('class="hospital"');
  });

  test("an unset logoUrl still yields a logo rather than a blank plate", () => {
    const html = buildUsgReportHtml({ ...BASE, logoUrl: "" } as never, PATIENT, wa(), [], null);
    expect(html).toContain("/brand/care-diagnostics.jpg");
  });

  test("the logo plate keeps the mark's aspect instead of a square", () => {
    const html = buildUsgReportHtml(BASE as never, PATIENT, wa(), [], null);
    expect(html).toContain("--logo-max-w:");
    expect(html).not.toMatch(/\.logo-slot\s*\{[^}]*width:\s*var\(--logo-box/);
  });
});

describe("register number left the header", () => {
  test("patient strip has no USG No. cell on either template", () => {
    const premium = buildUsgReportHtml(BASE as never, PATIENT, wa(), [], null);
    expect(premium.slice(premium.indexOf('class="patient"'), premium.indexOf("Thanks For Your"))).not.toContain("USG No.");
    const side = buildUsgReportHtml(
      { ...BASE, usgPrintStyle: "premium_sidebar" } as never,
      PATIENT,
      wa(),
      [],
      null,
    );
    expect(side).not.toContain("USG No.");
    // v6.21 — neither template prints the register number at all now; the QR
    // carries the verification code and /verify resolves it.
    expect(side).not.toContain(PATIENT.serial);
  });

  test("…and the single-column sheet carries no serial at all", () => {
    const html = buildUsgReportHtml(BASE as never, PATIENT, wa(), [], QR);
    expect(html).not.toContain(PATIENT.serial);
    // The QR still carries the code, so verification is unaffected.
    expect(html).toContain('class="qr"');
  });
});

describe("advice on one line", () => {
  test("the Advice heading shares the row with its text", () => {
    const state = initialState("ob");
    const resolved = resolve(state, lookup, "Antenatal scan.");
    const html = buildUsgReportHtml(BASE as never, PATIENT, resolved, [], null);
    const advice = html.slice(html.indexOf('class="advice-box'), html.indexOf('class="tail"'));
    expect(advice).toContain("advice-inline");
    expect(advice).not.toMatch(/<div class="advice-h">Advice<\/div>/);
  });

  test("sidebar advice is a single inline row too", () => {
    const html = buildUsgReportHtml(
      { ...BASE, usgPrintStyle: "premium_sidebar" } as never,
      PATIENT,
      resolve(initialState("ob"), lookup, "Antenatal scan."),
      [],
      null,
    );
    expect(html).toContain("advice-inline-side");
  });
});

describe("auto fill A4", () => {
  test("auto stretches the sheet and drops the tail to the foot of page 1", () => {
    const html = buildUsgReportHtml(
      { ...BASE, usgPrintBodyFit: "auto" } as never,
      PATIENT,
      wa(),
      [],
      null,
    );
    expect(html).toContain("min-height: 281mm");
    expect(html).toContain('class="fit-spacer"');
    expect(html.indexOf('class="fit-spacer"')).toBeLessThan(html.indexOf('class="tail"'));
  });

  test("one_page (the stored default) is unchanged — no spacer, no flex sheet", () => {
    const html = buildUsgReportHtml(BASE as never, PATIENT, wa(), [], null);
    expect(html).not.toContain("fit-spacer");
    expect(html).not.toContain("min-height: 281mm");
  });

  test("multi gets no auto-fit CSS either", () => {
    const html = buildUsgReportHtml(
      { ...BASE, usgPrintBodyFit: "multi" } as never,
      PATIENT,
      wa(),
      [],
      null,
    );
    expect(html).not.toContain("fit-spacer");
  });

  test("the sidebar template flex-fills only in auto", () => {
    const auto = buildUsgReportHtml(
      { ...BASE, usgPrintStyle: "premium_sidebar", usgPrintBodyFit: "auto" } as never,
      PATIENT,
      wa(),
      [],
      null,
    );
    expect(auto).toContain('class="page fit-auto"');
    const fixed = buildUsgReportHtml(
      { ...BASE, usgPrintStyle: "premium_sidebar", usgPrintBodyFit: "one_page" } as never,
      PATIENT,
      wa(),
      [],
      null,
    );
    expect(fixed).not.toContain('class="page fit-auto"');
  });
});

describe("sidebar template fixes", () => {
  test("no stills → the narrative takes the full width", () => {
    const html = buildUsgReportHtml(
      { ...BASE, usgPrintStyle: "premium_sidebar" } as never,
      PATIENT,
      wa(),
      [],
      null,
    );
    expect(html).toMatch(/class="body-grid[^"]*\bno-images\b/);
  });

  test("stills attached → the image column is reserved", () => {
    const html = buildUsgReportHtml(
      { ...BASE, usgPrintStyle: "premium_sidebar" } as never,
      PATIENT,
      wa(),
      [{ dataUrl: "data:image/png;base64,AAAA", caption: "liver" }],
      null,
    );
    expect(html).not.toMatch(/class="body-grid[^"]*\bno-images\b/);
    expect(html).toContain('class="sidebar"');
  });

  test("an obstetric study carries the PC-PNDT declaration — it used to be absent", () => {
    const html = buildUsgReportHtml(
      { ...BASE, usgPrintStyle: "premium_sidebar" } as never,
      PATIENT,
      resolve(initialState("ob"), lookup, "Antenatal scan."),
      [],
      null,
    );
    expect(html).toContain('class="pcpndt-side"');
    expect(html).toMatch(/neither detected nor disclosed/i);
  });

  test("a non-obstetric study gets no declaration band", () => {
    const html = buildUsgReportHtml(
      { ...BASE, usgPrintStyle: "premium_sidebar" } as never,
      PATIENT,
      wa(),
      [],
      null,
    );
    expect(html).not.toContain('class="pcpndt-side"');
  });
});

describe("QR toggle persists like the other print checkboxes", () => {
  test("string and boolean forms both store, and it defaults true on a fresh row", async () => {
    const fresh = await getSettings();
    expect(fresh.usgPrintQrEnabled).toBe(true);

    await updateSettings({ usgPrintQrEnabled: "off" } as never);
    expect((await getSettings()).usgPrintQrEnabled).toBe(false);

    await updateSettings({ usgPrintQrEnabled: "true" } as never);
    expect((await getSettings()).usgPrintQrEnabled).toBe(true);

    await updateSettings({ usgPrintQrEnabled: false } as never);
    expect((await getSettings()).usgPrintQrEnabled).toBe(false);

    await updateSettings({ usgPrintQrEnabled: true } as never);
    expect((await getSettings()).usgPrintQrEnabled).toBe(true);
  });

  test("body fit stores auto without collapsing it to one_page", async () => {
    await updateSettings({ usgPrintBodyFit: "auto" } as never);
    expect((await getSettings()).usgPrintBodyFit).toBe("auto");
    await updateSettings({ usgPrintBodyFit: "nonsense" } as never);
    expect((await getSettings()).usgPrintBodyFit).toBe("one_page");
  });
});
