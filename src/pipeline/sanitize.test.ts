import { describe, it, expect } from "vitest";
import { sanitizeQuestion, assertNoAnswerLeak } from "./sanitize";

describe("sanitizeQuestion", () => {
  it("strips all answer fields", () => {
    const row = {
      id: "q1",
      question_number: 5,
      question_type: "single_choice",
      question_text: "What is 2+2?",
      sub_section: "III",
      correct_answer_json: { type: "single_choice", correctOptions: ["B"] },
      raw_answer_text: "B",
      question_options: [
        { option_key: "A", option_text: "3", option_order: 0 },
        { option_key: "B", option_text: "4", option_order: 1 },
      ],
      question_images: [
        { image_index: 0, url: "https://example.com/img.png", storage_path: "a/b/0.png" },
      ],
    };

    const result = sanitizeQuestion(row);

    expect(result.id).toBe("q1");
    expect(result.questionNumber).toBe(5);
    expect(result.type).toBe("single_choice");
    expect(result.questionText).toBe("What is 2+2?");
    expect(result.options).toHaveLength(2);
    expect(result.options[0].key).toBe("A");
    expect(result.images).toHaveLength(1);

    // Must NOT contain answer fields
    expect(result).not.toHaveProperty("correct_answer_json");
    expect(result).not.toHaveProperty("raw_answer_text");
    expect(result).not.toHaveProperty("answer");
  });

  it("handles missing options and images", () => {
    const row = {
      id: "q2",
      question_number: 1,
      question_type: "integer",
      question_text: "Calculate x.",
      question_options: undefined,
      question_images: undefined,
    };

    const result = sanitizeQuestion(row);
    expect(result.options).toEqual([]);
    expect(result.images).toEqual([]);
  });
});

describe("assertNoAnswerLeak", () => {
  it("passes for clean object", () => {
    expect(() =>
      assertNoAnswerLeak({ id: "q1", questionText: "hello" })
    ).not.toThrow();
  });

  it("throws on correct_answer_json", () => {
    expect(() =>
      assertNoAnswerLeak({ correct_answer_json: { type: "single_choice" } })
    ).toThrow("Answer leak detected");
  });

  it("throws on raw_answer_text", () => {
    expect(() =>
      assertNoAnswerLeak({ raw_answer_text: "B" })
    ).toThrow("Answer leak detected");
  });

  it("throws on nested answer", () => {
    expect(() =>
      assertNoAnswerLeak({ data: { answer: "secret" } })
    ).toThrow("Answer leak detected");
  });

  it("passes for non-objects", () => {
    expect(() => assertNoAnswerLeak(null)).not.toThrow();
    expect(() => assertNoAnswerLeak("string")).not.toThrow();
    expect(() => assertNoAnswerLeak(42)).not.toThrow();
  });
});
