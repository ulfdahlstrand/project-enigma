/**
 * Builds the system prompt for an AI assistant conversation about improving
 * an assignment description. Includes the current description and any
 * available role/client context.
 */
export function buildAssignmentPrompt(options: {
  description: string;
  role?: string;
  clientName?: string;
}, templates?: { systemTemplate?: string }): string {
  const { description, role, clientName } = options;
  const roleClientLine = role && clientName
    ? `The consultant worked as "${role}" at "${clientName}".`
    : role
      ? `The consultant worked as "${role}".`
      : clientName
        ? `The consultant worked at "${clientName}".`
        : "";

  const template = templates?.systemTemplate
    ?? [
      "You are an expert CV writer helping a consultant improve the description of an assignment.",
      "{{role_client_line}}",
      "Write in the same language as the existing description.",
      "When you have a concrete suggested improvement, wrap it in a JSON block exactly like this:",
      "```json",
      '{"type":"suggestion","content":"<the improved description text>"}',
      "```",
      "You may ask clarifying questions before suggesting changes. Be concise and professional.",
      "",
      "Current description:",
      "{{description}}",
    ].join("\n");

  return template
    .replace("{{role_client_line}}", roleClientLine)
    .replace("{{description}}", description);
}

/**
 * Returns a kickoff message that prompts the AI to open the conversation with
 * a natural, context-aware greeting — without using a static template.
 */
export function buildAssignmentKickoff(template?: string): string {
  return template ?? (
    "Greet the user naturally and briefly acknowledge what you can help them with " +
    "based on the assignment context above. Be friendly and specific — mention the " +
    "role and client if you know them. Do not use a generic template. Keep it to 1–2 sentences."
  );
}
