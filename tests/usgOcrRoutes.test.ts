/**
 * OCR API route guards — session required; fullResUrl same-origin only.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireSession = vi.fn();

vi.mock("@/lib/auth", () => ({
  requireSession: (...args: unknown[]) => requireSession(...args),
}));

vi.mock("@/lib/usg/biometryOcr", () => ({
  biometryOcr: vi.fn(async () => ({ ocr: null, engine: null })),
}));

import { POST } from "@/app/api/usg/ocr/route";
import { GET } from "@/app/api/usg/ocr/test/route";

describe("POST /api/usg/ocr", () => {
  beforeEach(() => {
    requireSession.mockReset();
  });

  it("returns 401 without a session", async () => {
    requireSession.mockResolvedValue(
      Response.json({ error: "unauthorized" }, { status: 401 }),
    );
    const req = new NextRequest("http://localhost/api/usg/ocr", {
      method: "POST",
      body: JSON.stringify({ imageBase64: "data:image/png;base64,AAAA" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("unauthorized");
  });

  it("returns 400 when fullResUrl is an absolute URL", async () => {
    requireSession.mockResolvedValue(null);
    const req = new NextRequest("http://localhost/api/usg/ocr", {
      method: "POST",
      body: JSON.stringify({
        imageBase64: "data:image/png;base64,AAAA",
        fullResUrl: "https://evil.example/steal",
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/same-origin relative path/i);
  });

  it("returns 400 when fullResUrl is protocol-relative", async () => {
    requireSession.mockResolvedValue(null);
    const req = new NextRequest("http://localhost/api/usg/ocr", {
      method: "POST",
      body: JSON.stringify({
        imageBase64: "data:image/png;base64,AAAA",
        fullResUrl: "//evil.example/steal",
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/usg/ocr/test", () => {
  beforeEach(() => {
    requireSession.mockReset();
  });

  it("returns 401 without a session", async () => {
    requireSession.mockResolvedValue(
      Response.json({ error: "unauthorized" }, { status: 401 }),
    );
    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("unauthorized");
  });
});
