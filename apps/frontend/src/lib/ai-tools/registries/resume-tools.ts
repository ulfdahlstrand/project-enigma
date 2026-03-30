import { z } from "zod";
import { createAIToolRegistry } from "../runtime";
import type { AIToolRegistry } from "../types";

const revisionPlanActionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  assignmentId: z.string().optional(),
  status: z.enum(["pending", "done", "skipped"]).default("pending"),
});

export const revisionPlanSchema = z.object({
  summary: z.string().min(1),
  actions: z.array(revisionPlanActionSchema),
});

export type RevisionPlan = z.infer<typeof revisionPlanSchema>;

const revisionWorkItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  section: z.string().min(1),
  assignmentId: z.string().optional(),
  status: z.enum(["pending", "in_progress", "completed", "no_changes_needed"]).default("pending"),
  note: z.string().optional(),
});

export const revisionWorkItemsSchema = z.object({
  summary: z.string().min(1),
  items: z.array(revisionWorkItemSchema),
});

export type RevisionWorkItems = z.infer<typeof revisionWorkItemsSchema>;

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
  sortOrder: number;
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
  const grouped = skills.reduce<Record<string, { names: string[]; sortOrders: number[] }>>((acc, skill) => {
    const category = skill.category?.trim() || "Other";
    const current = acc[category] ?? { names: [], sortOrders: [] };
    acc[category] = {
      names: [...current.names, skill.name],
      sortOrders: [...current.sortOrders, skill.sortOrder],
    };
    return acc;
  }, {});

  return Object.entries(grouped)
    .map(([category, value]) => ({
    category,
    names: value.names.slice(0, 12),
    total: value.names.length,
    minSortOrder: Math.min(...value.sortOrders),
  }))
    .sort((a, b) => a.minSortOrder - b.minSortOrder);
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
  setRevisionWorkItems: (workItems: RevisionWorkItems) => void;
  markRevisionWorkItemNoChangesNeeded: (input: { workItemId: string; note?: string }) => void;
  appendRevisionSuggestions: (suggestions: RevisionSuggestions) => void;
  setRevisionSuggestions: (suggestions: RevisionSuggestions) => void;
}

const inspectResumeSectionInputSchema = z.object({
  section: z.enum(["title", "consultantTitle", "presentation", "summary", "assignment"]),
  assignmentId: z.string().optional(),
});

const inspectResumeSectionsInputSchema = z.object({
  includeAssignments: z.boolean().optional().default(true),
});

const inspectResumeSkillsInputSchema = z.object({});

const setRevisionWorkItemsInputSchema = revisionWorkItemsSchema;

const markRevisionWorkItemNoChangesNeededInputSchema = z.object({
  workItemId: z.string().min(1),
  note: z.string().optional(),
});

const listResumeAssignmentsInputSchema = z.object({});

const inspectAssignmentInputSchema = z.object({
  assignmentId: z.string().min(1),
});

const setAssignmentSuggestionsInputSchema = z.object({
  workItemId: z.string().min(1),
  summary: z.string().min(1).optional(),
  suggestions: z.array(z.union([revisionSuggestionSchema, legacyRevisionSuggestionSchema])),
}).transform((input) => ({
  workItemId: input.workItemId,
  suggestions: revisionSuggestionsInputSchema.parse({
    summary: input.summary,
    suggestions: input.suggestions,
  }),
}));

export function createResumeActionToolRegistry({
  getResumeSnapshot,
  setRevisionWorkItems,
  markRevisionWorkItemNoChangesNeeded,
  appendRevisionSuggestions,
  setRevisionSuggestions,
}: CreateResumeActionToolRegistryOptions): AIToolRegistry {
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
      name: "list_resume_assignments",
      description: "Return the ordered list of assignments so the assistant can create explicit work items for assignment-focused revisions.",
      inputSchema: listResumeAssignmentsInputSchema,
      execute: () => {
        const snapshot = getResumeSnapshot();
        return {
          totalAssignments: snapshot.assignments.length,
          assignments: snapshot.assignments.map((assignment, index) => ({
            index,
            assignmentId: assignment.id,
            clientName: assignment.clientName,
            role: assignment.role,
          })),
        };
      },
    },
    {
      name: "inspect_assignment",
      description: "Return the exact source text for a specific assignment.",
      inputSchema: inspectAssignmentInputSchema,
      execute: ({ assignmentId }) => {
        const snapshot = getResumeSnapshot();
        const assignment = snapshot.assignments.find((item) => item.id === assignmentId);

        if (!assignment) {
          throw new Error("Assignment not found for inspect_assignment.");
        }

        return {
          assignmentId: assignment.id,
          clientName: assignment.clientName,
          role: assignment.role,
          text: assignment.description,
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
      name: "inspect_resume_sections",
      description:
        "Return the exact current text for the editable resume sections so the assistant can review the whole CV, not just one section at a time.",
      inputSchema: inspectResumeSectionsInputSchema,
      execute: ({ includeAssignments }) => {
        const snapshot = getResumeSnapshot();

        return {
          title: snapshot.title,
          consultantTitle: snapshot.consultantTitle ?? "",
          presentation: snapshot.presentation,
          summary: snapshot.summary ?? "",
          assignments: includeAssignments
            ? snapshot.assignments.map((assignment) => ({
                assignmentId: assignment.id,
                clientName: assignment.clientName,
                role: assignment.role,
                text: assignment.description,
              }))
            : [],
        };
      },
    },
    {
      name: "inspect_resume_skills",
      description:
        "Return the exact current skills structure, including group order and skill order, so the assistant can review spelling, ordering, and missing skill sections.",
      inputSchema: inspectResumeSkillsInputSchema,
      execute: () => {
        const snapshot = getResumeSnapshot();
        const orderedSkills = [...snapshot.skills].sort((a, b) => a.sortOrder - b.sortOrder);
        const groups = orderedSkills.reduce<
          Array<{
            category: string;
            skills: string[];
            skillCount: number;
            firstSortOrder: number;
          }>
        >((acc, skill) => {
          const category = skill.category?.trim() || "Other";
          const existing = acc.find((group) => group.category === category);

          if (existing) {
            existing.skills.push(skill.name);
            existing.skillCount += 1;
            return acc;
          }

          return [
            ...acc,
            {
              category,
              skills: [skill.name],
              skillCount: 1,
              firstSortOrder: skill.sortOrder,
            },
          ];
        }, []);

        return {
          totalSkills: orderedSkills.length,
          groups: groups.map((group, index) => ({
            category: group.category,
            groupOrder: index,
            skills: group.skills,
            skillCount: group.skillCount,
          })),
        };
      },
    },
    {
      name: "set_revision_work_items",
      description: "Create or replace the explicit work items for the current revision pass.",
      inputSchema: setRevisionWorkItemsInputSchema,
      execute: (input) => {
        setRevisionWorkItems(input);
        return input;
      },
    },
    {
      name: "mark_revision_work_item_no_changes_needed",
      description: "Mark one explicit work item as reviewed with no changes needed.",
      inputSchema: markRevisionWorkItemNoChangesNeededInputSchema,
      execute: (input) => {
        markRevisionWorkItemNoChangesNeeded(input);
        return input;
      },
    },
    {
      name: "set_assignment_suggestions",
      description: "Add or replace suggestions for one assignment work item and mark that work item as completed.",
      inputSchema: setAssignmentSuggestionsInputSchema,
      execute: ({ workItemId, suggestions }) => {
        const normalizedSuggestions: RevisionSuggestions = {
          ...suggestions,
          suggestions: suggestions.suggestions.map((suggestion: RevisionSuggestions["suggestions"][number]) => ({
            ...suggestion,
            id: `${workItemId}:${suggestion.id}`,
          })),
        };

        appendRevisionSuggestions(normalizedSuggestions);
        return {
          workItemId,
          summary: normalizedSuggestions.summary,
          suggestionCount: normalizedSuggestions.suggestions.length,
        };
      },
    },
    {
      name: "set_revision_suggestions",
      description: "Replace the current inline revision suggestions for the active resume.",
      inputSchema: revisionSuggestionsInputSchema,
      execute: (input) => {
        setRevisionSuggestions(input);
        return input;
      },
    },
  ]);
}
