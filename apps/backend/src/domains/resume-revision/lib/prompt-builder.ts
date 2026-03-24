import type { ResumeRevisionStepSection, ResumeRevisionDiscoveryOutput } from "@cv-tool/contracts";

// ---------------------------------------------------------------------------
// Prompt builder for resume revision workflow steps
//
// Two prompt modes:
//   - discovery: conversational interview to surface revision goals. The AI
//     should end its response with a ---PROPOSAL--- marker once it has enough
//     information, followed by a ResumeRevisionDiscoveryOutput JSON block.
//
//   - content step: AI receives discovery context + original section content
//     and is asked to propose a revised version in structured JSON. It may
//     also respond conversationally when it needs clarification first.
// ---------------------------------------------------------------------------

export const PROPOSAL_DELIMITER = "---PROPOSAL---";

const DISCOVERY_SYSTEM = `You are a CV revision consultant conducting an initial consultation with a consultant to understand their revision goals.

Your job is to gather the following information through friendly conversation:
- Target role or position the consultant is aiming for
- Desired tone (e.g. technical, leadership-focused, concise, storytelling)
- Key strengths or experiences to emphasise
- Things to downplay or de-emphasise
- Language or phrasing preferences
- Any other specific notes or requirements

Ask questions naturally. Once you have gathered enough information to make confident revision decisions, end your response with the following marker on its own line, followed immediately by a JSON object:

${PROPOSAL_DELIMITER}
{
  "targetRole": "...",
  "tone": "...",
  "strengthsToEmphasise": ["..."],
  "thingsToDownplay": ["..."],
  "languagePreferences": "...",
  "additionalNotes": "..."
}

Before that point, respond conversationally and ask follow-up questions as needed.`;

function buildContentSystemPrompt(
  section: ResumeRevisionStepSection,
  discovery: ResumeRevisionDiscoveryOutput | null,
  originalContent: unknown
): string {
  const sectionLabel: Record<ResumeRevisionStepSection, string> = {
    discovery: "discovery",
    consultant_title: "Consultant Title",
    presentation_summary: "Presentation & Summary",
    skills: "Skills",
    assignments: "Assignments",
    highlighted_experience: "Highlighted Experience",
    consistency_polish: "Consistency & Final Polish",
  };

  const discoveryBlock = discovery
    ? `<discovery_goals>
Target role: ${discovery.targetRole}
Tone: ${discovery.tone}
Strengths to emphasise: ${discovery.strengthsToEmphasise.join(", ")}
Things to downplay: ${discovery.thingsToDownplay.join(", ")}
Language preferences: ${discovery.languagePreferences}
Additional notes: ${discovery.additionalNotes}
</discovery_goals>`
    : "";

  const originalBlock = `<original_content>
${JSON.stringify(originalContent, null, 2)}
</original_content>`;

  const proposalInstructions =
    section === "consistency_polish"
      ? `When ready to propose final polish changes, include:

${PROPOSAL_DELIMITER}
{
  "originalContent": <the relevant original content>,
  "proposedContent": <the full revised content>,
  "reasoning": "...",
  "changeSummary": "..."
}`
      : `When ready to propose a revision, include:

${PROPOSAL_DELIMITER}
{
  "originalContent": <the original section content>,
  "proposedContent": <your proposed replacement>,
  "reasoning": "...",
  "changeSummary": "..."
}`;

  return `You are a CV revision assistant working on the "${sectionLabel[section]}" section of a consultant's resume.

${discoveryBlock}

${originalBlock}

Your goal is to revise this section in line with the discovery goals above.

${proposalInstructions}

If you need clarification before making a proposal, respond conversationally first. Otherwise, you may propose directly.`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface RevisionPrompt {
  system: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  userMessage: string;
}

export interface BuildPromptParams {
  section: ResumeRevisionStepSection;
  discovery: ResumeRevisionDiscoveryOutput | null;
  originalContent: unknown;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  userMessage: string;
}

export function buildRevisionPrompt(params: BuildPromptParams): RevisionPrompt {
  const { section, discovery, originalContent, conversationHistory, userMessage } =
    params;

  const system =
    section === "discovery"
      ? DISCOVERY_SYSTEM
      : buildContentSystemPrompt(section, discovery, originalContent);

  // Cap history to avoid token overflows (keep the most recent 20 turns)
  const MAX_HISTORY = 20;
  const history = conversationHistory.slice(-MAX_HISTORY);

  return { system, history, userMessage };
}

// ---------------------------------------------------------------------------
// Proposal extraction
// ---------------------------------------------------------------------------

/**
 * Attempts to extract a proposal JSON from an AI response that contains
 * the PROPOSAL_DELIMITER marker. Returns null if not found or if JSON is
 * invalid.
 */
export function extractProposalFromResponse(responseContent: string): {
  textPart: string;
  proposalJson: unknown;
} | null {
  const idx = responseContent.indexOf(PROPOSAL_DELIMITER);
  if (idx === -1) return null;

  const jsonStr = responseContent.slice(idx + PROPOSAL_DELIMITER.length).trim();
  try {
    return {
      textPart: responseContent.slice(0, idx).trim(),
      proposalJson: JSON.parse(jsonStr),
    };
  } catch {
    // AI produced an invalid JSON block — treat whole response as text.
    return null;
  }
}
