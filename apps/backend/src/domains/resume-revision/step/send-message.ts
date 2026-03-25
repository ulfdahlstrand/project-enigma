import { implement, ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { Kysely } from "kysely";
import type OpenAI from "openai";
import type { Database, ResumeCommitContent } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { getOpenAIClient } from "../../ai/lib/openai-client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../../../auth/require-auth.js";
import {
  fetchStepWithAuth,
  fetchDiscoveryOutput,
  fetchStepsWithMessages,
} from "../lib/query-helpers.js";
import { mapMessageRow, mapStepRow } from "../lib/map-to-output.js";
import { extractSectionContent } from "../lib/section-content-extractor.js";
import {
  buildRevisionPrompt,
  extractProposalFromResponse,
  type ConsultantProfile,
} from "../lib/prompt-builder.js";
import type { ResumeRevisionMessage, ResumeRevisionStepSection } from "@cv-tool/contracts";

const MODEL = "gpt-4o";

// ---------------------------------------------------------------------------
// sendResumeRevisionMessage — query logic
// ---------------------------------------------------------------------------

export async function sendResumeRevisionMessage(
  db: Kysely<Database>,
  openaiClient: OpenAI,
  user: AuthUser,
  input: { stepId: string; content: string; locale?: string | undefined }
) {
  const step = await fetchStepWithAuth(db, user, input.stepId);

  const allowedStatuses = ["pending", "reviewing", "needs_rework"];
  if (!allowedStatuses.includes(step.status)) {
    throw new ORPCError("BAD_REQUEST", {
      message: `Cannot send a message on a step with status "${step.status}".`,
    });
  }

  // If first message on a pending step, transition to generating
  if (step.status === "pending") {
    await db
      .updateTable("resume_revision_workflow_steps")
      .set({ status: "generating", updated_at: new Date() })
      .where("id", "=", step.id)
      .execute();
  }

  // Persist the user message
  const userRow = await db
    .insertInto("resume_revision_messages")
    .values({ step_id: step.id, role: "user", content: input.content })
    .returningAll()
    .executeTakeFirstOrThrow();

  // Load existing messages for context (excluding the one just inserted)
  const existingMessages = await db
    .selectFrom("resume_revision_messages")
    .selectAll()
    .where("step_id", "=", step.id)
    .where("id", "!=", userRow.id)
    .orderBy("created_at", "asc")
    .execute();

  const sectionDetail = step.section_detail as string | null;

  // Load discovery output, original section content, full CV, consultant profile, and highlighted items
  const [discoveryOutput, { sectionContent, fullCvContent }, consultantProfile, highlightedItems] =
    await Promise.all([
      fetchDiscoveryOutput(db, step.workflow_id),
      loadOriginalSectionContent(db, step, sectionDetail),
      loadConsultantProfile(db, step.workflow_id),
      loadHighlightedItems(db, step.workflow_id, step.section),
    ]);

  const prompt = buildRevisionPrompt({
    section: step.section as ResumeRevisionStepSection,
    sectionDetail,
    discovery: discoveryOutput,
    originalContent: sectionContent,
    fullCvContent,
    highlightedItems,
    consultantProfile,
    conversationHistory: existingMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    userMessage: input.content,
    locale: input.locale,
  });

  const response = await openaiClient.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: prompt.system },
      ...prompt.history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: prompt.userMessage },
    ],
  });

  const aiContent = response.choices[0]?.message?.content;
  if (!aiContent) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "AI returned empty response",
    });
  }

  // Detect if AI produced a proposal
  const proposalResult = extractProposalFromResponse(aiContent);
  const isValidProposal = proposalResult !== null && proposalResult.proposalJson !== null;

  let structuredContent: Record<string, unknown> | null = null;
  if (isValidProposal && proposalResult !== null) {
    const parsed = proposalResult.proposalJson as Record<string, unknown>;
    if (step.section === "discovery") {
      structuredContent = {
        originalContent: null,
        proposedContent: parsed,
        reasoning: null,
        changeSummary: null,
      };
    } else {
      structuredContent = {
        originalContent: parsed["originalContent"] ?? null,
        proposedContent: parsed["proposedContent"] ?? null,
        reasoning: (parsed["reasoning"] as string | null) ?? null,
        changeSummary: (parsed["changeSummary"] as string | null) ?? null,
      };
    }
  }

  // Persist AI message
  const assistantRow = await db
    .insertInto("resume_revision_messages")
    .values({
      step_id: step.id,
      role: "assistant",
      message_type: isValidProposal ? "proposal" : "text",
      content: aiContent,
      structured_content: structuredContent ? JSON.stringify(structuredContent) : null,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  // After a successful AI response the step is always in a reviewable state.
  // "generating" is only a transient status set before the OpenAI call; it
  // must never persist after the call completes.
  const newStatus = (
    isValidProposal ? "reviewing" : step.status === "needs_rework" ? "needs_rework" : "reviewing"
  ) as "reviewing" | "needs_rework";
  await db
    .updateTable("resume_revision_workflow_steps")
    .set({ status: newStatus, updated_at: new Date() })
    .where("id", "=", step.id)
    .execute();

  // Reload step with all messages for the response
  const updatedMessages = await db
    .selectFrom("resume_revision_messages")
    .selectAll()
    .where("step_id", "=", step.id)
    .orderBy("created_at", "asc")
    .execute();

  const userMessage: ResumeRevisionMessage = mapMessageRow(userRow);
  const assistantMessage: ResumeRevisionMessage = mapMessageRow(assistantRow);
  const updatedStep = mapStepRow(
    { ...step, status: newStatus, updated_at: new Date() },
    updatedMessages.map(mapMessageRow)
  );

  return { userMessage, assistantMessage, step: updatedStep };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadOriginalSectionContent(
  db: Kysely<Database>,
  step: { section: string; base_branch_id: string },
  sectionDetail: string | null
): Promise<{ sectionContent: unknown; fullCvContent: unknown }> {
  const branch = await db
    .selectFrom("resume_branches")
    .select(["head_commit_id"])
    .where("id", "=", step.base_branch_id)
    .executeTakeFirst();

  if (branch?.head_commit_id === undefined) {
    return { sectionContent: null, fullCvContent: null };
  }

  const commit = await db
    .selectFrom("resume_commits")
    .select(["content"])
    .where("id", "=", branch.head_commit_id)
    .executeTakeFirst();

  if (commit === undefined) {
    return { sectionContent: null, fullCvContent: null };
  }

  const fullCvContent: unknown = commit.content;

  if (step.section === "discovery") {
    return { sectionContent: null, fullCvContent };
  }

  const sectionContent = extractSectionContent(
    step.section as ResumeRevisionStepSection,
    commit.content as ResumeCommitContent,
    sectionDetail
  );

  return { sectionContent, fullCvContent };
}

async function loadHighlightedItems(
  db: Kysely<Database>,
  workflowId: string,
  section: string
): Promise<string[] | undefined> {
  if (section !== "highlighted_experience") return undefined;
  const rows = await db
    .selectFrom("resume_revision_workflows as w")
    .innerJoin("resume_highlighted_items as h", "h.resume_id", "w.resume_id")
    .select(["h.text"])
    .where("w.id", "=", workflowId)
    .orderBy("h.sort_order", "asc")
    .execute();
  return rows.map((r) => r.text);
}

async function loadConsultantProfile(
  db: Kysely<Database>,
  workflowId: string
): Promise<ConsultantProfile> {
  const row = await db
    .selectFrom("resume_revision_workflows as w")
    .innerJoin("resumes as r", "r.id", "w.resume_id")
    .innerJoin("employees as e", "e.id", "r.employee_id")
    .select([
      "e.name",
      "r.consultant_title",
      "r.presentation",
    ])
    .where("w.id", "=", workflowId)
    .executeTakeFirst();

  const presentationValue = row?.presentation ?? null;
  return {
    name: row?.name ?? "Unknown",
    title: row?.consultant_title ?? null,
    presentation: Array.isArray(presentationValue)
      ? presentationValue.join("\n") || null
      : presentationValue,
  };
}

// ---------------------------------------------------------------------------
// oRPC handler
// ---------------------------------------------------------------------------

export const sendResumeRevisionMessageHandler = implement(
  contract.sendResumeRevisionMessage
).handler(async ({ input, context }) => {
  const user = requireAuth(context as AuthContext);
  return sendResumeRevisionMessage(getDb(), getOpenAIClient(), user, input);
});

export function createSendResumeRevisionMessageHandler(
  db: Kysely<Database>,
  openaiClient: OpenAI
) {
  return implement(contract.sendResumeRevisionMessage).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return sendResumeRevisionMessage(db, openaiClient, user, input);
    }
  );
}
