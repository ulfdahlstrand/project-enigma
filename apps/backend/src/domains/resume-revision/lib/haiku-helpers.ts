import type OpenAI from "openai";

// ---------------------------------------------------------------------------
// Haiku (gpt-4o-mini) helpers for cheap AI calls in the revision workflow
// ---------------------------------------------------------------------------

const HAIKU_MODEL = "gpt-4o-mini";

const SECTION_LABELS: Record<string, string> = {
  consultant_title: "Consultant Title",
  presentation_summary: "Presentation & Summary",
  skills: "Skills",
  assignments: "Assignments",
  highlighted_experience: "Highlighted Experience",
  consistency_polish: "Consistency & Final Polish",
};

/**
 * Generates a short, descriptive git commit message for a revision step commit.
 * Falls back to the provided fallback string if the AI call fails.
 */
export async function generateCommitMessage(
  openai: OpenAI,
  section: string,
  sectionDetail: string | null,
  changeSummary: string | null,
  fallback: string
): Promise<string> {
  const sectionLabel = SECTION_LABELS[section] ?? section;
  const detailSuffix =
    sectionDetail && section === "assignments"
      ? ` — ${sectionDetail.split("|||")[1] ?? sectionDetail}`
      : sectionDetail && section === "skills" && sectionDetail !== "__new_categories__"
      ? ` — ${sectionDetail}`
      : "";

  const prompt = [
    `You are writing a git commit message for a CV revision step.`,
    `Section revised: ${sectionLabel}${detailSuffix}`,
    changeSummary ? `Change summary: ${changeSummary}` : null,
    ``,
    `Write a short git commit message (max 72 characters) in the imperative mood that describes what was changed.`,
    `Output only the commit message text, nothing else. No quotes.`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await openai.chat.completions.create({
      model: HAIKU_MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 80,
    });
    const text = response.choices[0]?.message?.content?.trim();
    if (text) return text;
  } catch {
    // best-effort
  }
  return fallback;
}

export interface BranchSummary {
  branchName: string;
  summary: string;
}

/**
 * Given a list of commit messages from a revision branch, returns a suggested
 * short branch name and a summary of what was accomplished.
 * Returns null if the AI call fails or returns invalid JSON.
 */
export async function generateBranchSummary(
  openai: OpenAI,
  commitMessages: string[]
): Promise<BranchSummary | null> {
  if (commitMessages.length === 0) return null;

  const list = commitMessages.map((m, i) => `${i + 1}. ${m}`).join("\n");

  const prompt = [
    `You are summarizing a CV revision workflow. The following commits were made on the revision branch:`,
    ``,
    list,
    ``,
    `1. Suggest a short branch name in kebab-case (2–5 words, max 40 characters) that captures what was accomplished.`,
    `2. Write a 2–3 sentence summary of the overall changes made.`,
    ``,
    `Respond with valid JSON only, no markdown:`,
    `{"branchName":"...","summary":"..."}`,
  ].join("\n");

  try {
    const response = await openai.chat.completions.create({
      model: HAIKU_MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 200,
    });
    const text = response.choices[0]?.message?.content?.trim();
    if (!text) return null;
    // Strip any markdown code fences the model might add
    const cleaned = text.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
    const parsed = JSON.parse(cleaned) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "branchName" in parsed &&
      "summary" in parsed &&
      typeof (parsed as Record<string, unknown>).branchName === "string" &&
      typeof (parsed as Record<string, unknown>).summary === "string"
    ) {
      const rec = parsed as Record<string, unknown>;
      return {
        branchName: rec.branchName as string,
        summary: rec.summary as string,
      };
    }
  } catch {
    // best-effort
  }
  return null;
}

/**
 * Generates a merge commit message summarizing all revision branch commits.
 * Returns a fallback string if the AI call fails.
 */
export async function generateMergeCommitMessage(
  openai: OpenAI,
  commitMessages: string[]
): Promise<string> {
  const fallback = "Merge revision workflow";
  if (commitMessages.length === 0) return fallback;

  const list = commitMessages.map((m, i) => `${i + 1}. ${m}`).join("\n");

  const prompt = [
    `You are writing a merge commit message for a CV revision workflow. The following commits were made:`,
    ``,
    list,
    ``,
    `Write a concise (1–2 sentences) commit message that summarizes what was accomplished in this revision.`,
    `Output only the commit message text, nothing else. No quotes.`,
  ].join("\n");

  try {
    const response = await openai.chat.completions.create({
      model: HAIKU_MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 120,
    });
    const text = response.choices[0]?.message?.content?.trim();
    if (text) return text;
  } catch {
    // best-effort
  }
  return fallback;
}
