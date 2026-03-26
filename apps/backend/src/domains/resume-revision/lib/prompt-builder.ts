import type { ResumeRevisionStepSection, ResumeRevisionDiscoveryOutput } from "@cv-tool/contracts";

// ---------------------------------------------------------------------------
// Prompt builder for resume revision workflow steps
// ---------------------------------------------------------------------------

export const PROPOSAL_DELIMITER = "---PROPOSAL---";

// ---------------------------------------------------------------------------
// SthlmTech CV standard
// ---------------------------------------------------------------------------

const STHLMTECH_CV_STANDARD = `## SthlmTech CV Standard

### Tone and voice (CRITICAL)
- **Third person only**: Always write about the consultant in third person (e.g. "She led…", "He designed…", "They delivered…"). Never use "I" or "we".
- **First name only**: Refer to the consultant by first name only (e.g. "Anna", never "Anna Svensson"). Never use the full name in CV content.
- **Professional tone**: The CV must read as a professional document. Avoid casual language, filler phrases, and overly promotional hyperbole. Be confident and factual.

### Assignment descriptions
Every assignment description must follow this four-part structure:
1. **Client context** — A short description of the client: who they are, industry, size, and what they do.
2. **Problem** — What challenge or problem did the client face before this engagement?
3. **Contribution** — What did the consultant specifically do to address that problem? Be concrete and action-oriented.
4. **Result** — The outcome. This must be a success story: measurable impact, improvement, or value delivered.

### General CV standards
- Consultant title: concise, role-specific, no more than 5 words.
- Presentation/summary: 3–5 sentences, covers seniority, primary expertise, and what kind of engagements the consultant thrives in.
- Skills: grouped by category, listed in order of proficiency. Avoid skills that are not evidenced by assignments.
- Highlighted experience: 3–6 bullet points that are the most impressive, concrete achievements across all assignments. Prioritise recent engagements (last 2–3 years) unless an older one is exceptionally strong or directly relevant to the target role.
- Language: match the language of the existing CV (Swedish or English). Be consistent throughout.`;

// ---------------------------------------------------------------------------
// Discovery system prompt
// ---------------------------------------------------------------------------

function buildLocaleInstruction(locale: string | undefined): string {
  if (!locale) return "";
  const langName = locale.startsWith("sv") ? "Swedish" : "English";
  return `\nIMPORTANT: You must respond in ${langName}. All your conversational messages, explanations, and questions must be in ${langName}. CV content should follow the language of the existing CV, but your own responses to the user must be in ${langName}.\n`;
}

function buildDiscoverySystemPrompt(
  consultantProfile: ConsultantProfile,
  fullCvContent: unknown,
  locale: string | undefined,
  forceProposal: boolean
): string {
  const profileBlock = `<consultant_profile>
Name: ${consultantProfile.name}
Current title: ${consultantProfile.title ?? "Not set"}
Current presentation: ${consultantProfile.presentation ?? "Not set"}
</consultant_profile>`;

  const cvBlock = fullCvContent
    ? `<current_cv>
${JSON.stringify(fullCvContent, null, 2)}
</current_cv>`
    : "";

  const localeInstruction = buildLocaleInstruction(locale);

  const completionInstruction = forceProposal
    ? `The user has now confirmed that you should stop the discovery discussion and produce the structured discovery proposal immediately.

Do not ask any more questions. Do not continue the consultation. Briefly acknowledge the direction, then end your response with ${PROPOSAL_DELIMITER} and the JSON object.`
    : `Once you have gathered enough information to make confident revision decisions, end your response with the following marker on its own line, followed immediately by a JSON object:

${PROPOSAL_DELIMITER}
{
  "targetRole": "...",
  "tone": "...",
  "strengthsToEmphasise": ["..."],
  "thingsToDownplay": ["..."],
  "languagePreferences": "...",
  "additionalNotes": "...",
  "conversationSummary": "A concise but specific summary of the whole discussion so far, including the intended style, constraints, unusual directions, and how later revision steps should interpret them."
}

Before that point, respond conversationally and ask follow-up questions as needed.`;

  return `You are a CV revision consultant at SthlmTech, conducting an initial consultation with a consultant to understand their revision goals.
${localeInstruction}
${STHLMTECH_CV_STANDARD}

${profileBlock}

${cvBlock}

Your job is to gather the following information through friendly conversation:
- Target role or position the consultant is aiming for
- Desired tone (e.g. technical, leadership-focused, concise, storytelling)
- Key strengths or experiences to emphasise
- Things to downplay or de-emphasise
- Language or phrasing preferences
- Any other specific notes or requirements

You already have the consultant's current CV above — use it to ask specific, informed questions rather than generic ones. For example, reference actual assignments or skills.

Start by greeting the consultant by name and giving a brief overview of the CV from your perspective — what stands out, and what you'd like to discuss. Then guide the conversation.

${completionInstruction}`;
}

// ---------------------------------------------------------------------------
// Content step system prompt
// ---------------------------------------------------------------------------

function buildContentSystemPrompt(
  section: ResumeRevisionStepSection,
  discovery: ResumeRevisionDiscoveryOutput | null,
  originalContent: unknown,
  consultantProfile: ConsultantProfile,
  fullCvContent: unknown,
  sectionDetail: string | null,
  locale: string | undefined,
  highlightedItems: string[] | undefined,
  forceProposal: boolean
): string {
  const baseSectionLabel: Record<ResumeRevisionStepSection, string> = {
    discovery: "discovery",
    consultant_title: "Consultant Title",
    presentation_summary: "Presentation & Summary",
    skills: "Skills",
    assignments: "Assignments",
    highlighted_experience: "Highlighted Experience",
    consistency_polish: "Consistency & Final Polish",
  };

  const skillsLabel =
    section === "skills" && sectionDetail
      ? sectionDetail === "__new_categories__"
        ? "Skills — New Category Suggestions"
        : `Skills — ${sectionDetail}`
      : null;

  const sectionLabel: Record<ResumeRevisionStepSection, string> = {
    ...baseSectionLabel,
    skills: skillsLabel ?? baseSectionLabel.skills,
  };

  const profileBlock = `<consultant_profile>
Name: ${consultantProfile.name}
Current title: ${consultantProfile.title ?? "Not set"}
</consultant_profile>`;

  const strengthsToEmphasise = Array.isArray(discovery?.strengthsToEmphasise)
    ? discovery.strengthsToEmphasise
    : [];
  const thingsToDownplay = Array.isArray(discovery?.thingsToDownplay)
    ? discovery.thingsToDownplay
    : [];
  const conversationSummary = discovery?.conversationSummary?.trim() ?? "";

  const discoveryBlock = discovery
    ? `<revision_brief>
Conversation summary: ${conversationSummary || "No summary provided"}
</revision_brief>

<revision_goals>
Target role: ${discovery.targetRole ?? "Not specified"}
Tone: ${discovery.tone ?? "Not specified"}
Strengths to emphasise: ${strengthsToEmphasise.join(", ") || "None specified"}
Things to downplay: ${thingsToDownplay.join(", ") || "None specified"}
Language preferences: ${discovery.languagePreferences ?? "Not specified"}
Additional notes: ${discovery.additionalNotes ?? "None"}
</revision_goals>`
    : "";

  const originalBlock =
    section === "highlighted_experience" && highlightedItems !== undefined
      ? `<current_highlighted_items>
${highlightedItems.map((item, i) => `${i + 1}. ${item}`).join("\n")}
</current_highlighted_items>

<all_assignments_for_context>
${JSON.stringify(originalContent, null, 2)}
</all_assignments_for_context>`
      : `<original_content section="${sectionLabel[section]}">
${JSON.stringify(originalContent, null, 2)}
</original_content>`;

  // For consistency_polish, also include the full CV so the AI can see everything
  const fullCvBlock =
    section === "consistency_polish" && fullCvContent
      ? `<full_cv>
${JSON.stringify(fullCvContent, null, 2)}
</full_cv>`
      : "";

  const proposalInstructions =
    section === "highlighted_experience"
      ? `When ready to propose, include:

${PROPOSAL_DELIMITER}
{
  "originalContent": { "items": ["existing bullet 1", "existing bullet 2", ...] },
  "proposedContent": { "items": ["new bullet 1", "new bullet 2", ...] },
  "reasoning": "...",
  "changeSummary": "..."
}

CRITICAL: proposedContent MUST be a JSON object with an "items" array of plain strings. Never use any other format.`
      : section === "consistency_polish"
      ? `When ready to propose final polish changes, include:

${PROPOSAL_DELIMITER}
{
  "originalContent": <the relevant original content>,
  "proposedContent": <the full revised content>,
  "reasoning": "...",
  "changeSummary": "..."
}`
      : section === "assignments"
        ? `When ready to propose a revision, include:

${PROPOSAL_DELIMITER}
{
  "originalContent": { "assignments": [ <original assignment object> ] },
  "proposedContent": { "assignments": [ <revised assignment object with ALL original fields preserved, only description updated> ] },
  "reasoning": "...",
  "changeSummary": "..."
}

CRITICAL: proposedContent MUST be a JSON object with an "assignments" array containing the full assignment object (all fields: assignmentId, clientName, role, startDate, endDate, description, etc.). Never use plain text for proposedContent.`
        : `When ready to propose a revision, include:

${PROPOSAL_DELIMITER}
{
  "originalContent": <the original section content>,
  "proposedContent": <your proposed replacement>,
  "reasoning": "...",
  "changeSummary": "..."
}`;

  const assignmentNote =
    section === "assignments"
      ? sectionDetail
        ? `\nYou are ONLY revising the single assignment for client "${sectionDetail.split("|||")[1] ?? sectionDetail}". Do not modify other assignments. Each assignment description must follow the SthlmTech four-part structure: client context → problem → consultant's contribution → result (success story).\n`
        : `\nIMPORTANT: Each assignment description must follow the SthlmTech four-part structure: client context → problem → consultant's contribution → result (success story). Rewrite any assignments that do not follow this structure.\n`
      : "";

  const skillsNote =
    section === "skills"
      ? sectionDetail === "__new_categories__"
        ? `\nYour task is to suggest NEW skill categories and skills that would strengthen this consultant's profile based on their assignments and revision goals. The existing skills are shown above for reference. Propose 2-4 new categories with 3-6 skills each.\n`
        : `\nYou are ONLY revising the "${sectionDetail}" skill category. Do not modify other categories. Propose revised or reordered skills for this category only.\n`
      : "";

  const highlightedNote =
    section === "highlighted_experience"
      ? `\nThe highlighted experience section is a curated list of 3–6 short bullet points (free text) that lift the consultant's most impressive and recent achievements — not a list of all assignments. They are often manually written and do not need to follow the assignment four-part structure. Each bullet should be concise (1–2 sentences max) and punchy.\n\nRecency matters: prioritise achievements from the last 2–3 years. Only go further back if an older engagement is exceptionally strong or directly relevant to the target role.\n\nWhen you propose, write each bullet as a standalone sentence grounded in a specific assignment — reference the client or context, what was done, and the impact. Only include bullets that reflect genuinely strong, recent, or strategically important achievements.\n`
      : "";

  const localeInstruction = buildLocaleInstruction(locale);

  const interactionInstruction = forceProposal
    ? `The user has now confirmed that you should produce the proposal immediately.

Do not ask more questions. Do not stay in planning mode. Briefly acknowledge the direction and then produce the proposal in the required format below.`
    : `IMPORTANT: Do NOT produce a proposal yet. Start by briefly assessing the current content. If it already meets the standard and revision goals well, say so — in that case only propose changes if there is a genuine improvement to make. If changes are needed, briefly describe your planned approach and ask if the user has any specific preferences. Wait for the user to confirm before producing a proposal.

When the user confirms (e.g. "go ahead", "looks good", "kör på", "ja"), then produce your proposal using the format below.`;

  return `You are a CV revision assistant at SthlmTech working on the "${sectionLabel[section]}" section of a consultant's resume.
${localeInstruction}
${STHLMTECH_CV_STANDARD}

${profileBlock}

${discoveryBlock}

${originalBlock}

${fullCvBlock}
${skillsNote || assignmentNote || highlightedNote}
Your goal is to revise this section in line with the revision goals above, following the SthlmTech CV standard.

IMPORTANT: Treat the revision brief above as the primary interpretation of the earlier discovery conversation. If it specifies an unusual direction, tone, or framing, you must carry that into this step.

${interactionInstruction}

${proposalInstructions}`;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ConsultantProfile {
  name: string;
  title: string | null;
  presentation: string | null;
}

export interface RevisionPrompt {
  system: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  userMessage: string;
}

export interface BuildPromptParams {
  section: ResumeRevisionStepSection;
  sectionDetail: string | null;
  discovery: ResumeRevisionDiscoveryOutput | null;
  originalContent: unknown;
  fullCvContent: unknown;
  /** Current highlighted experience items (free text bullets), loaded from resume_highlighted_items */
  highlightedItems?: string[] | undefined;
  consultantProfile: ConsultantProfile;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  userMessage: string;
  locale?: string | undefined;
  forceProposal?: boolean;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function buildRevisionPrompt(params: BuildPromptParams): RevisionPrompt {
  const {
    section,
    sectionDetail,
    discovery,
    originalContent,
    fullCvContent,
    highlightedItems,
    consultantProfile,
    conversationHistory,
    userMessage,
    locale,
    forceProposal = false,
  } = params;

  const system =
    section === "discovery"
      ? buildDiscoverySystemPrompt(consultantProfile, fullCvContent, locale, forceProposal)
      : buildContentSystemPrompt(section, discovery, originalContent, consultantProfile, fullCvContent, sectionDetail, locale, highlightedItems, forceProposal);

  // Cap history to avoid token overflows (keep the most recent 20 turns)
  const MAX_HISTORY = 20;
  const history = conversationHistory.slice(-MAX_HISTORY);

  return { system, history, userMessage };
}

export function isProposalTriggerMessage(message: string): boolean {
  const normalized = message
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  if (!normalized) return false;

  const triggerPhrases = [
    "go ahead",
    "looks good",
    "sounds good",
    "let's do it",
    "lets do it",
    "let's start",
    "lets start",
    "please proceed",
    "continue with that",
    "kör på",
    "kor pa",
    "kora pa",
    "nu kör vi",
    "nu kor vi",
    "låt oss börja",
    "lat oss borja",
    "låt oss köra",
    "lat oss kora",
    "bra nu kör vi",
    "ser bra ut",
    "ja kör",
    "ja kor",
    "fortsätt",
    "fortsatt",
  ];

  if (triggerPhrases.some((phrase) => normalized.includes(phrase))) {
    return true;
  }

  return /^(ja|yes|ok|okej|okay|bra|toppen|perfekt)[!. ]*$/.test(normalized);
}

// ---------------------------------------------------------------------------
// Proposal extraction
// ---------------------------------------------------------------------------

/**
 * Attempts to extract a proposal JSON from an AI response that contains
 * the PROPOSAL_DELIMITER marker. Returns null if not found or if JSON is invalid.
 */
export function extractProposalFromResponse(responseContent: string): {
  textPart: string;
  proposalJson: unknown;
} | null {
  const idx = responseContent.indexOf(PROPOSAL_DELIMITER);
  if (idx === -1) return null;

  const textPart = responseContent.slice(0, idx).trim();
  const raw = responseContent.slice(idx + PROPOSAL_DELIMITER.length).trim();
  // Extract only the outermost JSON object — ignore any trailing markdown/text
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  // Strip JS-style single-line comments (// ...) that AI sometimes emits
  const jsonStr = raw.slice(start, end + 1).replace(/\/\/[^\n]*/g, "");
  try {
    return { textPart, proposalJson: JSON.parse(jsonStr) };
  } catch {
    return null;
  }
}
