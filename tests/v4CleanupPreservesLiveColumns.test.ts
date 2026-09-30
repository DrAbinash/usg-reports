/**
 * The v4 cleanup script runs on every container boot, BEFORE `prisma db push`.
 * It used to drop its hard-coded legacy column list unconditionally — and v6
 * re-declared several of those names as live integration settings. Result:
 * every restart deleted the clinic's saved CARE ERP + Orthanc configuration,
 * and db push quietly recreated the columns empty, so nothing ever looked
 * wrong in the boot log.
 *
 * These tests pin the guard: the schema, not the legacy list, decides.
 */
import { describe, expect, it } from "vitest";
import path from "node:path";
import { db } from "@/lib/db";
import {
  LEGACY_SETTINGS_COLUMNS,
  droppableSettingsColumns,
  schemaSettingsColumns,
} from "../scripts/usg-v4-cleanup.mjs";

const SCHEMA = path.resolve(process.cwd(), "prisma/schema.prisma");

/** Live v6 integration settings — the ones the boot loop used to destroy. */
const LIVE_INTEGRATION_COLUMNS = [
  "careApiBase",
  "careApiKey",
  "orthancUrl",
  "orthancUsername",
  "orthancPassword",
];

describe("v4 cleanup never drops a column the schema declares", () => {
  it("keeps every live CARE / Orthanc setting out of the drop set", () => {
    const droppable = droppableSettingsColumns(schemaSettingsColumns(SCHEMA));
    for (const col of LIVE_INTEGRATION_COLUMNS) {
      // They are still named in the legacy list (they WERE MRI-era names);
      // what matters is that naming them can no longer destroy them.
      expect(LEGACY_SETTINGS_COLUMNS).toContain(col);
      expect(droppable).not.toContain(col);
    }
  });

  it("still removes genuinely dead MRI columns", () => {
    // The guard must not neuter the cleanup: radiologist* have no schema field,
    // and leaving them in the DB would make db push refuse the boot as
    // destructive.
    const droppable = droppableSettingsColumns(schemaSettingsColumns(SCHEMA));
    expect(droppable).toEqual(expect.arrayContaining(["radiologistName", "radiologistQual", "radiologistRegNo"]));
  });

  it("drops nothing at all when the schema cannot be read", () => {
    expect(droppableSettingsColumns(schemaSettingsColumns(path.join(SCHEMA, "../../missing.prisma")))).toEqual([]);
  });
});

describe("schema parser matches the database that db push actually builds", () => {
  it("parses a full HospitalSettings field set, not a truncated one", () => {
    const live = schemaSettingsColumns(SCHEMA);
    expect(live).not.toBeNull();
    expect(live!.size).toBeGreaterThan(40);
    expect(live!.has("id")).toBe(true);
    expect(live!.has("hospitalName")).toBe(true);
    expect(live!.has("usgPrintStyle")).toBe(true);
    // Comment-only lines must not be mistaken for fields.
    expect(live!.has("v6")).toBe(false);
    expect(live!.has("header")).toBe(false);
  });

  it("agrees with the real SQLite columns", async () => {
    const rows = await db.$queryRawUnsafe<{ name: string }[]>(`PRAGMA table_info("HospitalSettings")`);
    const actual = new Set(rows.map((r) => String(r.name)));
    const live = schemaSettingsColumns(SCHEMA)!;
    for (const col of live) {
      expect(actual.has(col)).toBe(true);
    }
    // And the dead ones are genuinely absent from the built database too.
    for (const col of ["radiologistName", "careApiBase"]) {
      if (live.has(col)) expect(actual.has(col)).toBe(true);
      else expect(actual.has(col)).toBe(false);
    }
  });
});
