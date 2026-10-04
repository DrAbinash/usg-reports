/**
 * Frozen-sheet PDF — render the report's stored HTML through a real browser.
 *
 * Why this exists: the studio has two independent renderers. Printing serves
 * the frozen reportHtml through the browser's own engine, while the PDF was
 * redrawn from scratch with pdf-lib. Two renderers means two layouts for one
 * signed document, and the PDF could not reproduce the premium_sidebar sheet at
 * all. For a finalized report the only faithful PDF is the frozen HTML itself.
 *
 * Chromium runs as a SEPARATE container, not inside the studio. The studio is
 * capped at 512M and a single print job wants several hundred of those; a
 * sidecar keeps the renderer's memory in its own cgroup so an exhausted print
 * cannot OOM the app the clinic reports in all day.
 *
 * If CHROME_WS_ENDPOINT is unset or the sidecar is unreachable this throws, and
 * the caller falls back to the pdf-lib generator. The studio must never lose
 * the ability to download a PDF because an optional renderer is down.
 */
import puppeteer from "puppeteer-core";

/** Where the renderer lives, if it was configured at all. */
export function browserPdfEndpoint(): string | null {
  const raw = (process.env.CHROME_PDF_URL ?? "").trim();
  return raw || null;
}

export function browserPdfAvailable(): boolean {
  return browserPdfEndpoint() !== null;
}

/**
 * Print a full HTML document to PDF bytes.
 *
 * preferCSSPageSize lets print.ts's own @page rule decide the sheet (A4 or A5)
 * so the PDF inherits exactly what the browser printed, including the
 * letterpad variant. Margins are zero because the HTML already lays the page
 * out — adding browser margins on top double-shifts every block.
 */
export async function renderHtmlToPdf(html: string, timeoutMs = 45_000): Promise<Uint8Array> {
  const endpoint = browserPdfEndpoint();
  if (!endpoint) throw new Error("no browser renderer configured");

  // A ws:// endpoint is used verbatim; an http(s) URL goes through
  // /json/version, where puppeteer rewrites the returned socket host — the
  // sidecar reports "localhost", which from another container is not it.
  const target = /^wss?:\/\//i.test(endpoint)
    ? { browserWSEndpoint: endpoint }
    : { browserURL: endpoint };
  const browser = await puppeteer.connect({
    ...target,
    // A sidecar that is restarting must fail fast, not hang the download.
    protocolTimeout: timeoutMs,
  });
  try {
    const page = await browser.newPage();
    try {
      // setContent, not a data: URL — a report with stills has every image
      // inlined as base64, which blows straight through URL length limits.
      await page.setContent(html, { waitUntil: "load", timeout: timeoutMs });
      // Stills are inline data: URLs, so 'load' is enough; fonts are system
      // fonts. One extra tick lets any layout shift settle before pagination.
      await page.evaluateHandle("document.fonts ? document.fonts.ready : null");
      const bytes = await page.pdf({
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      });
      return new Uint8Array(bytes);
    } finally {
      await page.close().catch(() => {});
    }
  } finally {
    // Disconnect only — never kill the shared browser.
    browser.disconnect();
  }
}
