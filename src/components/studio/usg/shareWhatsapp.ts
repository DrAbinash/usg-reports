"use client";
/**
 * Secure WhatsApp share — mint a 7-day /share/[token] link and open wa.me
 * deep links per clinic whatsappRouting preference.
 */
import { toast } from "sonner";

export type SecureShareResult =
  | "opened"
  | "copied"
  | "doctor_prompt"
  | "failed";

type ShareApiResponse = {
  shareUrl?: string;
  primaryUrl?: string | null;
  secondaryUrl?: string | null;
  copyFallback?: boolean;
  message?: string;
  error?: string;
};

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Share a finalized report via WhatsApp using a secure tokenized link.
 * Never puts PHI in the URL — only the opaque token from the server.
 */
export async function shareReportWhatsapp(reportId: string): Promise<SecureShareResult> {
  let data: ShareApiResponse;
  try {
    const res = await fetch(`/api/usg/reports/${reportId}/share`, { method: "POST" });
    data = (await res.json()) as ShareApiResponse;
    if (!res.ok) {
      toast.error(data.error || "Could not create share link");
      return "failed";
    }
  } catch {
    toast.error("Could not create share link");
    return "failed";
  }

  const shareUrl = data.shareUrl?.trim() || "";
  if (!shareUrl) {
    toast.error("Share link missing");
    return "failed";
  }

  if (data.copyFallback || (!data.primaryUrl && !data.secondaryUrl)) {
    const ok = await copyText(shareUrl);
    toast.message(ok ? "Link copied. Phone number not found." : "Phone number not found — copy this link manually", {
      description: shareUrl,
      duration: 8000,
    });
    return "copied";
  }

  if (data.primaryUrl) {
    window.open(data.primaryUrl, "_blank", "noopener,noreferrer");
  }

  if (data.secondaryUrl) {
    // patient_and_doctor: patient tab already opened; offer doctor send.
    toast.message("Patient WhatsApp opened", {
      description: "Also send to the referring doctor?",
      duration: 12000,
      action: {
        label: "Send to Referring Doctor",
        onClick: () => {
          window.open(data.secondaryUrl!, "_blank", "noopener,noreferrer");
        },
      },
    });
    return "doctor_prompt";
  }

  return "opened";
}
