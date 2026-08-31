/**
 * Draft autosave + dictation text tests (v5 phase 5).
 *
 * The crash-recovery contract: snapshots round-trip through storage (mocked —
 * localStorage is injectable), corrupt entries never crash the composer,
 * quota errors are swallowed, and the dirty check is exact. Dictation
 * transcripts append sentence-aware.
 */
import { describe, expect, it } from "vitest";
import {
  clearDraft, draftKey, loadDraft, saveDraft, snapshotDiffers, type DraftSnapshot,
} from "@/lib/usg/drafts";
import { appendTranscript, speechSupported } from "@/lib/usg/dictation";

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(k: string) { return this.map.get(k) ?? null; }
  setItem(k: string, v: string) { this.map.set(k, v); }
  removeItem(k: string) { this.map.delete(k); }
}

class FullStorage {
  getItem() { return null; }
  setItem() { throw new Error("QuotaExceededError"); }
  removeItem() {}
}

const snap = (over: Partial<DraftSnapshot> = {}): DraftSnapshot => ({
  savedAt: 1_700_000_000_000,
  patientName: "Rani Devi",
  patientPhone: "9431234567",
  patientAge: "30",
  patientSex: "F",
  referredBy: "Dr. Kumar",
  studyKey: "wa-female",
  technique: "supine",
  scanDate: "2026-08-31",
  state: { studyKey: "wa-female", organs: [], impressionOverride: null },
  ...over,
});

describe("draft storage round-trip", () => {
  it("keys drafts per report id, with 'new' for unsaved reports", () => {
    expect(draftKey("abc123")).toBe("usg-draft:abc123");
    expect(draftKey(null)).toBe("usg-draft:new");
  });

  it("saves and loads a snapshot verbatim", () => {
    const s = new MemoryStorage();
    expect(saveDraft("usg-draft:new", snap(), s)).toBe(true);
    expect(loadDraft("usg-draft:new", s)).toEqual(snap());
  });

  it("clearDraft removes the snapshot", () => {
    const s = new MemoryStorage();
    saveDraft("usg-draft:x", snap(), s);
    clearDraft("usg-draft:x", s);
    expect(loadDraft("usg-draft:x", s)).toBeNull();
  });

  it("returns null for absent or corrupt entries instead of throwing", () => {
    const s = new MemoryStorage();
    expect(loadDraft("usg-draft:missing", s)).toBeNull();
    s.setItem("usg-draft:bad", "{not json");
    expect(loadDraft("usg-draft:bad", s)).toBeNull();
    s.setItem("usg-draft:notobj", "42");
    expect(loadDraft("usg-draft:notobj", s)).toBeNull();
  });

  it("swallows quota errors (best-effort autosave)", () => {
    expect(saveDraft("usg-draft:full", snap(), new FullStorage())).toBe(false);
  });

  it("treats undefined storage as a no-op", () => {
    expect(saveDraft("k", snap(), undefined)).toBe(false);
    expect(loadDraft("k", undefined)).toBeNull();
  });
});

describe("dirty detection (snapshotDiffers)", () => {
  it("no difference when the report is untouched", () => {
    expect(snapshotDiffers(snap(), snap())).toBe(false);
  });

  it("flags a typed measurement change", () => {
    const next = { ...snap(), state: { studyKey: "wa-female", organs: [{ organ: "liver", vars: { span: "15.6" } }], impressionOverride: null } };
    expect(snapshotDiffers(snap(), next)).toBe(true);
  });

  it("flags patient field changes but not the savedAt timestamp", () => {
    expect(snapshotDiffers(snap(), { ...snap(), patientName: "RANI DEVI" })).toBe(true);
    const { savedAt: _ignored, ...rest } = snap({ savedAt: 999 });
    expect(snapshotDiffers(snap(), rest)).toBe(false);
  });
});

describe("dictation transcript appending", () => {
  it("capitalises the first transcript on an empty field", () => {
    expect(appendTranscript("", "gall bladder is normal")).toBe("Gall bladder is normal");
  });

  it("joins with a space and capitalises after existing text", () => {
    expect(appendTranscript("Liver normal.", "no focal lesion")).toBe("Liver normal. No focal lesion");
    expect(appendTranscript("Liver normal", "no masses")).toBe("Liver normal No masses");
  });

  it("does not double-space when the field already ends with one", () => {
    expect(appendTranscript("Liver normal ", "no masses")).toBe("Liver normal No masses");
  });

  it("keeps existing capitalisation and ignores empty transcripts", () => {
    expect(appendTranscript("CBD 4 mm", "not dilated")).toBe("CBD 4 mm Not dilated");
    expect(appendTranscript("Liver normal", "")).toBe("Liver normal");
    expect(appendTranscript("Liver normal", "   ")).toBe("Liver normal");
  });
});

describe("speech support detection", () => {
  it("reports false outside a browser (node test env)", () => {
    expect(speechSupported()).toBe(false);
  });
});
