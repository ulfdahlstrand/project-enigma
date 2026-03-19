// ---------------------------------------------------------------------------
// Prompt builders for CV AI features
// ---------------------------------------------------------------------------

export interface ImproveDescriptionPromptInput {
  description: string;
  role?: string;
  clientName?: string;
}

export interface BuiltPrompt {
  system: string;
  user: string;
}

const IMPROVE_DESCRIPTION_SYSTEM =
  "You are an expert CV writer specialising in IT consulting profiles. " +
  "Your task is to improve assignment descriptions to be professional, concise, " +
  "and achievement-focused. Write in the same language as the input. " +
  "Return ONLY the improved description text — no preamble, no explanation.";

/**
 * Builds the prompt messages for the improve-description AI call.
 * User content is wrapped in XML-style delimiters to prevent prompt injection.
 */
export function buildImproveDescriptionPrompt(
  input: ImproveDescriptionPromptInput
): BuiltPrompt {
  const contextLines: string[] = [];

  if (input.role) {
    contextLines.push(`Role: ${input.role}`);
  }
  if (input.clientName) {
    contextLines.push(`Client: ${input.clientName}`);
  }

  const contextSection =
    contextLines.length > 0
      ? `\n\nContext:\n${contextLines.join("\n")}`
      : "";

  const user = `Please improve the following assignment description.${contextSection}\n\n<description>\n${input.description}\n</description>`;

  return { system: IMPROVE_DESCRIPTION_SYSTEM, user };
}
