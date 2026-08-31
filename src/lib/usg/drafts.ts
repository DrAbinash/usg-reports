/**
 * USG Studio — local draft autosave (v5 phase 5).
 *
 * Crash insurance for the scan room: the composer snapshot is mirrored to
 * localStorage (debounced) so a browser crash, accidental tab close or power
 * cut never costs a half-typed report. Storage is injectable for tests;
 * machine stills never travel through here (they are server-side rows).
 */

export type DraftSnapshot = {
  savedAt: number;
  patientName: string;
  patientPhone: string;
  patientAge: string;
  patientSex: string;
  referredBy: string;
  studyKey: string;
  technique: string;
  scanDate: string;
  state: unknown; // UsgComposerState — kept opaque so the lib stays pure
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const PREFIX = "usg-draft:";

export function draftKey(reportId: string | null): string {
  return `${PREFIX}${reportId ?? "new"}`;
}

/** Persist a snapshot. Returns false when storage is unavailable/full —
 *  autosave is best-effort and must never break the composer. */
export function saveDraft(
  key: string,
  snap: DraftSnapshot,
  storage: StorageLike | undefined = safeStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(snap));
    return true;
  } catch {
    // Quota exceeded (private mode, huge localStorage) — silently skip.
    return false;
  }
}

/** Load a snapshot (null when absent or corrupt). */
export function loadDraft(
  key: string,
  storage: StorageLike | undefined = safeStorage(),
): DraftSnapshot | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftSnapshot;
    if (typeof parsed !== "object" || parsed === null || typeof parsed.savedAt !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Remove a draft (after finalization or discard). */
export function clearDraft(key: string, storage: StorageLike | undefined = safeStorage()): void {
  try {
    storage?.removeItem(key);
  } catch {
    // best effort
  }
}

function safeStorage(): StorageLike | undefined {
  try {
    if (typeof globalThis.localStorage === "undefined") return undefined;
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

/** Has the report been edited since this snapshot was taken? */
export function snapshotDiffers(
  snap: DraftSnapshot,
  current: Omit<DraftSnapshot, "savedAt">,
): boolean {
  for (const k of Object.keys(current) as (keyof Omit<DraftSnapshot, "savedAt">)[]) {
    if (JSON.stringify(snap[k]) !== JSON.stringify(current[k])) return true;
  }
  return false;
}
