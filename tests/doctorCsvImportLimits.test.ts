/**
 * The doctor CSV import is bounded.
 *
 * `POST /api/usg/doctors/import` used to read whatever arrived into one string
 * and then run one `upsert` per line, with no ceiling on either. Choosing the
 * wrong file in Settings — a full billing export instead of the referring-doctor
 * list — was therefore an unbounded read on a container capped at 512 MB,
 * followed by a write lock the reporting clinic has to wait out. The caps are
 * 2 MB and 5,000 rows, and both say so in the message the toast shows.
 *
 * What these tests pin is the *behaviour*, not the constants: nothing is
 * written, nothing is audited, and a normal list still imports.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  requireSession: async () => null,
  getActiveClinicId: async () => "default",
}));

import { POST } from "@/app/api/usg/doctors/import/route";
import { db } from "@/lib/db";
import { MAX_DOCTOR_CSV_BYTES, MAX_DOCTOR_CSV_ROWS, doctorCsvRowCount } from "@/lib/usg/doctors";

const HEADER = "name,specialization,degree,phone,hospital,area";

function csv(rows: number): string {
  const lines = [HEADER];
  for (let i = 0; i < rows; i++) {
    lines.push(`Probe Doctor${i + 1},Radiology,MBBS,900000${(i % 100).toString().padStart(2, "0")},Care Diagnostics,Jharkhand`);
  }
  return lines.join("\n");
}

function raw(text: string, headers: Record<string, string> = {}) {
  return new NextRequest("http://clinic/api/usg/doctors/import", {
    method: "POST",
    headers: { "content-type": "text/csv", ...headers },
    body: text as BodyInit,
  });
}

async function multipart(file: File) {
  const form = new FormData();
  form.append("file", file);
  // No content-type: fetch/Request sets the multipart boundary itself.
  return new NextRequest("http://clinic/api/usg/doctors/import", { method: "POST", body: form as BodyInit });
}

beforeEach(async () => {
  await db.usgDoctor.deleteMany();
  await db.usgAudit.deleteMany();
});

describe("the byte ceiling", () => {
  it("refuses a raw body over the limit and writes nothing", async () => {
    const big = "x".repeat(MAX_DOCTOR_CSV_BYTES + 1024);
    const res = await POST(raw(big));
    expect(res.status).toBe(413);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/MB/);
    expect(await db.usgDoctor.count()).toBe(0);
  });

  it("refuses an upload whose file is over the limit", async () => {
    const file = new File([new Uint8Array(MAX_DOCTOR_CSV_BYTES + 4096)], "wrong-export.csv", {
      type: "text/csv",
    });
    const res = await POST(await multipart(file));
    expect(res.status).toBe(413);
    expect(((await res.json()) as { error: string }).error).toMatch(/2 MB/);
    expect(await db.usgDoctor.count()).toBe(0);
  });

  it("stops a chunked upload that never declared a length", async () => {
    // A real fetch would have set Content-Length and been turned away by the
    // pre-check above; this is the branch that exists for the request that does
    // not — the accumulator has to give up mid-stream, not at the end.
    const chunk = new TextEncoder().encode("x".repeat(64 * 1024));
    const chunks = Array.from({ length: Math.ceil(MAX_DOCTOR_CSV_BYTES / chunk.length) + 3 }, () => chunk);
    let served = 0;
    const req = {
      headers: new Headers({ "content-type": "text/csv" }),
      body: {
        getReader: () => ({
          read: async () =>
            served < chunks.length ? { done: false, value: chunks[served++] } : { done: true, value: undefined },
          cancel: async () => {},
        }),
      },
    } as unknown as Request;

    const res = await POST(req);
    expect(res.status).toBe(413);
    expect(served, "the stream has to be abandoned, not read to the end").toBeLessThan(chunks.length);
    expect(await db.usgDoctor.count()).toBe(0);
  });

  it("turns away an oversized request on its declared length, before reading it", async () => {
    // A hand-built Request, because undici recomputes Content-Length from any
    // real body and would erase the very number this test is about. The stream
    // records whether it was touched: the point of the pre-check is that the
    // body is never buffered.
    let read = false;
    const req = {
      headers: new Headers({
        "content-type": "text/csv",
        "content-length": String(MAX_DOCTOR_CSV_BYTES * 3),
      }),
      body: {
        getReader: () => ({
          read: async () => {
            read = true;
            return { done: true, value: undefined };
          },
          cancel: async () => {},
        }),
      },
    } as unknown as Request;

    const res = await POST(req);
    expect(res.status).toBe(413);
    expect(read, "the declared-length check has to run before the body is read").toBe(false);
    expect(await db.usgDoctor.count()).toBe(0);
  });
});

describe("the row ceiling", () => {
  it("refuses more rows than one import is meant to take", async () => {
    const res = await POST(raw(csv(MAX_DOCTOR_CSV_ROWS + 5)));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain((MAX_DOCTOR_CSV_ROWS + 5).toLocaleString("en-IN"));
    expect(body.error).toContain("split");
    expect(await db.usgDoctor.count()).toBe(0);
    expect(await db.usgAudit.count()).toBe(0);
  });

  it("still imports a normal list, to the last row", async () => {
    const res = await POST(raw(csv(37)));
    expect(res.status).toBe(200);
    expect((await res.json()) as { imported: number }).toMatchObject({ imported: 37 });
    expect(await db.usgDoctor.count()).toBe(37);
  });

  it("counts rows the way the importer walks them, not by raw newlines", async () => {
    // Trailing blank lines are the common shape of an exported CSV and must not
    // push an honest file over the ceiling.
    const text = csv(3) + "\n\n\n";
    expect(doctorCsvRowCount(text)).toBe(3);
    const res = await POST(raw(text));
    expect(res.status).toBe(200);
    expect((await res.json()) as { total: number }).toMatchObject({ total: 3 });
  });
});
