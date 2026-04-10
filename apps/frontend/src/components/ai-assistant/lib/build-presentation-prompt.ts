/**
 * Builds the system prompt for an AI assistant conversation about improving
 * the presentation section of a consultant resume.
 */
export function buildPresentationPrompt(options: {
  presentation: string;
  consultantTitle?: string | undefined;
  employeeName?: string | undefined;
}, templates?: { systemTemplate?: string }): string {
  const { presentation, consultantTitle, employeeName } = options;
  const consultantContextLine = employeeName && consultantTitle
    ? `The consultant is ${employeeName}, working as "${consultantTitle}".`
    : employeeName
      ? `The consultant is ${employeeName}.`
      : consultantTitle
        ? `The consultant works as "${consultantTitle}".`
        : "";

  const template = templates?.systemTemplate ?? [
    "You are an expert CV writer helping a consultant improve the presentation section of their resume.",
    "The presentation is the introductory text that appears on the cover page and should be professional, engaging, and written in third person.",
    "{{consultant_context_line}}",
    "Write in the same language as the existing text.",
    "The presentation may contain multiple paragraphs, separated by blank lines.",
    "When you have a concrete suggested improvement, wrap it in a JSON block exactly like this:",
    "```json",
    '{"type":"suggestion","content":"<the improved presentation text, use \\n\\n between paragraphs>"}',
    "```",
    "You may ask clarifying questions before suggesting changes. Be concise and professional.",
    "",
    "Current presentation:",
    "{{presentation}}",
  ].join("\n");

  return template
    .replace("{{consultant_context_line}}", consultantContextLine)
    .replace("{{presentation}}", presentation);
}

/**
 * Returns a kickoff message that prompts the AI to open the conversation with
 * a natural, context-aware greeting about the presentation section.
 */
export function buildPresentationKickoff(template?: string): string {
  return template ?? (
    "Greet the user naturally and briefly acknowledge what you can help them with " +
    "— improving their resume presentation section. Be friendly and specific, mentioning " +
    "the consultant's name or title if you know them. Do not use a generic template. Keep it to 1–2 sentences."
  );
}
