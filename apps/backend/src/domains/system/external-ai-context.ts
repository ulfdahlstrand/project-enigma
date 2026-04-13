import { implement } from "@orpc/server";
import {
  contract,
  type ExternalAIAgentPromptModel,
  type ExternalAIConsultantPromptModel,
  type ExternalAIPromptGuidance,
  type ExternalAIPromptGuidanceFragment,
  type ExternalAIPromptLayer,
  type ExternalAIScope,
} from "@cv-tool/contracts";
import { requireAuth, requireScope, type AuthContext } from "../../auth/require-auth.js";
import { getDb } from "../../db/client.js";
import { resolveEmployeeId } from "../../auth/resolve-employee-id.js";
import {
  EXTERNAL_AI_BRANCH_ASSIGNMENT_READ_SCOPE,
  EXTERNAL_AI_BRANCH_ASSIGNMENT_WRITE_SCOPE,
  EXTERNAL_AI_BRANCH_SKILL_WRITE_SCOPE,
  EXTERNAL_AI_CONTEXT_SCOPE,
  EXTERNAL_AI_EDUCATION_READ_SCOPE,
  EXTERNAL_AI_EDUCATION_WRITE_SCOPE,
  EXTERNAL_AI_RESUME_BRANCH_READ_SCOPE,
  EXTERNAL_AI_RESUME_BRANCH_WRITE_SCOPE,
  EXTERNAL_AI_RESUME_COMMIT_READ_SCOPE,
  EXTERNAL_AI_RESUME_COMMIT_WRITE_SCOPE,
  EXTERNAL_AI_RESUME_READ_SCOPE,
} from "../../auth/external-ai-tokens.js";
import { listAIPromptFragmentsByKeys } from "./ai-prompt-configs.js";
import { getConsultantAIPreferencesForEmployee } from "./consultant-ai-preferences.js";

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
  "Read the target resume and branch state through the public API, preferring the direct branch endpoint when you are working on a specific branch.",
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

const ALLOWED_ROUTES = [
  { method: "GET", path: "/external-ai/context", requiredScope: EXTERNAL_AI_CONTEXT_SCOPE, purpose: "Fetch the external AI workflow, scopes, and editing guidance." },
  { method: "GET", path: "/resumes/{resumeId}", requiredScope: EXTERNAL_AI_RESUME_READ_SCOPE, purpose: "Read a resume with its current snapshot-backed content." },
  { method: "GET", path: "/resumes/{resumeId}/branches", requiredScope: EXTERNAL_AI_RESUME_BRANCH_READ_SCOPE, purpose: "List available branches for a resume." },
  { method: "GET", path: "/resumes/{resumeId}/branches/{branchId}", requiredScope: EXTERNAL_AI_RESUME_BRANCH_READ_SCOPE, purpose: "Read the current state of a specific branch without resolving its head commit separately." },
  { method: "GET", path: "/resume-branches/{branchId}/assignments", requiredScope: EXTERNAL_AI_BRANCH_ASSIGNMENT_READ_SCOPE, purpose: "List the full assignment entries currently present on a branch." },
  { method: "POST", path: "/resume-commits/{fromCommitId}/branches", requiredScope: EXTERNAL_AI_RESUME_BRANCH_WRITE_SCOPE, purpose: "Create a new branch from an existing commit." },
  { method: "GET", path: "/resume-branches/{branchId}/commits", requiredScope: EXTERNAL_AI_RESUME_COMMIT_READ_SCOPE, purpose: "List commits on a branch." },
  { method: "GET", path: "/resume-commits/{commitId}", requiredScope: EXTERNAL_AI_RESUME_COMMIT_READ_SCOPE, purpose: "Read a specific commit snapshot." },
  { method: "POST", path: "/resume-commits/compare", requiredScope: EXTERNAL_AI_RESUME_COMMIT_READ_SCOPE, purpose: "Compare two commits." },
  { method: "PATCH", path: "/resume-branches/{branchId}/content", requiredScope: EXTERNAL_AI_RESUME_BRANCH_WRITE_SCOPE, purpose: "Update branch-scoped title, consultant title, presentation, summary, highlighted items, and education snapshot content." },
  { method: "POST", path: "/resume-branches/{branchId}/commits", requiredScope: EXTERNAL_AI_RESUME_COMMIT_WRITE_SCOPE, purpose: "Create a new commit on a branch." },
  { method: "POST", path: "/resumes/{resumeId}/branches/{branchId}/assignments", requiredScope: EXTERNAL_AI_BRANCH_ASSIGNMENT_WRITE_SCOPE, purpose: "Add a branch-scoped assignment entry within the resume/branch hierarchy." },
  { method: "PATCH", path: "/resumes/{resumeId}/branches/{branchId}/assignments/{id}", requiredScope: EXTERNAL_AI_BRANCH_ASSIGNMENT_WRITE_SCOPE, purpose: "Update an existing branch-scoped assignment within the resume/branch hierarchy." },
  { method: "DELETE", path: "/resumes/{resumeId}/branches/{branchId}/assignments/{id}", requiredScope: EXTERNAL_AI_BRANCH_ASSIGNMENT_WRITE_SCOPE, purpose: "Remove a branch-scoped assignment within the resume/branch hierarchy." },
  { method: "PATCH", path: "/resume-branches/{branchId}/skills", requiredScope: EXTERNAL_AI_BRANCH_SKILL_WRITE_SCOPE, purpose: "Replace the branch-scoped skills and skill groups snapshot." },
  { method: "GET", path: "/employees/{employeeId}/education", requiredScope: EXTERNAL_AI_EDUCATION_READ_SCOPE, purpose: "List education entries for an employee." },
  { method: "POST", path: "/employees/{employeeId}/education", requiredScope: EXTERNAL_AI_EDUCATION_WRITE_SCOPE, purpose: "Create an education entry." },
  { method: "PATCH", path: "/employees/{employeeId}/education/{id}", requiredScope: EXTERNAL_AI_EDUCATION_WRITE_SCOPE, purpose: "Update an education entry." },
  { method: "DELETE", path: "/employees/{employeeId}/education/{id}", requiredScope: EXTERNAL_AI_EDUCATION_WRITE_SCOPE, purpose: "Delete an education entry." },
] as const;

const EXTERNAL_PROMPT_GUIDANCE_CONFIGS = [
  {
    promptKey: "external-ai.shared-guidance",
    key: "shared-resume-guidance",
    title: "Shared resume revision guidance",
    purpose: "Use these instructions for any external AI-driven resume revision workflow.",
    appliesToSections: ["title", "consultant_title", "presentation", "summary", "highlighted_items", "skills", "skill_groups", "assignments", "education"],
  },
  {
    promptKey: "external-ai.assignment-guidance",
    key: "assignment-guidance",
    title: "Assignment editing guidance",
    purpose: "Use these instructions when revising or creating assignment content.",
    appliesToSections: ["assignments"],
  },
  {
    promptKey: "external-ai.presentation-guidance",
    key: "presentation-guidance",
    title: "Presentation editing guidance",
    purpose: "Use these instructions when revising the presentation or consultant summary style.",
    appliesToSections: ["presentation", "summary", "consultant_title"],
  },
] as const;

export type ExternalAIContextLike = Pick<AuthContext, "user" | "externalAI">;

function findFragmentContent(
  fragments: ExternalAIPromptGuidanceFragment[],
  key: string,
): string | null {
  return fragments.find((fragment) => fragment.key === key)?.content ?? null;
}

function buildPromptLayer(fragments: ExternalAIPromptGuidanceFragment[]): ExternalAIPromptLayer {
  return {
    prompt: findFragmentContent(fragments, "base_prompt"),
    rules: findFragmentContent(fragments, "rules"),
    validators: findFragmentContent(fragments, "validators"),
    workflow: findFragmentContent(fragments, "workflow"),
    contextRequirements: findFragmentContent(fragments, "context_requirements"),
    outputContract: findFragmentContent(fragments, "output_contract"),
  };
}

function buildConsultantPromptModel(preferences: {
  prompt: string | null;
  rules: string | null;
  validators: string | null;
  updatedAt: string;
} | null): ExternalAIConsultantPromptModel {
  if (!preferences) {
    return {
      supported: true,
      note: "No consultant-specific preferences are configured yet.",
      layers: {
        prompt: null,
        rules: null,
        validators: null,
        workflow: null,
        contextRequirements: null,
        outputContract: null,
      },
      updatedAt: null,
    };
  }

  return {
    supported: true,
    note: null,
    layers: {
      prompt: preferences.prompt,
      rules: preferences.rules,
      validators: preferences.validators,
      workflow: null,
      contextRequirements: null,
      outputContract: null,
    },
    updatedAt: preferences.updatedAt,
  };
}

function buildPromptModel(
  promptGuidance: ExternalAIPromptGuidance[],
  consultantPreferences: {
    prompt: string | null;
    rules: string | null;
    validators: string | null;
    updatedAt: string;
  } | null,
) {
  const [baseGuidance, ...agentGuidance] = promptGuidance;

  return {
    base: baseGuidance ? buildPromptLayer(baseGuidance.fragments) : buildPromptLayer([]),
    agents: agentGuidance.map<ExternalAIAgentPromptModel>((guidance) => ({
      key: guidance.key,
      title: guidance.title,
      appliesToSections: guidance.appliesToSections,
      layers: buildPromptLayer(guidance.fragments),
    })),
    consultant: buildConsultantPromptModel(consultantPreferences),
  };
}

export async function listExternalAIPromptGuidance(): Promise<ExternalAIPromptGuidance[]> {
  const fragmentsByPromptKey = await listAIPromptFragmentsByKeys(
    getDb(),
    EXTERNAL_PROMPT_GUIDANCE_CONFIGS.map((config) => config.promptKey),
  );

  return EXTERNAL_PROMPT_GUIDANCE_CONFIGS.map((config) => ({
    key: config.key,
    title: config.title,
    purpose: config.purpose,
    appliesToSections: [...config.appliesToSections],
    fragments: (fragmentsByPromptKey[config.promptKey] ?? []).map((fragment) => ({
      key: fragment.key,
      label: fragment.label,
      content: fragment.content,
    })),
  })).filter((guidance) => guidance.fragments.length > 0);
}

export function getExternalAIContext(
  context: ExternalAIContextLike,
  promptGuidance: ExternalAIPromptGuidance[] = [],
  consultantPreferences: {
    prompt: string | null;
    rules: string | null;
    validators: string | null;
    updatedAt: string;
  } | null = null,
) {
  requireScope(context as AuthContext, EXTERNAL_AI_CONTEXT_SCOPE);
  const scopes: ExternalAIScope[] = context.externalAI?.scopes?.length
    ? context.externalAI.scopes.filter((scope): scope is ExternalAIScope => typeof scope === "string")
    : [EXTERNAL_AI_CONTEXT_SCOPE];

  return {
    guidanceVersion: "external-ai-context-v2",
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
    allowedRoutes: ALLOWED_ROUTES
      .filter((route) => scopes.includes(route.requiredScope))
      .map((route) => ({ ...route })),
    sharedGuidance: [...SHARED_GUIDANCE],
    safetyGuidance: [...SAFETY_GUIDANCE],
    promptGuidance,
    promptModel: buildPromptModel(promptGuidance, consultantPreferences),
    supportedResumeSections: [...SUPPORTED_RESUME_SECTIONS],
  };
}

export const getExternalAIContextHandler = implement(contract.getExternalAIContext).handler(
  async ({ context }) => {
    const authContext = context as AuthContext;
    const user = requireAuth(authContext);
    const [promptGuidance, employeeId] = await Promise.all([
      listExternalAIPromptGuidance(),
      resolveEmployeeId(getDb(), user),
    ]);
    const consultantPreferences = await getConsultantAIPreferencesForEmployee(getDb(), employeeId);
    return getExternalAIContext(authContext, promptGuidance, consultantPreferences);
  },
);
