import { describe, it, expect } from "vitest";
import { findAllQuestionLabels } from "./structure";

describe("findAllQuestionLabels", () => {
  it("finds Q.01 format", () => {
    expect(findAllQuestionLabels("Q.01 Five blocks...")).toEqual([1]);
  });

  it("finds Q.9 format", () => {
    expect(findAllQuestionLabels("Q.9 Calculate...")).toEqual([9]);
  });

  it("finds Q 22 format", () => {
    expect(findAllQuestionLabels("Q 22 What is shown...")).toEqual([22]);
  });

  it("finds multiple labels on one line", () => {
    expect(findAllQuestionLabels("Q.34 Q.35")).toEqual([34, 35]);
  });

  it("ignores labels outside 1-60 range", () => {
    expect(findAllQuestionLabels("Q.0 Refer to Q.5")).toEqual([5]);
  });

  it("returns empty for no labels", () => {
    expect(findAllQuestionLabels("Just some text")).toEqual([]);
  });

  it("finds Q.02", () => {
    expect(findAllQuestionLabels("Q.02\nShown below is")).toEqual([2]);
  });
});
