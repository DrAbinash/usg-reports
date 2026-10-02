import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { careBillingPollEnabled, careFinalizeEnabled } from "@/lib/usg/careClient";

const FLAG_VALUES_OFF = ["0", "false", "off", "no", "OFF", " No "];
const FLAG_VALUES_ON = ["", "1", "true", "on", "yes", "garbage"];

const savedFinalize = process.env.CARE_FINALIZE_ENABLED;
const savedBilling = process.env.CARE_BILLING_POLL_ENABLED;

afterEach(() => {
  for (const [name, value] of [
    ["CARE_FINALIZE_ENABLED", savedFinalize],
    ["CARE_BILLING_POLL_ENABLED", savedBilling],
  ] as const) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe("CARE write-back flags", () => {
  it("treats only an explicit negative value as disabled", () => {
    for (const v of FLAG_VALUES_OFF) {
      process.env.CARE_FINALIZE_ENABLED = v;
      process.env.CARE_BILLING_POLL_ENABLED = v;
      expect(careFinalizeEnabled(), `CARE_FINALIZE_ENABLED=${v}`).toBe(false);
      expect(careBillingPollEnabled(), `CARE_BILLING_POLL_ENABLED=${v}`).toBe(false);
    }
  });

  it("stays enabled when unset or given anything else", () => {
    for (const v of FLAG_VALUES_ON) {
      process.env.CARE_FINALIZE_ENABLED = v;
      process.env.CARE_BILLING_POLL_ENABLED = v;
      expect(careFinalizeEnabled(), `CARE_FINALIZE_ENABLED=${JSON.stringify(v)}`).toBe(true);
      expect(careBillingPollEnabled(), `CARE_BILLING_POLL_ENABLED=${JSON.stringify(v)}`).toBe(true);
    }
    delete process.env.CARE_FINALIZE_ENABLED;
    delete process.env.CARE_BILLING_POLL_ENABLED;
    expect(careFinalizeEnabled()).toBe(true);
    expect(careBillingPollEnabled()).toBe(true);
  });

  it("ships both flags switched off in the production compose file", () => {
    const compose = readFileSync(
      path.resolve(process.cwd(), "docker-compose.yml"),
      "utf8",
    );
    expect(compose).toMatch(/CARE_FINALIZE_ENABLED=\$\{CARE_FINALIZE_ENABLED:-0\}/);
    expect(compose).toMatch(/CARE_BILLING_POLL_ENABLED=\$\{CARE_BILLING_POLL_ENABLED:-0\}/);
  });

  it("never calls the ERP write endpoints outside a flag guard", () => {
    // The flag is the only thing standing between the Studio and a call the
    // ERP will reject; a future edit that adds an unguarded call site has to
    // fail here rather than silently re-open the retry loop.
    const guards: Record<string, string> = {
      "await finalizeReport(": "careFinalizeEnabled()",
      "await fetchBillingStatus(": "careBillingPollEnabled()",
    };
    for (const rel of [
      "src/app/api/usg/reports/[id]/finalize/route.ts",
      "src/app/api/usg/worklist/sync/route.ts",
    ]) {
      const src = readFileSync(path.resolve(process.cwd(), rel), "utf8");
      for (const [call, guard] of Object.entries(guards)) {
        let from = 0;
        for (let at = src.indexOf(call, from); at >= 0; at = src.indexOf(call, from)) {
          expect(src.slice(Math.max(0, at - 600), at), `${rel}: ${call} needs ${guard}`).toContain(guard);
          from = at + call.length;
        }
      }
    }
  });
});
