/**
 * Secure share tokens + WhatsApp deep-link routing (Rung 5).
 */
import { describe, expect, it } from "vitest";
import {
  buildShareMessage,
  buildWaMeUrl,
  createShareToken,
  normalizeWaPhone,
  planWhatsappShare,
  shareUrlForToken,
  verifyShareToken,
} from "@/lib/usg/secureShare";

const SECRET = "test-share-secret-for-unit-tests-only";

describe("share token generation / validation", () => {
  it("valid token round-trips reportId", () => {
    const token = createShareToken("rep_abc123", { secret: SECRET, now: 1_700_000_000_000 });
    const v = verifyShareToken(token, { secret: SECRET, now: 1_700_000_000_000 });
    expect(v).toEqual({ reportId: "rep_abc123", exp: 1_700_000_000_000 + 7 * 24 * 60 * 60 * 1000 });
  });

  it("rejects tampered token", () => {
    const token = createShareToken("rep_abc123", { secret: SECRET });
    const [body] = token.split(".");
    const bad = `${body}.AAAA_tampered_sig`;
    expect(verifyShareToken(bad, { secret: SECRET })).toEqual({ error: "invalid" });
  });

  it("rejects expired token", () => {
    const now = 1_700_000_000_000;
    const token = createShareToken("rep_abc123", {
      secret: SECRET,
      now,
      ttlMs: 1000,
    });
    expect(verifyShareToken(token, { secret: SECRET, now: now + 500 })).toMatchObject({
      reportId: "rep_abc123",
    });
    expect(verifyShareToken(token, { secret: SECRET, now: now + 2000 })).toEqual({
      error: "expired",
    });
  });

  it("rejects garbage / empty", () => {
    expect(verifyShareToken("", { secret: SECRET })).toEqual({ error: "invalid" });
    expect(verifyShareToken("not.a.token", { secret: SECRET })).toEqual({ error: "invalid" });
  });
});

describe("share URL never leaks PHI", () => {
  it("contains only opaque token — no patient name / phone / impression", () => {
    const token = createShareToken("rep_secret_id", { secret: SECRET });
    const url = shareUrlForToken("https://studio.example", token);
    expect(url).toBe(`https://studio.example/share/${encodeURIComponent(token)}`);
    expect(url).not.toMatch(/patient|Rani|98765|fatty|impression/i);
    // Query string must stay empty (no PHI params).
    expect(url.includes("?")).toBe(false);
  });
});

describe("wa.me URL construction", () => {
  const shareUrl = "https://studio.example/share/opaque.token";
  const message = buildShareMessage(shareUrl);

  it("normalizes Indian 10-digit phones to 91…", () => {
    expect(normalizeWaPhone("98765-43210")).toBe("919876543210");
    expect(normalizeWaPhone("+91 98765 43210")).toBe("919876543210");
    expect(normalizeWaPhone("123")).toBeNull();
  });

  it("patient_only targets patient phone", () => {
    const plan = planWhatsappShare({
      routing: "patient_only",
      shareUrl,
      patientPhone: "9876543210",
      doctorPhone: "9123456789",
    });
    expect(plan.copyFallback).toBe(false);
    expect(plan.primaryUrl).toBe(
      `https://wa.me/919876543210?text=${encodeURIComponent(message)}`,
    );
    expect(plan.secondaryUrl).toBeNull();
    expect(plan.primaryUrl).toContain(encodeURIComponent(shareUrl));
    expect(plan.primaryUrl).not.toMatch(/Rani|fatty/i);
  });

  it("doctor_only targets referring doctor phone", () => {
    const plan = planWhatsappShare({
      routing: "doctor_only",
      shareUrl,
      patientPhone: "9876543210",
      doctorPhone: "9123456789",
    });
    expect(plan.primaryUrl).toBe(
      `https://wa.me/919123456789?text=${encodeURIComponent(message)}`,
    );
    expect(plan.secondaryUrl).toBeNull();
  });

  it("patient_and_doctor returns both links", () => {
    const plan = planWhatsappShare({
      routing: "patient_and_doctor",
      shareUrl,
      patientPhone: "9876543210",
      doctorPhone: "9123456789",
    });
    expect(plan.primaryUrl).toContain("wa.me/919876543210");
    expect(plan.secondaryUrl).toContain("wa.me/919123456789");
    expect(plan.copyFallback).toBe(false);
  });

  it("falls back to copy when phone missing", () => {
    const plan = planWhatsappShare({
      routing: "patient_only",
      shareUrl,
      patientPhone: "",
      doctorPhone: "",
    });
    expect(plan.primaryUrl).toBeNull();
    expect(plan.copyFallback).toBe(true);
  });

  it("buildWaMeUrl returns null for blank phone", () => {
    expect(buildWaMeUrl("", "hi")).toBeNull();
    expect(buildWaMeUrl("9876543210", "hi")).toBe(
      `https://wa.me/919876543210?text=${encodeURIComponent("hi")}`,
    );
  });
});
