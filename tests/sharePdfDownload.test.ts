/**
 * PDF download helper — must fetch a blob (Chromium ignores bare <a download>
 * against inline Content-Disposition API routes).
 */
import { afterEach, describe, expect, it, vi } from "vitest";

describe("downloadReportPdf", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("fetches ?download=1 as a blob and triggers an <a download> click", async () => {
    const clicks: Array<{ download: string; href: string }> = [];
    const body = {
      appendChild(n: unknown) {
        return n;
      },
      removeChild(n: unknown) {
        return n;
      },
    };
    vi.stubGlobal("document", {
      body,
      createElement(tag: string) {
        if (tag !== "a") return { tagName: tag };
        const el = {
          tagName: "a",
          href: "",
          download: "",
          rel: "",
          click() {
            clicks.push({ download: el.download, href: el.href });
          },
        };
        return el;
      },
    });

    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toContain("/api/usg/reports/rep-1/pdf?download=1");
      return new Response(pdfBytes, {
        status: 200,
        headers: { "Content-Type": "application/pdf" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const revoke = vi.fn();
    const createObjectURL = vi.fn(() => "blob:mock-pdf");
    // Keep the real URL constructor (Response / fetch use it); only stub statics.
    vi.spyOn(URL, "createObjectURL").mockImplementation(createObjectURL as typeof URL.createObjectURL);
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(revoke);

    const { downloadReportPdf } = await import("../src/components/studio/usg/sharePdf");
    const result = await downloadReportPdf({
      reportId: "rep-1",
      patientName: "Laxmi Patel",
      serial: "USG-0015",
      date: "27 Sept 2026",
    });

    expect(result).toBe("downloaded");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(clicks).toEqual([
      { download: "USG-0015-Laxmi-Patel-27 Sept 2026.pdf", href: "blob:mock-pdf" },
    ]);
    // revokeObjectURL is deferred (setTimeout) — not asserted here.
    void revoke;
  });

  it("returns failed when the API errors", async () => {
    vi.stubGlobal("document", {
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
      createElement: vi.fn(() => ({ click: vi.fn(), href: "", download: "", rel: "" })),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("boom", { status: 500 })),
    );
    const alert = vi.fn();
    vi.stubGlobal("alert", alert);
    const { downloadReportPdf } = await import("../src/components/studio/usg/sharePdf");
    const result = await downloadReportPdf({
      reportId: "rep-1",
      patientName: "X",
    });
    expect(result).toBe("failed");
    expect(alert).toHaveBeenCalled();
  });
});
