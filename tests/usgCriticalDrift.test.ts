/**
 * Drift-guard referee for the critical findings registry.
 *
 * CRITICAL_REGISTRY keys must exist in the live pathology catalog
 * (pathologies.ts + pathologies-extra.ts). A full-catalog scan must fire
 * ≥ 8 alerts so the banner feature cannot silently go dark again.
 *
 * Do not weaken these assertions — fix the registry instead.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { USG_PATHOLOGIES_ALL } from "@/lib/usg/pathologies";
import {
  isCriticalPathology,
  scanForCriticalFindings,
} from "@/lib/usg/criticalFindings";

/** Parse CRITICAL_REGISTRY keys from source (registry is module-private). */
function registryKeysFromSource(): string[] {
  const src = readFileSync(
    join(process.cwd(), "src/lib/usg/criticalFindings.ts"),
    "utf8",
  );
  const block = src.match(/const CRITICAL_REGISTRY[\s\S]*?\n\};/)?.[0] ?? "";
  return [...block.matchAll(/^\s*"([^"]+)":\s*\{/gm)].map((m) => m[1]!);
}

describe("critical findings registry drift", () => {
  const catalogKeys = new Set(USG_PATHOLOGIES_ALL.map((p) => p.key));
  const registryKeys = registryKeysFromSource();

  test("CRITICAL_REGISTRY is non-empty", () => {
    expect(registryKeys.length).toBeGreaterThanOrEqual(8);
  });

  test("every CRITICAL_REGISTRY key exists in the pathology catalog", () => {
    const orphans = registryKeys.filter((k) => !catalogKeys.has(k));
    expect(orphans, `orphan registry keys (not in catalog): ${orphans.join(", ")}`).toEqual([]);
  });

  test("isCriticalPathology agrees with every registry key", () => {
    for (const k of registryKeys) {
      expect(isCriticalPathology(k), k).toBe(true);
    }
  });

  test("full-catalog scan fires >= 8 alerts", () => {
    const selected = USG_PATHOLOGIES_ALL.map((p) => ({
      key: p.key,
      label: p.label,
      organ: p.organ,
    }));
    const alerts = scanForCriticalFindings(selected);
    expect(alerts.length).toBeGreaterThanOrEqual(8);
    // Every alert key must be a real registry entry that exists in catalog.
    for (const a of alerts) {
      expect(catalogKeys.has(a.pathologyKey)).toBe(true);
      expect(isCriticalPathology(a.pathologyKey)).toBe(true);
    }
  });
});
