"use client";
/**
 * Share a report as PDF (v5): the Web Share API with the file on mobile
 * (native sheet → WhatsApp), else download the PDF and open wa.me with a
 * ready-to-send message. Pure browser helper — no server imports.
 */

export type ShareTarget = {
  reportId: string;
  patientName: string;
  serial?: string;
  date?: string;
};

type ShareNav = Navigator & {
  canShare?: (data: { files?: File[] }) => boolean;
  share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>;
};

function pdfFilename(params: {
  patientName: string;
  serial?: number | string | null;
  date?: string | null;
}): string {
  const safeName = (params.patientName || "report").replace(/[^a-z0-9]+/gi, "-").slice(0, 30) || "report";
  const serialPart = params.serial != null && params.serial !== "" ? `${params.serial}-` : "";
  const datePart = params.date ? `-${String(params.date).replace(/\//g, "-")}` : "";
  return `${serialPart}${safeName}${datePart}.pdf`;
}

/** Fetch the PDF as a blob (auth cookies included) — never rely on `<a download>`. */
async function fetchReportPdfBlob(reportId: string): Promise<Blob> {
  const res = await fetch(`/api/usg/reports/${reportId}/pdf?download=1`, {
    credentials: "same-origin",
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail || `PDF build failed (${res.status})`);
  }
  const blob = await res.blob();
  if (!blob.size) throw new Error("PDF was empty");
  return blob;
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function shareReportPdf(
  target: ShareTarget,
  onProgress?: (state: "building" | "sharing" | "downloaded") => void,
): Promise<"shared" | "downloaded" | "failed"> {
  onProgress?.("building");
  let blob: Blob;
  try {
    blob = await fetchReportPdfBlob(target.reportId);
  } catch {
    return "failed";
  }

  const filename = pdfFilename({
    patientName: target.patientName,
    serial: target.serial,
    date: target.date,
  });
  const file = new File([blob], filename, { type: "application/pdf" });
  const message = `USG report${target.serial ? ` ${target.serial}` : ""} for ${target.patientName}${target.date ? ` (${target.date})` : ""} — from USG Studio.`;

  const nav = navigator as ShareNav;
  if (nav.canShare?.({ files: [file] }) && nav.share) {
    onProgress?.("sharing");
    try {
      await nav.share({ files: [file], title: "USG Report", text: message });
      return "shared";
    } catch {
      // User dismissed the sheet — fall through to download + wa.me.
    }
  }

  // Desktop fallback: save the PDF, then open WhatsApp with the message.
  onProgress?.("downloaded");
  triggerBlobDownload(blob, filename);
  window.open(`https://wa.me/?text=${encodeURIComponent(`${message} (PDF saved to Downloads — attach it here.)`)}`, "_blank");
  return "downloaded";
}

/**
 * Sticky-bar PDF button. Must fetch as a blob — a bare `<a download href=/api/…>`
 * is ignored by Chromium when Content-Disposition is inline / navigational,
 * which looked like "PDF does nothing".
 */
export async function downloadReportPdf(params: {
  reportId: string;
  patientName: string;
  serial?: number | string;
  date?: string;
}): Promise<"downloaded" | "failed"> {
  if (!params.reportId) {
    alert("Save the report first before downloading");
    return "failed";
  }
  try {
    const blob = await fetchReportPdfBlob(params.reportId);
    triggerBlobDownload(
      blob,
      pdfFilename({
        patientName: params.patientName,
        serial: params.serial,
        date: params.date,
      }),
    );
    return "downloaded";
  } catch (e) {
    alert(e instanceof Error ? e.message : "PDF download failed");
    return "failed";
  }
}
