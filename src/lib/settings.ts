import { db } from "@/lib/db";

export type HospitalSettingsRow = Awaited<ReturnType<typeof getSettings>>;

/**
 * USG Studio settings — the singleton personalisation row.
 * This studio is standalone sonography reporting: no CARE ERP, no
 * Orthanc/PACS, no OHIF viewer. The only secret is the PIN.
 */

/** Get (or lazily create) the singleton settings row. */
export async function getSettings() {
  let row = await db.hospitalSettings.findUnique({ where: { id: "singleton" } });
  if (!row) {
    row = await db.hospitalSettings.create({ data: { id: "singleton" } });
  }
  return row;
}

const SECRET_FIELDS = ["pinHash"] as const;

export type MaskedSettings = Omit<HospitalSettingsRow, (typeof SECRET_FIELDS)[number]> & {
  pinSet: boolean;
};

/** Client-safe view: secrets never leave the server, only their presence. */
export async function getMaskedSettings(): Promise<MaskedSettings> {
  const s = await getSettings();
  const { pinHash: _pinHash, ...safe } = s;
  return {
    ...safe,
    pinSet: !!s.pinHash,
  };
}

type SettingsUpdate = Partial<Record<string, string | boolean>>;

/** Apply a settings update. */
export async function updateSettings(patch: SettingsUpdate) {
  const allowed = [
    "appTitle", "hospitalName", "addressLine", "phone", "email", "footerMessage",
    "logoUrl", "loginTheme", "loginBgUrl",
    "usgDoctorName", "usgDoctorQual", "usgDoctorRegNo", "usgMachineLine",
    "usgFooterLine", "usgDeclarationLine", "usgPrintStyle",
    "usgPrintPaper", "usgSignatureUrl",
  ];
  const data: Record<string, string | boolean> = {};
  for (const k of allowed) {
    const v = patch[k];
    if (typeof v !== "string") continue;
    // Ordinary fields: trim so a pasted trailing space or newline can never
    // corrupt a stored value. An empty string IS a valid update (clearing).
    data[k] = v.trim();
  }
  // USG machine banner toggle arrives as a string checkbox value.
  if (typeof patch.usgShowMachine === "string") {
    data.usgShowMachine = !/^(0|false|off|no)$/i.test(patch.usgShowMachine.trim());
  } else if (typeof patch.usgShowMachine === "boolean") {
    data.usgShowMachine = patch.usgShowMachine;
  }
  // Print style: anything other than "classic" means the premium letterhead.
  if (typeof patch.usgPrintStyle === "string") {
    data.usgPrintStyle = patch.usgPrintStyle.trim() === "classic" ? "classic" : "premium";
  }
  // Paper size: anything other than "a5" means A4.
  if (typeof patch.usgPrintPaper === "string") {
    data.usgPrintPaper = patch.usgPrintPaper.trim() === "a5" ? "a5" : "a4";
  }
  // Compact print density toggle (same string-checkbox contract).
  if (typeof patch.usgPrintCompact === "string") {
    data.usgPrintCompact = !/^(0|false|off|no)$/i.test(patch.usgPrintCompact.trim());
  } else if (typeof patch.usgPrintCompact === "boolean") {
    data.usgPrintCompact = patch.usgPrintCompact;
  }
  await getSettings(); // ensure row exists
  await db.hospitalSettings.update({ where: { id: "singleton" }, data });
}

export async function setPinHash(hash: string) {
  await getSettings();
  await db.hospitalSettings.update({ where: { id: "singleton" }, data: { pinHash: hash } });
}
