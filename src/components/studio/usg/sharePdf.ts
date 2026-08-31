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

export async function shareReportPdf(
  target: ShareTarget,
  onProgress?: (state: "building" | "sharing" | "downloaded") => void,
): Promise<"shared" | "downloaded" | "failed"> {
  onProgress?.("building");
  let blob: Blob;
  try {
    const res = await fetch(`/api/usg/reports/${target.reportId}/pdf`);
    if (!res.ok) throw new Error("PDF build failed");
    blob = await res.blob();
  } catch {
    return "failed";
  }

  const filename = `${target.serial ? `${target.serial}-` : ""}${target.patientName.replace(/[^a-z0-9]+/gi, "-").slice(0, 30)}.pdf`;
  const file = new File([blob], filename, { type: "application/pdf" });
  const message = `USG report${target.serial ? ` ${target.serial}` : ""} for ${target.patientName}${target.date ? ` (${target.date})` : ""} — from CARE USG Studio.`;

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
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  window.open(`https://wa.me/?text=${encodeURIComponent(`${message} (PDF saved to Downloads — attach it here.)`)}`, "_blank");
  return "downloaded";
}

export function downloadReportPdf(target: ShareTarget): void {
  const a = document.createElement("a");
  a.href = `/api/usg/reports/${target.reportId}/pdf`;
  a.download = `${target.serial ? `${target.serial}-` : ""}${target.patientName.replace(/[^a-z0-9]+/gi, "-").slice(0, 30)}.pdf`;
  a.click();
}
