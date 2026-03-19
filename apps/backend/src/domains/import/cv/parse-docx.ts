import { implement, ORPCError } from "@orpc/server";
import mammoth from "mammoth";
import OpenAI from "openai";
import { contract, cvJsonSchema } from "@cv-tool/contracts";
import { requireAuth, type AuthContext } from "../../../auth/require-auth.js";
import { getOpenAIClient } from "../../ai/lib/openai-client.js";

const MODEL = "gpt-4o";
// Large enough for a full CV with 20+ detailed assignments in JSON
const MAX_TOKENS = 16384;

const SYSTEM_PROMPT = `You are a CV data extractor. Your only job is to copy text from the document into the correct JSON fields — VERBATIM. Never summarize, shorten, paraphrase, or rewrite any text.

Output schema (return ONLY this JSON, no markdown, no explanation):
{
  "consultant": { "name": string, "title": string, "presentation": string[] },
  "skills": { [category: string]: string[] },
  "education": { "degrees": string[], "certifications": string[], "languages": string[] },
  "assignments": [{
    "client": string,
    "role": string,
    "period": string,
    "description": string,
    "technologies": string[],
    "keywords": string[]
  }]
}

CRITICAL RULES — violating any of these is an error:
1. COPY TEXT VERBATIM. Every word in description must come directly from the document. Do NOT summarize, condense, or rephrase.
2. Extract EVERY assignment. Do not skip or merge any.
3. "description": copy ALL body paragraphs for the assignment verbatim as one string (paragraphs separated by \n\n). Exclude the TEKNIKER and NYCKELORD lines.
4. "technologies": split the TEKNIKER: line into individual items (comma-separated). Copy each item exactly.
5. "keywords": split the NYCKELORD: line into individual items. Copy each item exactly.
6. skills: copy category names and items exactly as they appear in the document.
7. education.languages: spoken/written human languages only (not programming languages).
8. Empty fields: use "" or [] — never omit a field.`;

/**
 * Coerce fields the AI sometimes returns as string[] instead of string.
 * Joins arrays with double newline so paragraph structure is preserved.
 */
function arrayToString(v: unknown): string {
  if (Array.isArray(v)) return v.join("\n\n");
  if (typeof v === "string") return v;
  return "";
}

function normalizeAiOutput(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const obj = raw as Record<string, unknown>;

  if (!Array.isArray(obj.assignments)) return obj;

  return {
    ...obj,
    assignments: obj.assignments.map((a: unknown) => {
      if (!a || typeof a !== "object") return a;
      const aObj = a as Record<string, unknown>;
      return {
        ...aObj,
        description: arrayToString(aObj.description),
      };
    }),
  };
}

export async function parseCvDocx(
  client: OpenAI,
  input: { docxBase64: string; language: string }
) {
  const buffer = Buffer.from(input.docxBase64, "base64");

  // Use HTML extraction to preserve structural cues (bold labels, headings)
  // then strip tags — this gives better section boundaries than raw text
  const { value: htmlText } = await mammoth.convertToHtml({ buffer });
  const plainText = htmlText
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!plainText) {
    throw new ORPCError("BAD_REQUEST", { message: "Document appears to be empty or unreadable" });
  }

  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Extract this CV (language hint: ${input.language}). Copy all text verbatim — do NOT summarize. Extract every assignment.\n\n${plainText}`,
      },
    ],
  });

  const finishReason = response.choices[0]?.finish_reason;
  const text = response.choices[0]?.message?.content;

  if (!text) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "AI returned empty response",
    });
  }

  if (finishReason === "length") {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "AI response was cut off — document may be too large. Try splitting it.",
    });
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "AI returned invalid JSON",
    });
  }

  const cvJson = cvJsonSchema.parse(normalizeAiOutput(raw));
  return { cvJson };
}

export const parseCvDocxHandler = implement(contract.parseCvDocx).handler(
  async ({ input, context }) => {
    requireAuth(context as AuthContext);
    return parseCvDocx(getOpenAIClient(), input);
  }
);

export function createParseCvDocxHandler(client: OpenAI) {
  return implement(contract.parseCvDocx).handler(
    async ({ input, context }) => {
      requireAuth(context as AuthContext);
      return parseCvDocx(client, input);
    }
  );
}
