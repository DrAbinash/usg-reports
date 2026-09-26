/**
 * OHIF launch URL helpers — AUTO LAN / Tailscale (CARE studyLaunchService lite).
 * Cloudflare/Public routes from the ERP workspace are out of scope until configured.
 */

export const LAN_OHIF_BASE = "http://172.16.1.139:3010";
export const TS_OHIF_BASE = "https://ohif-viewer.tail7005c0.ts.net";

export type OhifRoute = "auto" | "lan" | "tailscale";

/**
 * Preview-column layout — CARE reportFocus / split / viewerFocus, plus
 * letterpad focus (click letterpad → OHIF shrinks; click OHIF → letterpad shrinks).
 */
export type OhifLayoutMode = "report" | "split" | "viewerPlus" | "letterpad";

export function resolveOhifBase(route: OhifRoute): string {
  if (route === "lan") return LAN_OHIF_BASE;
  if (route === "tailscale") return TS_OHIF_BASE;
  const pageHttps = typeof window !== "undefined" && window.location.protocol === "https:";
  return pageHttps ? TS_OHIF_BASE : LAN_OHIF_BASE;
}

export function ohifViewerUrl(studyInstanceUid: string, route: OhifRoute = "auto"): string {
  const base = resolveOhifBase(route);
  return `${base}/viewer?StudyInstanceUIDs=${encodeURIComponent(studyInstanceUid)}`;
}

export function ohifRouteLabel(route: OhifRoute): "LAN" | "TS" {
  return resolveOhifBase(route) === TS_OHIF_BASE ? "TS" : "LAN";
}
