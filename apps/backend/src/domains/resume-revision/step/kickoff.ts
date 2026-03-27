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
// kickoffRevisionStep — query logic
// ---------------------------------------------------------------------------

export async function kickoffRevisionStep(
  db: Kysely<Database>,
  openaiClient: OpenAI,
  user: AuthUser,
  input: { stepId: string; locale?: string | undefined }
) {
  const step = await fetchStepWithAuth(db, user, input.stepId);

  if (step.status !== "pending") {
    throw new ORPCError("BAD_REQUEST", {
      message: `Can only kick off a step that is "pending". Current: "${step.status}".`,
    });
  }

  const existingMessageCount = await db
    .selectFrom("resume_revision_messages")
    .select(db.fn.countAll<number>().as("count"))
    .where("step_id", "=", step.id)
    .executeTakeFirstOrThrow();

  if (Number(existingMessageCount.count) > 0) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Cannot kick off a step that already has messages.",
    });
  }

  const sectionDetail = step.section_detail as string | null;

  // ---------------------------------------------------------------------------
  // Non-discovery steps: show an instant confirmation message (no AI call).
  // The user can then reply "yes" to trigger the actual AI revision via
  // send-message, or press Skip to bypass the step entirely.
  // ---------------------------------------------------------------------------
  if (step.section !== "discovery") {
    const discoveryOutput = await fetchDiscoveryOutput(db, step.workflow_id);
    const confirmationText = buildConfirmationMessage(
      step.section as ResumeRevisionStepSection,
      sectionDetail,
      discoveryOutput,
      input.locale
    );

    const assistantRow = await db
      .insertInto("resume_revision_messages")
      .values({
        step_id: step.id,
        role: "assistant",
        message_type: "text",
        content: confirmationText,
        structured_content: null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await db
      .updateTable("resume_revision_workflow_steps")
      .set({ status: "reviewing", updated_at: new Date() })
      .where("id", "=", step.id)
      .execute();

    const assistantMessage: ResumeRevisionMessage = mapMessageRow(assistantRow);
    const updatedStep = mapStepRow(
      { ...step, status: "reviewing", updated_at: new Date() },
      [assistantMessage]
    );

    return { assistantMessage, step: updatedStep };
  }

  // ---------------------------------------------------------------------------
  // Discovery step: call the AI as before.
  // ---------------------------------------------------------------------------

  // Transition to generating before the OpenAI call
  await db
    .updateTable("resume_revision_workflow_steps")
    .set({ status: "generating", updated_at: new Date() })
    .where("id", "=", step.id)
    .execute();
  try {
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
      conversationHistory: [],
      userMessage: "Please begin the consultation.",
      locale: input.locale,
    });

    const response = await openaiClient.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.userMessage },
      ],
    });

    const aiContent = response.choices[0]?.message?.content;
    if (!aiContent) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "AI returned empty response",
      });
    }

    const proposalResult = extractProposalFromResponse(aiContent);
    const isValidProposal = proposalResult !== null && proposalResult.proposalJson !== null;

    let structuredContent: Record<string, unknown> | null = null;
    if (isValidProposal && proposalResult !== null) {
      const parsed = proposalResult.proposalJson as Record<string, unknown>;
      structuredContent = {
        originalContent: null,
        proposedContent: {
          ...parsed,
          conversationSummary:
            (parsed["conversationSummary"] as string | undefined) ??
            proposalResult.textPart ??
            "",
        },
        reasoning: null,
        changeSummary: null,
      };
    }

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

    await db
      .updateTable("resume_revision_workflow_steps")
      .set({ status: "reviewing", updated_at: new Date() })
      .where("id", "=", step.id)
      .execute();

    const updatedMessages = await db
      .selectFrom("resume_revision_messages")
      .selectAll()
      .where("step_id", "=", step.id)
      .orderBy("created_at", "asc")
      .execute();

    const assistantMessage: ResumeRevisionMessage = mapMessageRow(assistantRow);
    const updatedStep = mapStepRow(
      { ...step, status: "reviewing", updated_at: new Date() },
      updatedMessages.map(mapMessageRow)
    );

    return { assistantMessage, step: updatedStep };
  } catch (error) {
    await db
      .updateTable("resume_revision_workflow_steps")
      .set({ status: "pending", updated_at: new Date() })
      .where("id", "=", step.id)
      .where("status", "=", "generating")
      .execute();
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadOriginalSectionContent(
  db: Kysely<Database>,
  step: { section: string; base_branch_id: string; revision_branch_id: string | null },
  sectionDetail: string | null
): Promise<{ sectionContent: unknown; fullCvContent: unknown }> {
  // For highlighted_experience, the AI needs the assignments as they look after
  // the assignment revision steps. Those are on the revision branch, not the base.
  const branchId =
    step.section === "highlighted_experience" && step.revision_branch_id !== null
      ? step.revision_branch_id
      : step.base_branch_id;

  const branch = await db
    .selectFrom("resume_branches")
    .select(["head_commit_id"])
    .where("id", "=", branchId)
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
// buildConfirmationMessage — instant pre-revision check (no AI call)
// ---------------------------------------------------------------------------

function sectionDisplayName(
  section: ResumeRevisionStepSection,
  sectionDetail: string | null,
  sv: boolean
): string {
  const labels: Record<ResumeRevisionStepSection, string> = {
    discovery: sv ? "Utforskning" : "Discovery",
    consultant_title: sv ? "Konsulttitel" : "Consultant Title",
    presentation_summary: sv ? "Presentation & Sammanfattning" : "Presentation & Summary",
    skills: sv ? "Kompetenser" : "Skills",
    assignments: sv ? "Uppdrag" : "Assignments",
    highlighted_experience: sv ? "Utvalda uppdrag" : "Highlighted Experience",
    consistency_polish: sv ? "Konsistens & Slutpoleringen" : "Consistency & Final Polish",
  };
  const base = labels[section];
  if (section === "skills" && sectionDetail) {
    return sectionDetail === "__new_categories__"
      ? sv ? `${base} — Nya kategorier` : `${base} — New Categories`
      : `${base} — ${sectionDetail}`;
  }
  if (section === "assignments" && sectionDetail) {
    const clientName = sectionDetail.split("|||")[1] ?? sectionDetail;
    return `${base} — ${clientName}`;
  }
  return base;
}

function buildConfirmationMessage(
  section: ResumeRevisionStepSection,
  sectionDetail: string | null,
  discovery: import("@cv-tool/contracts").ResumeRevisionDiscoveryOutput | null,
  locale: string | undefined
): string {
  const sv = (locale ?? "sv").startsWith("sv");
  const name = sectionDisplayName(section, sectionDetail, sv);

  if (!discovery) {
    return sv
      ? `Redo att revidera avsnittet **${name}**. Vill du att jag ska föreslå ändringar?`
      : `Ready to revise the **${name}** section. Would you like me to propose changes?`;
  }

  const strengths = discovery.strengthsToEmphasise?.length
    ? discovery.strengthsToEmphasise.join(", ")
    : sv ? "Inga specificerade" : "None specified";

  const downplay = discovery.thingsToDownplay?.length
    ? discovery.thingsToDownplay.join(", ")
    : sv ? "Inga specificerade" : "None specified";

  const summary = discovery.conversationSummary?.trim();

  if (sv) {
    return [
      `Baserat på utforskningen är vi redo att revidera avsnittet **${name}**.`,
      "",
      "Utforskningens mål:",
      `• Målroll: ${discovery.targetRole ?? "Ej specificerad"}`,
      `• Ton: ${discovery.tone ?? "Ej specificerad"}`,
      `• Styrkor att lyfta fram: ${strengths}`,
      `• Saker att nedtona: ${downplay}`,
      ...(summary ? ["", `Sammanfattning: ${summary}`] : []),
      "",
      "Vill du att jag ska föreslå revideringar för det här avsnittet?",
    ].join("\n");
  }

  return [
    `Based on the discovery, ready to revise the **${name}** section.`,
    "",
    "Revision goals:",
    `• Target role: ${discovery.targetRole ?? "Not specified"}`,
    `• Tone: ${discovery.tone ?? "Not specified"}`,
    `• Strengths to emphasise: ${strengths}`,
    `• Things to downplay: ${downplay}`,
    ...(summary ? ["", `Summary: ${summary}`] : []),
    "",
    "Would you like me to propose revisions for this section?",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// oRPC handler
// ---------------------------------------------------------------------------

export const kickoffRevisionStepHandler = implement(
  contract.kickoffRevisionStep
).handler(async ({ input, context }) => {
  const user = requireAuth(context as AuthContext);
  return kickoffRevisionStep(getDb(), getOpenAIClient(), user, input);
});

export function createKickoffRevisionStepHandler(
  db: Kysely<Database>,
  openaiClient: OpenAI
) {
  return implement(contract.kickoffRevisionStep).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return kickoffRevisionStep(db, openaiClient, user, input);
    }
  );
}
