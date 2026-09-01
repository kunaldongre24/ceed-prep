import { describe, it, expect } from "vitest";
import { parseValueText } from "./answers";

describe("parseValueText", () => {
  const issues: string[] = [];

  it("parses single letter", () => {
    const e = parseValueText("B", issues, 1);
    expect(e.kind).toBe("letters");
    expect(e.acceptedSets).toEqual([["B"]]);
  });

  it("parses comma-separated letters", () => {
    const e = parseValueText("A, B, C", issues, 2);
    expect(e.kind).toBe("letters");
    expect(e.acceptedSets).toEqual([["A", "B", "C"]]);
  });

  it("parses concatenated letters", () => {
    const e = parseValueText("AD", issues, 3);
    expect(e.kind).toBe("letters");
    expect(e.acceptedSets).toEqual([["A", "D"]]);
  });

  it("parses semicolon-separated letters", () => {
    const e = parseValueText("C;D", issues, 4);
    expect(e.kind).toBe("letters");
    expect(e.acceptedSets).toEqual([["C", "D"]]);
  });

  it("parses alternate sets with 'or'", () => {
    const e = parseValueText("B or B, D", issues, 5);
    expect(e.kind).toBe("letters");
    expect(e.acceptedSets).toEqual([["B"], ["B", "D"]]);
  });

  it("parses numeric value", () => {
    const e = parseValueText("42", issues, 6);
    expect(e.kind).toBe("number");
    expect(e.value).toBe(42);
  });

  it("parses decimal value", () => {
    const e = parseValueText("3.14", issues, 7);
    expect(e.kind).toBe("number");
    expect(e.value).toBe(3.14);
  });

  it("parses range", () => {
    const e = parseValueText("126 to 128", issues, 8);
    expect(e.kind).toBe("range");
    expect(e.min).toBe(126);
    expect(e.max).toBe(128);
  });

  it("parses range with dash", () => {
    const e = parseValueText("6-6.5", issues, 9);
    expect(e.kind).toBe("range");
    expect(e.min).toBe(6);
    expect(e.max).toBe(6.5);
  });

  it("parses dropped", () => {
    const e = parseValueText("DROPPED", issues, 10);
    expect(e.kind).toBe("dropped");
    expect(e.dropped).toBe(true);
  });

  it("handles unrecognized value", () => {
    issues.length = 0;
    const e = parseValueText("???unknown", issues, 11);
    expect(e.kind).toBe("unknown");
    expect(issues.length).toBeGreaterThan(0);
  });
});
