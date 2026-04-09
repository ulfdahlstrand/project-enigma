import { z } from "zod";

const revisionWorkItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  section: z.string().min(1),
  assignmentId: z.string().optional(),
  status: z.enum(["pending", "in_progress", "completed", "no_changes_needed"]).default("pending"),
  note: z.string().optional(),
});

const revisionWorkItemsSchema = z.object({
  summary: z.string().min(1),
  items: z.array(revisionWorkItemSchema),
});

const markRevisionWorkItemNoChangesNeededSchema = z.object({
  workItemId: z.string().min(1),
  note: z.string().optional(),
});

const setAssignmentSuggestionsSchema = z.object({
  workItemId: z.string().min(1),
  summary: z.string().min(1).optional(),
  suggestions: z.array(z.unknown()),
});

const inspectResumeSchema = z.object({
  includeAssignments: z.boolean().optional().default(true),
});

const inspectResumeSectionsSchema = z.object({
  includeAssignments: z.boolean().optional().default(true),
});

const inspectResumeSectionSchema = z.object({
  section: z.enum(["title", "consultantTitle", "presentation", "summary", "assignment"]),
  assignmentId: z.string().optional(),
});

const inspectAssignmentSchema = z.object({
  assignmentId: z.string().min(1),
});

const listResumeAssignmentsSchema = z.object({});
const inspectResumeSkillsSchema = z.object({});
const listRevisionWorkItemsSchema = z.object({});
const setRevisionSuggestionsSchema = z.object({
  summary: z.string().min(1).optional(),
  suggestions: z.array(z.unknown()),
});

const TOOL_SPECS = [
  {
    name: "inspect_resume",
    description: "Return structured resume content for the active revision branch.",
    parameters: {
      type: "object",
      properties: {
        includeAssignments: { type: "boolean" },
      },
      additionalProperties: false,
    },
    parse: (input: unknown) => inspectResumeSchema.parse(input),
  },
  {
    name: "inspect_resume_sections",
    description: "Return the exact text for the editable resume sections in the active branch.",
    parameters: {
      type: "object",
      properties: {
        includeAssignments: { type: "boolean" },
      },
      additionalProperties: false,
    },
    parse: (input: unknown) => inspectResumeSectionsSchema.parse(input),
  },
  {
    name: "inspect_resume_section",
    description: "Return the exact text for one resume section in the active branch.",
    parameters: {
      type: "object",
      properties: {
        section: {
          type: "string",
          enum: ["title", "consultantTitle", "presentation", "summary", "assignment"],
        },
        assignmentId: { type: "string" },
      },
      required: ["section"],
      additionalProperties: false,
    },
    parse: (input: unknown) => inspectResumeSectionSchema.parse(input),
  },
  {
    name: "inspect_resume_skills",
    description: "Return the exact skills grouping and ordering for the active branch.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    parse: (input: unknown) => inspectResumeSkillsSchema.parse(input),
  },
  {
    name: "list_revision_work_items",
    description: "Return the persisted revision work items and their current statuses for this conversation.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    parse: (input: unknown) => listRevisionWorkItemsSchema.parse(input),
  },
  {
    name: "list_resume_assignments",
    description: "Return the ordered assignments for the active branch.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    parse: (input: unknown) => listResumeAssignmentsSchema.parse(input),
  },
  {
    name: "inspect_assignment",
    description: "Return the exact text for one assignment in the active branch.",
    parameters: {
      type: "object",
      properties: {
        assignmentId: { type: "string" },
      },
      required: ["assignmentId"],
      additionalProperties: false,
    },
    parse: (input: unknown) => inspectAssignmentSchema.parse(input),
  },
  {
    name: "set_revision_work_items",
    description: "Create or replace the explicit revision work items for this conversation.",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              description: { type: "string" },
              section: { type: "string" },
              assignmentId: { type: "string" },
              status: {
                type: "string",
                enum: ["pending", "in_progress", "completed", "no_changes_needed"],
              },
              note: { type: "string" },
            },
            required: ["id", "title", "description", "section"],
            additionalProperties: false,
          },
        },
      },
      required: ["summary", "items"],
      additionalProperties: false,
    },
    parse: (input: unknown) => revisionWorkItemsSchema.parse(input),
  },
  {
    name: "mark_revision_work_item_no_changes_needed",
    description: "Mark one revision work item as reviewed with no changes needed.",
    parameters: {
      type: "object",
      properties: {
        workItemId: { type: "string" },
        note: { type: "string" },
      },
      required: ["workItemId"],
      additionalProperties: false,
    },
    parse: (input: unknown) => markRevisionWorkItemNoChangesNeededSchema.parse(input),
  },
  {
    name: "set_assignment_suggestions",
    description: "Create concrete revision suggestions for one assignment work item.",
    parameters: {
      type: "object",
      properties: {
        workItemId: { type: "string" },
        summary: { type: "string" },
        suggestions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              description: { type: "string" },
              section: { type: "string" },
              assignmentId: { type: "string" },
              suggestedText: { type: "string" },
              status: {
                type: "string",
                enum: ["pending", "accepted", "dismissed"],
              },
            },
            required: ["id", "title", "description", "section", "suggestedText"],
            additionalProperties: true,
          },
        },
      },
      required: ["workItemId", "suggestions"],
      additionalProperties: false,
    },
    parse: (input: unknown) => {
      const parsed = setAssignmentSuggestionsSchema.parse(input);
      return {
        workItemId: parsed.workItemId,
        ...(parsed.summary !== undefined ? { summary: parsed.summary } : {}),
        suggestions: normalizeRevisionSuggestionsInput({ suggestions: parsed.suggestions }).suggestions,
      };
    },
  },
  {
    name: "set_revision_suggestions",
    description: "Create concrete revision suggestions for one or more resume sections.",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string" },
        suggestions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              description: { type: "string" },
              section: { type: "string" },
              assignmentId: { type: "string" },
              suggestedText: { type: "string" },
              status: {
                type: "string",
                enum: ["pending", "accepted", "dismissed"],
              },
            },
            required: ["id", "title", "description", "section", "suggestedText"],
            additionalProperties: true,
          },
        },
      },
      required: ["suggestions"],
      additionalProperties: false,
    },
    parse: (input: unknown) => {
      const parsed = setRevisionSuggestionsSchema.parse(input);
      return normalizeRevisionSuggestionsInput({
        suggestions: parsed.suggestions,
        ...(parsed.summary !== undefined ? { summary: parsed.summary } : {}),
      });
    },
  },
] as const;

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
    return suggestedText.length <= 48 ? suggestedText : `${suggestedText.slice(0, 48)}…`;
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

export function buildRevisionOpenAITools(): any[] {
  return TOOL_SPECS.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

export function parseRevisionToolArguments(toolName: string, argsText: string): unknown {
  const spec = TOOL_SPECS.find((tool) => tool.name === toolName);
  if (!spec) {
    throw new Error(`Unknown revision tool: ${toolName}`);
  }

  const parsed = argsText.trim() ? JSON.parse(argsText) : {};
  return spec.parse(parsed);
}

export function buildLegacyAssistantToolCallContent(
  toolCalls: Array<{ toolName: string; input?: unknown }>,
): string {
  return toolCalls
    .map((toolCall) =>
      [
        "```json",
        JSON.stringify({
          type: "tool_call",
          toolName: toolCall.toolName,
          ...(toolCall.input !== undefined ? { input: toolCall.input } : {}),
        }),
        "```",
      ].join("\n"),
    )
    .join("\n");
}

function normalizeRevisionSuggestionsInput(input: {
  summary?: string | undefined;
  suggestions: unknown[];
}) {
  return {
    summary: input.summary ?? "Suggested revision actions",
    suggestions: input.suggestions.map((suggestion, index) => {
      if (
        typeof suggestion === "object"
        && suggestion !== null
        && "suggestedText" in suggestion
      ) {
        const row = suggestion as Record<string, unknown>;
        return {
          ...suggestion,
          title: contextualizeSuggestionTitle({
            title: typeof row["title"] === "string" ? row["title"] : `Suggestion ${index + 1}`,
            section: typeof row["section"] === "string" ? row["section"] : undefined,
            description: typeof row["description"] === "string" ? row["description"] : undefined,
            assignmentId: typeof row["assignmentId"] === "string" ? row["assignmentId"] : undefined,
            suggestedText: typeof row["suggestedText"] === "string" ? row["suggestedText"] : undefined,
          }),
        };
      }

      const row =
        typeof suggestion === "object" && suggestion !== null
          ? suggestion as Record<string, unknown>
          : {};
      const fallbackTitle =
        typeof row["title"] === "string" ? row["title"] : `Suggestion ${index + 1}`;
      const sourceText =
        typeof row["text"] === "string" ? row["text"].trim() : undefined;
      const proposedText =
        typeof row["suggestion"] === "string" ? row["suggestion"].trim() : "";

      return {
        id: `suggestion-${index + 1}`,
        title: contextualizeSuggestionTitle({
          title: fallbackTitle,
          section:
            typeof row["location"] === "string" && row["location"].trim()
              ? row["location"]
              : "presentation",
          description:
            typeof row["description"] === "string"
              ? row["description"]
              : sourceText
                ? `Replace "${sourceText}" with the proposed correction.`
                : "Review and apply the proposed correction.",
          assignmentId: typeof row["assignmentId"] === "string" ? row["assignmentId"] : undefined,
          suggestedText: proposedText,
        }),
        description:
          typeof row["description"] === "string"
            ? row["description"]
            : sourceText
              ? `Replace "${sourceText}" with the proposed correction.`
              : "Review and apply the proposed correction.",
        section:
          typeof row["location"] === "string" && row["location"].trim()
            ? row["location"]
            : "presentation",
        ...(typeof row["assignmentId"] === "string"
          ? { assignmentId: row["assignmentId"] }
          : {}),
        suggestedText: proposedText,
        status: "pending",
      };
    }),
  };
}
