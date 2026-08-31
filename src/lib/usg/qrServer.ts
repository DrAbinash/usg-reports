/**
 * USG Studio — QR generation server-side (v5 phase 9).
 *
 * Signs a report with the install's HMAC secret and renders the verification
 * QR: PNG bytes for the PDF, data URL for the HTML print. Lazily mints and
 * stores the secret on first use.
 */
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { buildPayload, getOrCreateSecret, qrTarget, type VerifyPayloadInput } from "./verify";

export async function getQrSecret(): Promise<string> {
  return getOrCreateSecret(
    async () => (await getSettings()).qrSecret,
    async (s) => {
      await db.hospitalSettings.update({ where: { id: "singleton" }, data: { qrSecret: s } });
    },
  );
}

/** Payload input for a report row (date preference: scan → finalized → created). */
export function payloadInputFor(r: {
  serialNo: number | null;
  patientName: string;
  scanDate: Date | null;
  finalizedAt: Date | null;
  createdAt: Date;
}): VerifyPayloadInput | null {
  if (r.serialNo == null) return null;
  return {
    serialNo: r.serialNo,
    patientName: r.patientName,
    dateIso: (r.scanDate ?? r.finalizedAt ?? r.createdAt).toISOString(),
  };
}

/** QR PNG bytes (for the PDF), null when the report has no serial yet. */
export async function qrPngFor(
  input: VerifyPayloadInput | null,
  origin: string | null,
): Promise<Uint8Array | null> {
  if (!input) return null;
  const secret = await getQrSecret();
  const payload = buildPayload(input, secret);
  const target = qrTarget(payload, origin);
  const buf = await QRCode.toBuffer(target, { margin: 1, width: 240, errorCorrectionLevel: "M" });
  return new Uint8Array(buf);
}

/** QR data URL (for the HTML print), null when the report has no serial yet. */
export async function qrDataUrlFor(
  input: VerifyPayloadInput | null,
  origin: string | null,
): Promise<string | null> {
  if (!input) return null;
  const secret = await getQrSecret();
  const payload = buildPayload(input, secret);
  const target = qrTarget(payload, origin);
  return QRCode.toDataURL(target, { margin: 1, width: 240, errorCorrectionLevel: "M" });
}
