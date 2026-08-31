/**
 * USG Studio — report still-image validation (v5 phase 4).
 *
 * Machine stills arrive as data URLs (pasted or dropped). Pure validation
 * keeps the API route thin and the rules testable:
 *   • PNG / JPEG / WebP only (what browsers and USG consoles emit)
 *   • ≤ 1.5 MB per image (a report carries 2–4 stills; SQLite stays small)
 */
const ALLOWED = ["image/png", "image/jpeg", "image/jpg", "image/webp"] as const;

export const IMAGE_MAX_BYTES = 1_500_000;

export type ImageValidation = { ok: true; mime: string; bytes: number } | { ok: false; error: string };

/** Validate a data-URL image payload. */
export function validateImageDataUrl(dataUrl: string): ImageValidation {
  const m = /^data:(image\/(?:png|jpe?g|webp));base64,([A-Za-z0-9+/=]+)$/.exec((dataUrl ?? "").trim());
  if (!m) {
    return { ok: false, error: "Only PNG, JPEG or WebP images pasted as data URLs are accepted" };
  }
  const mime = m[1].toLowerCase() === "image/jpg" ? "image/jpeg" : m[1].toLowerCase();
  const bytes = Math.floor((m[2].length * 3) / 4);
  if (bytes > IMAGE_MAX_BYTES) {
    return { ok: false, error: `Image is too large (${(bytes / 1_000_000).toFixed(1)} MB) — the limit is 1.5 MB per still` };
  }
  return { ok: true, mime, bytes };
}
