import { z } from "zod";
import { createAIToolRegistry } from "../runtime";
import type { AIToolRegistry } from "../types";
import {
  buildInspectResumeResult,
  legacyRevisionSuggestionSchema,
  revisionSuggestionSchema,
  revisionSuggestionsInputSchema,
  revisionWorkItemsSchema,
  type ResumeInspectionSnapshot,
  type RevisionSuggestions,
  type RevisionWorkItems,
} from "./resume-tool-schemas";

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

const markRevisionWorkItemNoChangesNeededInputSchema = z.object({
  workItemId: z.string().min(1),
  note: z.string().optional(),
});

const inspectAssignmentInputSchema = z.object({
  assignmentId: z.string().min(1),
});

const setAssignmentSuggestionsInputSchema = z
  .object({
    workItemId: z.string().min(1),
    summary: z.string().min(1).optional(),
    suggestions: z.array(z.union([revisionSuggestionSchema, legacyRevisionSuggestionSchema])),
  })
  .transform((input) => ({
    workItemId: input.workItemId,
    suggestions: revisionSuggestionsInputSchema.parse({
      summary: input.summary,
      suggestions: input.suggestions,
    }),
  }));

function buildInspectSectionResult(snapshot: ResumeInspectionSnapshot, section: string, assignmentId?: string) {
  if (section === "title") return { section, text: snapshot.title };
  if (section === "consultantTitle") return { section, text: snapshot.consultantTitle ?? "" };
  if (section === "presentation") {
    return { section, paragraphs: snapshot.presentation, text: snapshot.presentation.join("\n\n") };
  }
  if (section === "summary") return { section, text: snapshot.summary ?? "" };

  const assignment = snapshot.assignments.find((item) => item.id === assignmentId);
  if (!assignment) throw new Error("Assignment not found for inspect_resume_section.");

  return {
    section,
    assignmentId: assignment.id,
    clientName: assignment.clientName,
    role: assignment.role,
    text: assignment.description,
  };
}

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
      execute: ({ includeAssignments }) =>
        buildInspectResumeResult(getResumeSnapshot(), includeAssignments),
    },
    {
      name: "list_resume_assignments",
      description:
        "Return the ordered list of assignments so the assistant can create explicit work items for assignment-focused revisions.",
      inputSchema: z.object({}),
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
        if (!assignment) throw new Error("Assignment not found for inspect_assignment.");
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
      description:
        "Return the exact source text for a specific resume section so suggestions can be grounded in the actual current content.",
      inputSchema: inspectResumeSectionInputSchema,
      execute: ({ section, assignmentId }) =>
        buildInspectSectionResult(getResumeSnapshot(), section, assignmentId),
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
          presentation: snapshot.presentation.join("\n\n"),
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
          Array<{ category: string; skills: string[]; skillCount: number; firstSortOrder: number }>
        >((acc, skill) => {
          const category = skill.category?.trim() || "Other";
          const existing = acc.find((group) => group.category === category);
          if (existing) {
            existing.skills.push(skill.name);
            existing.skillCount += 1;
            return acc;
          }
          return [...acc, { category, skills: [skill.name], skillCount: 1, firstSortOrder: skill.sortOrder }];
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
      inputSchema: revisionWorkItemsSchema,
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
      description:
        "Add or replace suggestions for one assignment work item and mark that work item as completed.",
      inputSchema: setAssignmentSuggestionsInputSchema,
      execute: ({ workItemId, suggestions }) => {
        const normalizedSuggestions: RevisionSuggestions = {
          ...suggestions,
          suggestions: suggestions.suggestions.map(
            (suggestion: RevisionSuggestions["suggestions"][number]) => ({
              ...suggestion,
              id: `${workItemId}:${suggestion.id}`,
            }),
          ),
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
