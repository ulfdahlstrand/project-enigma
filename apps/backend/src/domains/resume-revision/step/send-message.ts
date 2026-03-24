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
} from "../lib/prompt-builder.js";
import type { ResumeRevisionMessage, ResumeRevisionStepSection } from "@cv-tool/contracts";

const MODEL = "gpt-4o";
const MAX_TOKENS = 2048;

// ---------------------------------------------------------------------------
// sendResumeRevisionMessage — query logic
// ---------------------------------------------------------------------------

export async function sendResumeRevisionMessage(
  db: Kysely<Database>,
  openaiClient: OpenAI,
  user: AuthUser,
  input: { stepId: string; content: string }
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

  // Load discovery output and original section content for prompt context
  const [discoveryOutput, originalContent] = await Promise.all([
    fetchDiscoveryOutput(db, step.workflow_id),
    loadOriginalSectionContent(db, step),
  ]);

  const prompt = buildRevisionPrompt({
    section: step.section as ResumeRevisionStepSection,
    discovery: discoveryOutput,
    originalContent,
    conversationHistory: existingMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    userMessage: input.content,
  });

  const response = await openaiClient.chat.completions.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
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
  const isProposal = proposalResult !== null;

  let structuredContent: Record<string, unknown> | null = null;
  if (isProposal && proposalResult !== null) {
    const parsed = proposalResult.proposalJson as Record<string, unknown>;
    // For discovery: wrap the raw output in the proposal shape
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
      message_type: isProposal ? "proposal" : "text",
      content: aiContent,
      structured_content: structuredContent ? JSON.stringify(structuredContent) : null,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  // Transition step to reviewing if a proposal was produced
  const newStatus = (
    isProposal ? "reviewing" : step.status === "pending" ? "generating" : step.status
  ) as "pending" | "generating" | "reviewing" | "approved" | "needs_rework";
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
  step: { section: string; base_branch_id: string }
): Promise<unknown> {
  if (step.section === "discovery") return null;

  const branch = await db
    .selectFrom("resume_branches")
    .select(["head_commit_id"])
    .where("id", "=", step.base_branch_id)
    .executeTakeFirst();

  if (branch?.head_commit_id === undefined) return null;

  const commit = await db
    .selectFrom("resume_commits")
    .select(["content"])
    .where("id", "=", branch.head_commit_id)
    .executeTakeFirst();

  if (commit === undefined) return null;

  return extractSectionContent(
    step.section as ResumeRevisionStepSection,
    commit.content as ResumeCommitContent
  );
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
