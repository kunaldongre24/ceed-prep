import { describe, it, expect } from "vitest";
import { evaluateAnswer, parseNumber } from "./evaluate";

describe("parseNumber", () => {
  it("parses integers", () => expect(parseNumber("42")).toBe(42));
  it("parses decimals", () => expect(parseNumber("3.14")).toBe(3.14));
  it("normalizes leading zeros", () => expect(parseNumber("042")).toBe(42));
  it("normalizes trailing zeros", () => expect(parseNumber("42.0")).toBe(42));
  it("strips commas", () => expect(parseNumber("1,690")).toBe(1690));
  it("strips leading plus", () => expect(parseNumber("+42")).toBe(42));
  it("handles negative", () => expect(parseNumber("-5")).toBe(-5));
  it("returns null for empty", () => expect(parseNumber("")).toBeNull());
  it("returns null for text", () => expect(parseNumber("abc")).toBeNull());
  it("handles number input", () => expect(parseNumber(42)).toBe(42));
  it("handles null", () => expect(parseNumber(null)).toBeNull());
  it("handles undefined", () => expect(parseNumber(undefined)).toBeNull());
});

describe("evaluateAnswer - single_choice", () => {
  const correct = { type: "single_choice" as const, correctOptions: ["B"] };

  it("correct when selecting B", () => {
    expect(evaluateAnswer(correct, { selectedOptions: ["B"] })).toBe("correct");
  });

  it("incorrect when selecting A", () => {
    expect(evaluateAnswer(correct, { selectedOptions: ["A"] })).toBe("incorrect");
  });

  it("unattempted when empty", () => {
    expect(evaluateAnswer(correct, { selectedOptions: [] })).toBe("unattempted");
  });

  it("unattempted when null", () => {
    expect(evaluateAnswer(correct, null)).toBe("unattempted");
  });
});

describe("evaluateAnswer - multiple_choice", () => {
  const correct = {
    type: "multiple_choice" as const,
    correctOptions: ["A", "C"],
    alternateSets: [["B", "D"]],
  };

  it("correct with primary set", () => {
    expect(evaluateAnswer(correct, { selectedOptions: ["A", "C"] })).toBe("correct");
  });

  it("correct with alternate set", () => {
    expect(evaluateAnswer(correct, { selectedOptions: ["B", "D"] })).toBe("correct");
  });

  it("incorrect with partial set", () => {
    expect(evaluateAnswer(correct, { selectedOptions: ["A"] })).toBe("incorrect");
  });

  it("incorrect with wrong set", () => {
    expect(evaluateAnswer(correct, { selectedOptions: ["A", "B"] })).toBe("incorrect");
  });
});

describe("evaluateAnswer - numeric/integer/decimal", () => {
  it("exact integer match", () => {
    const c = { type: "integer" as const, value: 42 };
    expect(evaluateAnswer(c, { value: 42 })).toBe("correct");
    expect(evaluateAnswer(c, { value: "42" })).toBe("correct");
    expect(evaluateAnswer(c, { value: "042" })).toBe("correct");
  });

  it("decimal with tolerance", () => {
    const c = { type: "decimal" as const, value: 3.14, tolerance: 0.01 };
    expect(evaluateAnswer(c, { value: 3.14 })).toBe("correct");
    expect(evaluateAnswer(c, { value: 3.15 })).toBe("correct");
    expect(evaluateAnswer(c, { value: 3.16 })).toBe("incorrect");
  });

  it("range evaluation", () => {
    const c = { type: "numeric" as const, min: 24, max: 25.5 };
    expect(evaluateAnswer(c, { value: 24 })).toBe("correct");
    expect(evaluateAnswer(c, { value: 25 })).toBe("correct");
    expect(evaluateAnswer(c, { value: 25.5 })).toBe("correct");
    expect(evaluateAnswer(c, { value: 23 })).toBe("incorrect");
    expect(evaluateAnswer(c, { value: 26 })).toBe("incorrect");
  });

  it("unattempted when empty string", () => {
    const c = { type: "integer" as const, value: 42 };
    expect(evaluateAnswer(c, { value: "" })).toBe("unattempted");
  });
});

describe("evaluateAnswer - text", () => {
  it("case insensitive match", () => {
    const c = { type: "text" as const, value: "hello" };
    expect(evaluateAnswer(c, { text: "Hello" })).toBe("correct");
    expect(evaluateAnswer(c, { text: "world" })).toBe("incorrect");
  });

  it("unattempted when empty", () => {
    const c = { type: "text" as const, value: "hello" };
    expect(evaluateAnswer(c, { text: "" })).toBe("unattempted");
  });
});

describe("evaluateAnswer - edge cases", () => {
  it("unknown type always incorrect", () => {
    const c = { type: "unknown" as const, rawAnswer: "???" };
    expect(evaluateAnswer(c, { value: "anything" })).toBe("incorrect");
  });

  it("null correct answer", () => {
    expect(evaluateAnswer(null, { value: 42 })).toBe("incorrect");
  });
});
