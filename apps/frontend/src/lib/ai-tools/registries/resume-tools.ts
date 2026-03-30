import { z } from "zod";
import { createAIToolRegistry } from "../runtime";
import type { AIToolRegistry } from "../types";

const revisionPlanActionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  status: z.enum(["pending", "done", "skipped"]).default("pending"),
});

export const revisionPlanSchema = z.object({
  summary: z.string().min(1),
  actions: z.array(revisionPlanActionSchema),
});

export type RevisionPlan = z.infer<typeof revisionPlanSchema>;

const revisionSuggestionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  section: z.string().min(1),
  suggestedText: z.string().min(1),
  status: z.enum(["pending", "accepted", "dismissed"]).default("pending"),
});

export const revisionSuggestionsSchema = z.object({
  summary: z.string().min(1),
  suggestions: z.array(revisionSuggestionSchema),
});

export type RevisionSuggestions = z.infer<typeof revisionSuggestionsSchema>;

const legacyRevisionSuggestionSchema = z.object({
  location: z.string().min(1),
  text: z.string().min(1).optional(),
  suggestion: z.string().min(1),
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
});

const revisionSuggestionsInputSchema = z
  .object({
    summary: z.string().min(1).optional(),
    suggestions: z.array(z.union([revisionSuggestionSchema, legacyRevisionSuggestionSchema])),
  })
  .transform((input): RevisionSuggestions => ({
    summary: input.summary ?? "Suggested revision actions",
    suggestions: input.suggestions.map((suggestion, index) => {
      if ("suggestedText" in suggestion) {
        return suggestion;
      }

      const fallbackTitle = suggestion.title ?? `Suggestion ${index + 1}`;
      const sourceText = suggestion.text?.trim();
      const proposedText = suggestion.suggestion.trim();

      return {
        id: `suggestion-${index + 1}`,
        title: fallbackTitle,
        description:
          suggestion.description ??
          (sourceText
            ? `Replace "${sourceText}" with the proposed correction.`
            : "Review and apply the proposed correction."),
        section: suggestion.location,
        suggestedText: proposedText,
        status: "pending" as const,
      };
    }),
  }));

export interface ResumeSkillSnapshot {
  name: string;
  category: string | null;
}

export interface ResumeAssignmentSnapshot {
  id: string;
  clientName: string;
  role: string;
  description: string;
  technologies: string[];
  isCurrent: boolean;
  startDate: string | null;
  endDate: string | null;
}

export interface ResumeInspectionSnapshot {
  resumeId: string;
  employeeName: string;
  title: string;
  consultantTitle: string | null;
  language: string | null | undefined;
  presentation: string[];
  summary: string | null;
  skills: ResumeSkillSnapshot[];
  assignments: ResumeAssignmentSnapshot[];
}

function excerpt(text: string, maxLength = 280): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength)}…`;
}

function groupSkills(skills: ResumeSkillSnapshot[]) {
  const grouped = skills.reduce<Record<string, string[]>>((acc, skill) => {
    const category = skill.category?.trim() || "Other";
    acc[category] = [...(acc[category] ?? []), skill.name];
    return acc;
  }, {});

  return Object.entries(grouped).map(([category, names]) => ({
    category,
    names: names.slice(0, 12),
    total: names.length,
  }));
}

interface CreateResumePlanningToolRegistryOptions {
  getResumeSnapshot: () => ResumeInspectionSnapshot;
  setRevisionPlan: (plan: RevisionPlan) => void;
}

export function createResumePlanningToolRegistry({
  getResumeSnapshot,
  setRevisionPlan,
}: CreateResumePlanningToolRegistryOptions): AIToolRegistry {
  return createAIToolRegistry([
    {
      name: "inspect_resume",
      description: "Return structured resume content for the active resume view.",
      inputSchema: z.object({
        includeAssignments: z.boolean().optional().default(true),
      }),
      execute: ({ includeAssignments }) => {
        const snapshot = getResumeSnapshot();
        const groupedSkills = groupSkills(snapshot.skills);
        const compactAssignments = snapshot.assignments.slice(0, 8).map((assignment) => ({
          id: assignment.id,
          clientName: assignment.clientName,
          role: assignment.role,
          period: assignment.isCurrent
            ? `${assignment.startDate ?? "?"} - present`
            : `${assignment.startDate ?? "?"} - ${assignment.endDate ?? "?"}`,
          technologies: assignment.technologies.slice(0, 8),
          descriptionExcerpt: excerpt(assignment.description),
        }));

        return {
          resumeId: snapshot.resumeId,
          employeeName: snapshot.employeeName,
          title: snapshot.title,
          consultantTitle: snapshot.consultantTitle,
          language: snapshot.language,
          presentation: snapshot.presentation.map((paragraph) => excerpt(paragraph, 320)),
          summary: snapshot.summary ? excerpt(snapshot.summary, 240) : null,
          skillGroups: groupedSkills,
          assignmentCount: snapshot.assignments.length,
          assignments: includeAssignments ? compactAssignments : [],
        };
      },
    },
    {
      name: "set_revision_plan",
      description: "Replace the current inline revision plan for the active resume.",
      inputSchema: revisionPlanSchema,
      execute: (input) => {
        setRevisionPlan(input);
        return input;
      },
    },
  ]);
}

interface CreateResumeActionToolRegistryOptions {
  getResumeSnapshot: () => ResumeInspectionSnapshot;
  getRevisionPlan: () => RevisionPlan | null;
  setRevisionSuggestions: (suggestions: RevisionSuggestions) => void;
}

const inspectResumeSectionInputSchema = z.object({
  section: z.enum(["title", "consultantTitle", "presentation", "summary", "assignment"]),
  assignmentId: z.string().optional(),
});

export function createResumeActionToolRegistry({
  getResumeSnapshot,
  getRevisionPlan,
  setRevisionSuggestions,
}: CreateResumeActionToolRegistryOptions): AIToolRegistry {
  return createAIToolRegistry([
    {
      name: "inspect_revision_plan",
      description: "Return the current agreed revision plan for the active resume.",
      inputSchema: z.object({}),
      execute: () => {
        const plan = getRevisionPlan();
        if (!plan) {
          throw new Error("No revision plan is available yet.");
        }

        return plan;
      },
    },
    {
      name: "inspect_resume",
      description: "Return structured resume content for the active resume view.",
      inputSchema: z.object({
        includeAssignments: z.boolean().optional().default(true),
      }),
      execute: ({ includeAssignments }) => {
        const snapshot = getResumeSnapshot();
        const groupedSkills = groupSkills(snapshot.skills);
        const compactAssignments = snapshot.assignments.slice(0, 8).map((assignment) => ({
          id: assignment.id,
          clientName: assignment.clientName,
          role: assignment.role,
          period: assignment.isCurrent
            ? `${assignment.startDate ?? "?"} - present`
            : `${assignment.startDate ?? "?"} - ${assignment.endDate ?? "?"}`,
          technologies: assignment.technologies.slice(0, 8),
          descriptionExcerpt: excerpt(assignment.description),
        }));

        return {
          resumeId: snapshot.resumeId,
          employeeName: snapshot.employeeName,
          title: snapshot.title,
          consultantTitle: snapshot.consultantTitle,
          language: snapshot.language,
          presentation: snapshot.presentation.map((paragraph) => excerpt(paragraph, 320)),
          summary: snapshot.summary ? excerpt(snapshot.summary, 240) : null,
          skillGroups: groupedSkills,
          assignmentCount: snapshot.assignments.length,
          assignments: includeAssignments ? compactAssignments : [],
        };
      },
    },
    {
      name: "inspect_resume_section",
      description: "Return the exact source text for a specific resume section so suggestions can be grounded in the actual current content.",
      inputSchema: inspectResumeSectionInputSchema,
      execute: ({ section, assignmentId }) => {
        const snapshot = getResumeSnapshot();

        if (section === "title") {
          return {
            section,
            text: snapshot.title,
          };
        }

        if (section === "consultantTitle") {
          return {
            section,
            text: snapshot.consultantTitle ?? "",
          };
        }

        if (section === "presentation") {
          return {
            section,
            paragraphs: snapshot.presentation,
            text: snapshot.presentation.join("\n\n"),
          };
        }

        if (section === "summary") {
          return {
            section,
            text: snapshot.summary ?? "",
          };
        }

        const assignment = snapshot.assignments.find((item) => item.id === assignmentId);
        if (!assignment) {
          throw new Error("Assignment not found for inspect_resume_section.");
        }

        return {
          section,
          assignmentId: assignment.id,
          clientName: assignment.clientName,
          role: assignment.role,
          text: assignment.description,
        };
      },
    },
    {
      name: "set_revision_suggestions",
      description: "Replace the current inline revision suggestions for the active resume.",
      inputSchema: revisionSuggestionsInputSchema,
      execute: (input) => {
        if (!getRevisionPlan()) {
          throw new Error("A revision plan must be set before revision suggestions can be added.");
        }

        setRevisionSuggestions(input);
        return input;
      },
    },
  ]);
}
