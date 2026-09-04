/**
 * Tests for tokenTypes — the selectable dropdown token system.
 */
import { describe, expect, it } from "vitest";
import { getTokenType, isSelectToken, getTokenOptions } from "@/lib/usg/tokenTypes";

describe("tokenTypes", () => {
  it("identifies 'loc' as a select token", () => {
    expect(isSelectToken("loc")).toBe(true);
    const options = getTokenOptions("loc");
    expect(options).not.toBeNull();
    expect(options!.length).toBeGreaterThanOrEqual(5);
    expect(options!.find((o) => o.value === "upper calyx")).toBeDefined();
    expect(options!.find((o) => o.value === "middle calyx")).toBeDefined();
    expect(options!.find((o) => o.value === "lower calyx")).toBeDefined();
  });

  it("identifies 'cortex' as a select token", () => {
    expect(isSelectToken("cortex")).toBe(true);
  });

  it("identifies 'hydro_grade' as a select token", () => {
    expect(isSelectToken("hydro_grade")).toBe(true);
    const options = getTokenOptions("hydro_grade");
    expect(options!.find((o) => o.value === "mild")).toBeDefined();
    expect(options!.find((o) => o.value === "severe")).toBeDefined();
  });

  it("identifies 'placenta' as a select token", () => {
    expect(isSelectToken("placenta")).toBe(true);
    const options = getTokenOptions("placenta");
    expect(options!.find((o) => o.value === "anterior")).toBeDefined();
    expect(options!.find((o) => o.value === "praevia")).toBeDefined();
  });

  it("identifies 'presentation' as a select token", () => {
    expect(isSelectToken("presentation")).toBe(true);
    const options = getTokenOptions("presentation");
    expect(options!.find((o) => o.value === "cephalic")).toBeDefined();
    expect(options!.find((o) => o.value === "breech")).toBeDefined();
  });

  it("returns false for unregistered tokens (free-text)", () => {
    expect(isSelectToken("size")).toBe(false);
    expect(isSelectToken("l1")).toBe(false);
    expect(isSelectToken("unknown_token")).toBe(false);
  });

  it("returns null options for unregistered tokens", () => {
    expect(getTokenOptions("size")).toBeNull();
    expect(getTokenOptions("l1")).toBeNull();
  });

  it("returns null type for unregistered tokens", () => {
    expect(getTokenType("unknown_token")).toBeNull();
  });

  it("returns type='select' for registered select tokens", () => {
    const t = getTokenType("loc");
    expect(t).not.toBeNull();
    expect(t!.type).toBe("select");
    expect(t!.options).toBeDefined();
    expect(t!.options!.length).toBeGreaterThan(0);
  });

  it("has kidney calyx options including upper, middle, lower", () => {
    const options = getTokenOptions("loc")!;
    const values = options.map((o) => o.value);
    expect(values).toContain("upper calyx");
    expect(values).toContain("middle calyx");
    expect(values).toContain("lower calyx");
  });
});
