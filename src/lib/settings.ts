import { db } from "@/lib/db";

export type HospitalSettingsRow = Awaited<ReturnType<typeof getSettings>>;

/** Get (or lazily create) the singleton settings row. */
export async function getSettings() {
  let row = await db.hospitalSettings.findUnique({ where: { id: "singleton" } });
  if (!row) {
    row = await db.hospitalSettings.create({ data: { id: "singleton" } });
  }
  return row;
}

const SECRET_FIELDS = ["careApiKey", "orthancPassword", "pinHash"] as const;

export type MaskedSettings = Omit<HospitalSettingsRow, (typeof SECRET_FIELDS)[number]> & {
  careApiKeySet: boolean;
  orthancPasswordSet: boolean;
  pinSet: boolean;
};

/** Client-safe view: secrets never leave the server, only their presence. */
export async function getMaskedSettings(): Promise<MaskedSettings> {
  const s = await getSettings();
  const {
    careApiKey: _careApiKey, orthancPassword: _orthancPassword, pinHash: _pinHash,
    ...safe
  } = s;
  return {
    ...safe,
    careApiKeySet: !!s.careApiKey,
    orthancPasswordSet: !!s.orthancPassword,
    pinSet: !!s.pinHash,
  };
}

type SettingsUpdate = Partial<Record<string, string>>;

/** Apply a settings update. Empty-string secret fields = "keep existing". */
export async function updateSettings(patch: SettingsUpdate) {
  const allowed = [
    "appTitle", "hospitalName", "addressLine", "phone", "email", "footerMessage",
    "logoUrl", "radiologistName", "radiologistQual", "radiologistRegNo",
    "careApiBase", "careApiKey", "orthancUrl", "orthancUsername", "orthancPassword",
    "ohifLanUrl", "ohifTailscaleUrl", "loginTheme", "loginBgUrl",
  ];
  const data: Record<string, string> = {};
  for (const k of allowed) {
    const v = patch[k];
    if (typeof v !== "string") continue;
    if ((k === "careApiKey" || k === "orthancPassword") && v.trim() === "") continue; // keep
    data[k] = v;
  }
  await getSettings(); // ensure row exists
  await db.hospitalSettings.update({ where: { id: "singleton" }, data });
}

export async function setPinHash(hash: string) {
  await getSettings();
  await db.hospitalSettings.update({ where: { id: "singleton" }, data: { pinHash: hash } });
}
