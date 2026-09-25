/**
 * Unit tests for Ollama AI draft skeleton parsing (no live Ollama required).
 */
import { describe, expect, it } from "vitest";
import {
  extractJsonObject,
  parseAiDraftSkeleton,
  type AiDraftOrganInput,
} from "@/lib/usg/aiDraft";

const ORGANS: AiDraftOrganInput[] = [
  { key: "liver", label: "LIVER", allowedKeys: ["liver-fatty-g1", "liver-abscess"] },
  { key: "gb", label: "G. B", allowedKeys: ["gb-calculus"] },
  { key: "pancreas", label: "PANCREAS", allowedKeys: [] },
];

describe("extractJsonObject", () => {
  it("parses bare JSON", () => {
    expect(extractJsonObject('{"organs":[]}')).toBe('{"organs":[]}');
  });

  it("strips markdown fences", () => {
    const raw = "```json\n{\"organs\":[{\"organKey\":\"liver\",\"findingKey\":\"normal\"}]}\n```";
    expect(extractJsonObject(raw)).toContain('"organKey":"liver"');
  });

  it("returns null for non-JSON", () => {
    expect(extractJsonObject("FINDINGS:\nLiver normal")).toBeNull();
  });
});

describe("parseAiDraftSkeleton", () => {
  it("maps normal / null / empty findingKey to null", () => {
    const raw = JSON.stringify({
      organs: [
        { organKey: "liver", findingKey: "normal" },
        { organKey: "gb", findingKey: null },
        { organKey: "pancreas", findingKey: "" },
      ],
      impression: ["Normal scan of upper abdomen."],
      advice: ["Correlate clinically for pain abdomen."],
    });
    const sk = parseAiDraftSkeleton(raw, ORGANS);
    expect(sk.organs).toEqual([
      { organKey: "liver", findingKey: null, label: "LIVER" },
      { organKey: "gb", findingKey: null, label: "G. B" },
      { organKey: "pancreas", findingKey: null, label: "PANCREAS" },
    ]);
    expect(sk.impression).toEqual(["Normal scan of upper abdomen."]);
    expect(sk.advice[0]).toMatch(/pain abdomen/i);
  });

  it("keeps real pathology keys and drops invented ones", () => {
    const raw = JSON.stringify({
      organs: [
        { organKey: "liver", findingKey: "liver-fatty-g1" },
        { organKey: "gb", findingKey: "made-up-stone" },
      ],
      impression: [],
      advice: [],
    });
    const sk = parseAiDraftSkeleton(raw, ORGANS);
    expect(sk.organs).toEqual([{ organKey: "liver", findingKey: "liver-fatty-g1", label: "LIVER" }]);
  });

  it("drops unknown organ keys", () => {
    const raw = JSON.stringify({
      organs: [{ organKey: "thyroid", findingKey: "normal" }],
    });
    const sk = parseAiDraftSkeleton(raw, ORGANS);
    // Falls back to full normal skeleton for known organs when none survive.
    expect(sk.organs.map((o) => o.organKey).sort()).toEqual(["gb", "liver", "pancreas"]);
    expect(sk.organs.every((o) => o.findingKey === null)).toBe(true);
  });

  it("never throws on invalid JSON — empty / fallback skeleton", () => {
    expect(parseAiDraftSkeleton("not json", ORGANS).organs).toHaveLength(3);
    expect(parseAiDraftSkeleton("", [])).toEqual({ organs: [], impression: [], advice: [] });
    expect(parseAiDraftSkeleton("{bad", ORGANS).organs).toHaveLength(3);
  });

  it("accepts fenced model output", () => {
    const raw = "Here you go:\n```json\n{\"organs\":[{\"organKey\":\"liver\",\"findingKey\":\"liver-fatty-g1\"}],\"impression\":[\"Grade I fatty liver.\"],\"advice\":[\"LFT\"]}\n```\n";
    const sk = parseAiDraftSkeleton(raw, ORGANS);
    expect(sk.organs[0]).toMatchObject({ organKey: "liver", findingKey: "liver-fatty-g1" });
    expect(sk.impression).toEqual(["Grade I fatty liver."]);
  });
});
