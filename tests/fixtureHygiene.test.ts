/**
 * Fixtures must never be people.
 *
 * A name that came from a live database reaches GitHub the moment it is pasted
 * into a test: it renders onto a letterhead in the print goldens, appears in a
 * share URL in an integration suite, and survives forever because nobody reads
 * a test file closely. This guard is the only thing that notices.
 *
 * It checks the fact (a real name in a shipped file), not a line in one file —
 * a ban list that only the echo test reads protects the echo test.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { REAL_PATIENT_NAMES } from "./fixtures/realPatientNames";

const ROOT = process.cwd();

/** Every folder the studio ships or runs. `data/` is runtime state, not source. */
const SCAN_DIRS = ["src", "tests", "prisma", "scripts"];
const EXTENSIONS = [".ts", ".tsx", ".mjs", ".js", ".prisma", ".html", ".md", ".json"];
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", ".tmp", "__snapshots__"]);

/** This guard holds the names it hunts for, so it cannot be scanned. */
const SELF_EXCLUDED = new Set(["tests/fixtures/realPatientNames.ts", "tests/fixtureHygiene.test.ts"]);

function walk(absDir: string, relDir = "", out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(absDir);
  } catch {
    return out; // a folder that is not here on a fresh clone is not a leak
  }
  for (const entry of entries) {
    const rel = relDir ? `${relDir}/${entry}` : entry;
    if (SKIP_DIRS.has(entry)) continue;
    const st = statSync(join(absDir, entry));
    if (st.isDirectory()) walk(join(absDir, entry), rel, out);
    else if (EXTENSIONS.some((ext) => entry.endsWith(ext)) && !SELF_EXCLUDED.has(rel)) out.push(rel);
  }
  return out;
}

describe("no patient who exists is ever a fixture", () => {
  const files = SCAN_DIRS.flatMap((dir) => walk(join(ROOT, dir), dir));

  it("scans a meaningful number of files — an empty list would pass by accident", () => {
    expect(files.length).toBeGreaterThan(200);
  });

  it("finds no real patient or referring-doctor name in any shipped file", () => {
    const leaks: string[] = [];
    for (const rel of files) {
      const text = readFileSync(join(ROOT, rel), "utf8");
      for (const name of REAL_PATIENT_NAMES) {
        if (new RegExp(`\\b${name}\\b`, "i").test(text)) leaks.push(`${rel} — ${name}`);
      }
    }
    expect(leaks).toEqual([]);
  });
});
