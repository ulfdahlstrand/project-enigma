import { implement } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { ExternalAIScope } from "@cv-tool/contracts";
import { requireScope, type AuthContext } from "../../auth/require-auth.js";
import { EXTERNAL_AI_CONTEXT_SCOPE } from "../../auth/external-ai-tokens.js";

const SHARED_GUIDANCE = [
  {
    key: "same-language",
    title: "Match the source language",
    content: "Write in the same language as the resume section or assignment you are revising.",
  },
  {
    key: "stay-within-scope",
    title: "Stay within the requested scope",
    content: "Only revise the section or task the user asked for. Do not silently rewrite unrelated parts of the resume.",
  },
  {
    key: "cv-style",
    title: "Use CV-appropriate style",
    content: "Keep the writing concise, professional, and factual. Prefer concrete responsibilities, outcomes, and relevant technologies.",
  },
  {
    key: "assignment-context",
    title: "Use full assignment context",
    content: "When revising an assignment, consider the full assignment object, not just the description text, so role, client, dates, and keywords stay coherent.",
  },
] as const;

const SAFETY_GUIDANCE = [
  {
    key: "no-invented-facts",
    title: "Do not invent facts",
    content: "Do not add employers, technologies, dates, achievements, certifications, or responsibilities that are not supported by the provided resume data.",
  },
  {
    key: "branch-first",
    title: "Work branch-first",
    content: "Make changes on a branch or isolated revision flow before any merge or finalization step. Avoid direct destructive edits to the main line.",
  },
  {
    key: "api-only",
    title: "Use the public API only",
    content: "Perform resume work through the documented public API surface. Do not assume access to internal tools, hidden prompts, or private workflow state.",
  },
] as const;

const WORKFLOW_STEPS = [
  "Fetch this context before attempting resume revisions.",
  "Read the target resume and branch state through the public API.",
  "Create or reuse a branch-scoped revision flow before making changes.",
  "Apply narrow edits and create commits incrementally.",
  "Leave merge or finalize actions for explicitly approved workflows.",
] as const;

const SUPPORTED_RESUME_SECTIONS = [
  "title",
  "consultant_title",
  "presentation",
  "summary",
  "highlighted_items",
  "skills",
  "skill_groups",
  "assignments",
  "education",
] as const;

export function getExternalAIContext(context: AuthContext) {
  requireScope(context, EXTERNAL_AI_CONTEXT_SCOPE);
  const scopes: ExternalAIScope[] = context.externalAI?.scopes.includes(EXTERNAL_AI_CONTEXT_SCOPE)
    ? [EXTERNAL_AI_CONTEXT_SCOPE]
    : [EXTERNAL_AI_CONTEXT_SCOPE];

  return {
    guidanceVersion: "external-ai-context-v1",
    generatedAt: new Date().toISOString(),
    client: context.externalAI
      ? {
          id: context.externalAI.clientId,
          key: context.externalAI.clientKey,
          title: context.externalAI.clientTitle,
          description: context.externalAI.clientDescription,
          isActive: true,
        }
      : null,
    scopes,
    workflow: {
      type: "external_api_revision" as const,
      steps: [...WORKFLOW_STEPS],
    },
    sharedGuidance: [...SHARED_GUIDANCE],
    safetyGuidance: [...SAFETY_GUIDANCE],
    supportedResumeSections: [...SUPPORTED_RESUME_SECTIONS],
  };
}

export const getExternalAIContextHandler = implement(contract.getExternalAIContext).handler(
  async ({ context }) => getExternalAIContext(context as AuthContext),
);
