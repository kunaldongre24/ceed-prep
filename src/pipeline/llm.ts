import { CONFIG, hasLlm } from "./config";

/**
 * GPT-5.6-sol fallback via AgentRouter (OpenAI-compatible chat completions).
 *
 * Rules enforced here (spec #14/#15/#17):
 * - The model only ever receives extracted PDF text and/or rendered page images.
 * - It must return strict JSON and must never invent answers; missing info is
 *   expressed as needsReview + reason.
 * - Every LLM-assisted item is stored as needs_review unless confidence is high
 *   AND an answer is explicitly supported by the supplied key content.
 * - Without AGENTROUTER_API_KEY all helpers return null and callers fall back
 *   to needs_review — the pipeline never blocks on the LLM.
 */

interface ChatMessage {
  role: "system" | "user";
  content:
    | string
    | ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[];
}

export async function chatJson(messages: ChatMessage[], maxTokens = 4096): Promise<unknown | null> {
  if (!hasLlm()) return null;
  const res = await fetch(`${CONFIG.agentrouter.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CONFIG.agentrouter.apiKey}`,
    },
    body: JSON.stringify({
      model: CONFIG.agentrouter.model,
      messages,
      temperature: 0,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    throw new Error(`AgentRouter ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;
  return JSON.parse(content);
}

function userContent(pageText: string, pageImageBase64?: string): ChatMessage["content"] {
  const textPart = { type: "text" as const, text: pageText };
  if (pageImageBase64) {
    return [
      textPart,
      { type: "image_url", image_url: { url: `data:image/png;base64,${pageImageBase64}` } },
    ];
  }
  return pageText;
}

const EXTRACTION_SYSTEM_PROMPT = `You are extracting structured data from a CEED examination paper (Part A only).

Use ONLY the supplied PDF text/page image. Do not invent question text, options, or answers.
Do not infer an answer unless the supplied answer-key content explicitly supports it.

Determine for each question:
- questionNumber (integer)
- section: only questions in Part A ("A"); never Part B
- subSection: "I" (numerical/NAT), "II" (multiple select/MSQ), "III" (multiple choice/MCQ) or the roman numeral you see
- type: "numeric" | "integer" | "decimal" | "single_choice" | "multiple_choice" | "text" | "unknown"
- questionText (verbatim stem, without the Q-number prefix)
- options: [{key: "A".."D", text}] only when options actually exist (options are labeled "A." "B." "C." "D.")
- answer: for choice: the correct option letters; for numerical: the number or range from the key (e.g. {"type":"numeric","min":126,"max":128})
- imageHint: true if the question visibly contains a figure/diagram
- confidence: 0..1
Only return questions that belong to Part A. If uncertain about anything, set needsReview=true and explain why in "reason". If information is unavailable, do not invent it.

Respond with JSON: {"questions":[...]} where each item may include needsReview and reason.`;

export interface LlmQuestion {
  questionNumber: number;
  section?: string;
  subSection?: string | null;
  type?: string;
  questionText?: string;
  options?: { key: string; text: string }[];
  answer?: { type: string; correctOptions?: string[]; value?: number; min?: number; max?: number };
  imageHint?: boolean;
  confidence?: number;
  needsReview?: boolean;
  reason?: string;
}

export async function extractQuestionsFromPage(
  pageText: string,
  pageImageBase64?: string
): Promise<LlmQuestion[] | null> {
  const json = (await chatJson([
    { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
    {
      role: "user",
      content: userContent(
        `PDF page content:\n"""\n${pageText.slice(0, 6000)}\n"""`,
        pageImageBase64
      ),
    },
  ])) as { questions?: LlmQuestion[] } | null;
  return json?.questions ?? null;
}

const KEY_SYSTEM_PROMPT = `You are reading a CEED answer key page image/text.

Use ONLY the supplied content. For every "Q.No / key" pair you can see, output:
- number (integer question number)
- raw (the exact key text as printed, e.g. "A, B, C" or "126 to 128" or "DROPPED")
Do not guess values you cannot read. Respond with JSON: {"entries":[{"number":1,"raw":"..."}]}`;

export async function parseKeyFromPage(
  pageText: string,
  pageImageBase64?: string
): Promise<{ number: number; raw: string }[] | null> {
  const json = (await chatJson([
    { role: "system", content: KEY_SYSTEM_PROMPT },
    {
      role: "user",
      content: userContent(
        `Answer key page content:\n"""\n${pageText.slice(0, 6000)}\n"""`,
        pageImageBase64
      ),
    },
  ])) as { entries?: { number: number; raw: string }[] } | null;
  return json?.entries ?? null;
}

/** Ask the LLM to re-associate/normalize one ambiguous question (escalation path). */
export async function repairQuestion(
  questionRawText: string,
  keyRaw: string | undefined,
  pageImageBase64?: string
): Promise<LlmQuestion | null> {
  const json = (await chatJson(
    [
      { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
      {
        role: "user",
        content: userContent(
          `Raw extracted text for ONE question:\n"""\n${questionRawText.slice(0, 4000)}\n"""\n` +
            (keyRaw ? `Answer key entry: "${keyRaw}"\n` : "") +
            `Return {"questions":[one question]}.`,
          pageImageBase64
        ),
      },
    ],
    2048
  )) as { questions?: LlmQuestion[] } | null;
  return json?.questions?.[0] ?? null;
}
