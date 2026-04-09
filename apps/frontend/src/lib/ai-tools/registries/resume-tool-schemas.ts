import { z } from "zod";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

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

const revisionSuggestionSkillSchema = z.object({
  name: z.string().min(1),
  category: z.string().nullable(),
  sortOrder: z.number(),
});

const revisionSuggestionSkillScopeSchema = z.object({
  type: z.enum(["group_order", "group_contents", "group_rename"]),
  category: z.string().min(1).optional(),
});

export const revisionSuggestionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  section: z.string().min(1),
  assignmentId: z.string().optional(),
  suggestedText: z.string().min(1),
  skills: z.array(revisionSuggestionSkillSchema).optional(),
  skillScope: revisionSuggestionSkillScopeSchema.optional(),
  status: z.enum(["pending", "accepted", "dismissed"]).default("pending"),
});

export const revisionSuggestionsSchema = z.object({
  summary: z.string().min(1),
  suggestions: z.array(revisionSuggestionSchema),
});

export type RevisionSuggestions = z.infer<typeof revisionSuggestionsSchema>;

export const legacyRevisionSuggestionSchema = z.object({
  location: z.string().min(1),
  assignmentId: z.string().optional(),
  text: z.string().min(1).optional(),
  suggestion: z.string().min(1),
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
});

const revisionSuggestionsInputShapeSchema = z.object({
  summary: z.string().min(1).optional(),
  suggestions: z.array(z.union([revisionSuggestionSchema, legacyRevisionSuggestionSchema])),
});

function isGenericSuggestionTitle(title: string): boolean {
  const normalized = title.trim().toLowerCase();
  return (
    normalized === "suggestion"
    || /^suggestion \d+$/.test(normalized)
    || normalized === "fix spelling"
    || normalized === "spelling fix"
    || normalized === "proofread"
    || normalized === "review assignment"
    || normalized === "review assignments"
    || normalized === "fix assignment"
    || normalized === "fix spelling in assignment"
    || normalized === "fix spelling in assignments"
    || normalized === "assignment correction"
    || normalized === "fix typo"
    || normalized === "review section"
  );
}

function buildSuggestionTitleContext(raw: {
  section?: string | undefined;
  description?: string | undefined;
  assignmentId?: string | undefined;
  suggestedText?: string | undefined;
}) {
  const description = raw.description?.trim() ?? "";
  const section = raw.section?.trim() ?? "";

  const assignmentMatch =
    description.match(/\bfor\s+(.+?)(?:\s+assignment|\s+uppdrag|\.)/i)
    ?? description.match(/\bin\s+(.+?)(?:\s+assignment|\s+uppdrag|\.)/i)
    ?? description.match(/\bhos\s+(.+?)(?:\.|,|$)/i);
  const assignmentContext = assignmentMatch?.[1]?.trim();
  if (assignmentContext) {
    return assignmentContext.replace(/^the\s+/i, "");
  }

  if (section) {
    return section;
  }

  const suggestedText = raw.suggestedText?.trim();
  if (suggestedText) {
    return excerpt(suggestedText, 48);
  }

  if (raw.assignmentId) {
    return `assignment ${raw.assignmentId.slice(0, 8)}`;
  }

  return null;
}

function contextualizeSuggestionTitle(raw: {
  title: string;
  section?: string | undefined;
  description?: string | undefined;
  assignmentId?: string | undefined;
  suggestedText?: string | undefined;
}) {
  if (!isGenericSuggestionTitle(raw.title)) {
    return raw.title;
  }

  const context = buildSuggestionTitleContext(raw);
  if (!context) {
    return raw.title;
  }

  if ((raw.section ?? "").trim().toLowerCase() === "assignment") {
    return `Fix assignment: ${context}`;
  }

  return `Revise ${context}`;
}

export function normalizeRevisionSuggestionsInput(input: unknown): RevisionSuggestions {
  const parsed = revisionSuggestionsInputShapeSchema.parse(input);

  return {
    summary: parsed.summary ?? "Suggested revision actions",
    suggestions: parsed.suggestions.map((suggestion, index) => {
      if ("suggestedText" in suggestion) {
        return {
          ...suggestion,
          title: contextualizeSuggestionTitle({
            title: suggestion.title,
            section: suggestion.section,
            description: suggestion.description,
            assignmentId: suggestion.assignmentId,
            suggestedText: suggestion.suggestedText,
          }),
        };
      }

      const fallbackTitle = suggestion.title ?? `Suggestion ${index + 1}`;
      const sourceText = suggestion.text?.trim();
      const proposedText = suggestion.suggestion.trim();

      return {
        id: `suggestion-${index + 1}`,
        title: contextualizeSuggestionTitle({
          title: fallbackTitle,
          section: suggestion.location,
          description:
            suggestion.description ??
            (sourceText
              ? `Replace "${sourceText}" with the proposed correction.`
              : "Review and apply the proposed correction."),
          assignmentId: suggestion.assignmentId,
          suggestedText: proposedText,
        }),
        description:
          suggestion.description ??
          (sourceText
            ? `Replace "${sourceText}" with the proposed correction.`
            : "Review and apply the proposed correction."),
        section: suggestion.location,
        assignmentId: suggestion.assignmentId,
        suggestedText: proposedText,
        status: "pending" as const,
      };
    }),
  };
}

export const revisionSuggestionsInputSchema = revisionSuggestionsInputShapeSchema.transform(
  (input) => normalizeRevisionSuggestionsInput(input),
);

// ---------------------------------------------------------------------------
// Snapshot interfaces
// ---------------------------------------------------------------------------

export interface ResumeSkillSnapshot {
  groupId?: string;
  name: string;
  category: string | null;
  sortOrder: number;
}

export interface ResumeSkillGroupSnapshot {
  name: string;
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
  skillGroups: ResumeSkillGroupSnapshot[];
  skills: ResumeSkillSnapshot[];
  assignments: ResumeAssignmentSnapshot[];
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

export function excerpt(text: string, maxLength = 280): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength)}…`;
}

export function groupSkills(skills: ResumeSkillSnapshot[], skillGroups: ResumeSkillGroupSnapshot[] = []) {
  const grouped = skills.reduce<Record<string, { names: string[]; sortOrders: number[] }>>((acc, skill) => {
    const category = skill.category?.trim() || "Other";
    const current = acc[category] ?? { names: [], sortOrders: [] };
    return {
      ...acc,
      [category]: {
        names: [...current.names, skill.name],
        sortOrders: [...current.sortOrders, skill.sortOrder],
      },
    };
  }, {});

  const groupOrder = new Map(skillGroups.map((group) => [group.name.trim() || "Other", group.sortOrder]));

  return Object.entries(grouped)
    .map(([category, value]) => ({
      category,
      names: value.names.slice(0, 12),
      total: value.names.length,
      minSortOrder: groupOrder.get(category) ?? Math.min(...value.sortOrders),
    }))
    .sort((a, b) => a.minSortOrder - b.minSortOrder);
}

export function buildInspectResumeResult(
  snapshot: ResumeInspectionSnapshot,
  includeAssignments: boolean,
) {
  const groupedSkills = groupSkills(snapshot.skills, snapshot.skillGroups);
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
}
