/**
 * White-label clinic display helpers.
 * Prefer hospitalName (clinic name on letterhead), then appTitle, then a
 * neutral product fallback — never hard-require "CARE Diagnostics".
 */

export type BrandingBag = {
  hospitalName?: string | null;
  appTitle?: string | null;
  registrationNo?: string | null;
  footerMessage?: string | null;
  usgFooterLine?: string | null;
  logoUrl?: string | null;
};

/** Clinic / centre name for letterhead, PDF author, share messages. */
export function clinicDisplayName(s: BrandingBag): string {
  const clinic = (s.hospitalName ?? "").trim();
  if (clinic) return clinic;
  const title = (s.appTitle ?? "").trim();
  if (title) return title;
  return "USG Studio";
}

/** Product/UI title (header, login). Falls back to clinic name, then neutral. */
export function studioProductTitle(s: BrandingBag): string {
  const title = (s.appTitle ?? "").trim();
  if (title) return title;
  return clinicDisplayName(s);
}

/** Footer line on printed/PDF reports. */
export function clinicFooterText(s: BrandingBag): string {
  const usg = (s.usgFooterLine ?? "").trim();
  if (usg) return usg;
  return (s.footerMessage ?? "").trim();
}
