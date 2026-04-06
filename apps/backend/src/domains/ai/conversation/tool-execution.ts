import type { Kysely } from "kysely";
import type { Database, ResumeCommitContent } from "../../../db/types.js";
import { logger } from "../../../infra/logger.js";
import { withSpan } from "../../../infra/tracing.js";
import type { ToolCallPayload } from "./tool-parsing.js";
import { listPersistedRevisionWorkItems } from "./revision-work-items.js";

// ---------------------------------------------------------------------------
// Backend-executable inspect tools
//
// These tools only READ resume data from the database. They can be executed
// inside sendAIMessage without a round-trip to the browser, removing the
// need for the frontend to detect tool calls and send back results for each
// inspect step.
//
// Write tools (set_revision_work_items, set_assignment_suggestions, etc.)
// still require frontend execution and are NOT in this set.
// ---------------------------------------------------------------------------

export const BACKEND_INSPECT_TOOLS = new Set([
  "inspect_resume",
  "inspect_resume_sections",
  "inspect_resume_section",
  "inspect_resume_skills",
  "list_revision_work_items",
  "list_resume_assignments",
  "inspect_assignment",
]);

// ---------------------------------------------------------------------------
// Internal snapshot type
// ---------------------------------------------------------------------------

interface ResumeSnapshot {
  resumeId: string;
  branchId: string;
  employeeName: string;
  title: string;
  consultantTitle: string | null;
  language: string;
  presentation: string[];
  summary: string | null;
  skills: ResumeCommitContent["skills"];
  assignments: Array<{
    id: string;
    clientName: string;
    role: string;
    description: string;
    technologies: string[];
    isCurrent: boolean;
    startDate: string | null;
    endDate: string | null;
  }>;
}

// ---------------------------------------------------------------------------
// DB query helpers
// ---------------------------------------------------------------------------

async function buildResumeSnapshotFromBranch(
  db: Kysely<Database>,
  branchId: string,
): Promise<ResumeSnapshot | null> {
  const branch = await db
    .selectFrom("resume_branches as rb")
    .innerJoin("resumes as r", "r.id", "rb.resume_id")
    .innerJoin("employees as e", "e.id", "r.employee_id")
    .select([
      "rb.id as branchId",
      "rb.head_commit_id",
      "rb.forked_from_commit_id",
      "r.id as resumeId",
      "e.name as employeeName",
    ])
    .where("rb.id", "=", branchId)
    .executeTakeFirst();

  if (!branch) return null;

  let content: ResumeCommitContent | null = null;
  const snapshotCommitId = branch.head_commit_id ?? branch.forked_from_commit_id;
  if (snapshotCommitId) {
    const commit = await db
      .selectFrom("resume_commits")
      .select("content")
      .where("id", "=", snapshotCommitId)
      .executeTakeFirst();
    content = commit?.content ?? null;
  }

  const rawAssignments = await db
    .selectFrom("branch_assignments as ba")
    .innerJoin("assignments as a", "a.id", "ba.assignment_id")
    .selectAll("ba")
    .where("ba.branch_id", "=", branchId)
    .where("a.deleted_at", "is", null)
    .orderBy("ba.sort_order", "asc")
    .execute();

  return {
    resumeId: branch.resumeId,
    branchId,
    employeeName: branch.employeeName,
    title: content?.title ?? "",
    consultantTitle: content?.consultantTitle ?? null,
    language: content?.language ?? "en",
    presentation: content?.presentation ?? [],
    summary: content?.summary ?? null,
    skills: content?.skills ?? [],
    assignments: rawAssignments.map((a) => ({
      id: a.assignment_id,
      clientName: a.client_name,
      role: a.role,
      description: a.description,
      technologies: a.technologies,
      isCurrent: a.is_current,
      startDate: a.start_date ? a.start_date.toISOString().slice(0, 10) : null,
      endDate: a.end_date ? a.end_date.toISOString().slice(0, 10) : null,
    })),
  };
}

// ---------------------------------------------------------------------------
// Output builders (ported from frontend resume-tool-schemas / resume-action-tools)
// ---------------------------------------------------------------------------

function excerpt(text: string, maxLength = 280): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  return trimmed.length <= maxLength ? trimmed : `${trimmed.slice(0, maxLength)}…`;
}

function groupSkills(skills: ResumeCommitContent["skills"]) {
  const grouped = skills.reduce<
    Record<string, { names: string[]; sortOrders: number[] }>
  >((acc, skill) => {
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

  return Object.entries(grouped)
    .map(([category, value]) => ({
      category,
      names: value.names.slice(0, 12),
      total: value.names.length,
      minSortOrder: Math.min(...value.sortOrders),
    }))
    .sort((a, b) => a.minSortOrder - b.minSortOrder);
}

function buildInspectResumeOutput(snapshot: ResumeSnapshot, includeAssignments: boolean) {
  const groupedSkills = groupSkills(snapshot.skills);
  const compactAssignments = snapshot.assignments.slice(0, 8).map((a) => ({
    id: a.id,
    clientName: a.clientName,
    role: a.role,
    period: a.isCurrent
      ? `${a.startDate ?? "?"} - present`
      : `${a.startDate ?? "?"} - ${a.endDate ?? "?"}`,
    technologies: a.technologies.slice(0, 8),
    descriptionExcerpt: excerpt(a.description),
  }));
  return {
    resumeId: snapshot.resumeId,
    employeeName: snapshot.employeeName,
    title: snapshot.title,
    consultantTitle: snapshot.consultantTitle,
    language: snapshot.language,
    presentation: snapshot.presentation.map((p) => excerpt(p, 320)),
    summary: snapshot.summary ? excerpt(snapshot.summary, 240) : null,
    skillGroups: groupedSkills,
    assignmentCount: snapshot.assignments.length,
    assignments: includeAssignments ? compactAssignments : [],
  };
}

function buildInspectResumeSectionsOutput(snapshot: ResumeSnapshot, includeAssignments: boolean) {
  return {
    title: snapshot.title,
    consultantTitle: snapshot.consultantTitle ?? "",
    presentation: snapshot.presentation.join("\n\n"),
    summary: snapshot.summary ?? "",
    assignments: includeAssignments
      ? snapshot.assignments.map((a) => ({
          assignmentId: a.id,
          clientName: a.clientName,
          role: a.role,
          text: a.description,
        }))
      : [],
  };
}

function buildInspectResumeSectionOutput(
  snapshot: ResumeSnapshot,
  section: string,
  assignmentId?: string,
): { ok: boolean; output?: unknown; error?: string } {
  if (section === "title") return { ok: true, output: { section, text: snapshot.title } };
  if (section === "consultantTitle") return { ok: true, output: { section, text: snapshot.consultantTitle ?? "" } };
  if (section === "presentation") {
    return {
      ok: true,
      output: {
        section,
        paragraphs: snapshot.presentation,
        text: snapshot.presentation.join("\n\n"),
      },
    };
  }
  if (section === "summary") return { ok: true, output: { section, text: snapshot.summary ?? "" } };

  const assignment = snapshot.assignments.find((a) => a.id === assignmentId);
  if (!assignment) {
    return { ok: false, error: `Assignment not found for inspect_resume_section: ${assignmentId ?? "(none)"}` };
  }
  return {
    ok: true,
    output: {
      section,
      assignmentId: assignment.id,
      clientName: assignment.clientName,
      role: assignment.role,
      text: assignment.description,
    },
  };
}

function buildInspectResumeSkillsOutput(snapshot: ResumeSnapshot) {
  const orderedSkills = [...snapshot.skills].sort((a, b) => a.sortOrder - b.sortOrder);
  type SkillGroup = { category: string; skills: string[]; skillCount: number; firstSortOrder: number };
  const groups = orderedSkills.reduce<SkillGroup[]>((acc, skill) => {
    const category = skill.category?.trim() || "Other";
    const existing = acc.find((g) => g.category === category);
    if (existing) {
      existing.skills.push(skill.name);
      existing.skillCount += 1;
      return acc;
    }
    return [...acc, { category, skills: [skill.name], skillCount: 1, firstSortOrder: skill.sortOrder }];
  }, []);
  return {
    totalSkills: orderedSkills.length,
    groups: groups.map((g, index) => ({
      category: g.category,
      groupOrder: index,
      skills: g.skills,
      skillCount: g.skillCount,
    })),
  };
}

function buildListResumeAssignmentsOutput(snapshot: ResumeSnapshot) {
  return {
    totalAssignments: snapshot.assignments.length,
    assignments: snapshot.assignments.map((a, index) => ({
      index,
      assignmentId: a.id,
      clientName: a.clientName,
      role: a.role,
    })),
  };
}

async function buildListRevisionWorkItemsOutput(
  db: Kysely<Database>,
  conversationId: string,
) {
  const workItems = await listPersistedRevisionWorkItems(db, conversationId);

  return {
    totalWorkItems: workItems.length,
    remainingWorkItems: workItems.filter((item) =>
      item.status === "pending" || item.status === "in_progress" || item.status === "blocked" || item.status === "failed"
    ).length,
    items: workItems.map((item) => ({
      id: item.work_item_id,
      title: item.title,
      description: item.description,
      section: item.section,
      assignmentId: item.assignment_id,
      status: item.status,
      note: item.note,
      attemptCount: item.attempt_count,
      lastError: item.last_error,
      position: item.position,
      completedAt: item.completed_at?.toISOString() ?? null,
      updatedAt: item.updated_at.toISOString(),
    })),
  };
}

function buildInspectAssignmentOutput(
  snapshot: ResumeSnapshot,
  assignmentId: string,
): { ok: boolean; output?: unknown; error?: string } {
  const assignment = snapshot.assignments.find((a) => a.id === assignmentId);
  if (!assignment) {
    return { ok: false, error: `Assignment not found for inspect_assignment: ${assignmentId}` };
  }
  return {
    ok: true,
    output: {
      assignmentId: assignment.id,
      clientName: assignment.clientName,
      role: assignment.role,
      text: assignment.description,
    },
  };
}

// ---------------------------------------------------------------------------
// Public executor
// ---------------------------------------------------------------------------

export async function executeBackendInspectTool(
  db: Kysely<Database>,
  entityType: string,
  entityId: string,
  toolCall: ToolCallPayload,
  options?: { conversationId?: string },
): Promise<{ ok: boolean; output?: unknown; error?: string }> {
  return withSpan("ai.revision.execute_backend_inspect_tool", {
    "ai.tool.name": toolCall.toolName,
    "ai.entity_type": entityType,
    "ai.branch.id": entityId,
    ...(options?.conversationId ? { "ai.conversation.id": options.conversationId } : {}),
  }, async () => {
  if (entityType !== "resume-revision-actions") {
    return {
      ok: false,
      error: `Backend inspect tools not supported for entity type: ${entityType}`,
    };
  }

  const snapshot = await buildResumeSnapshotFromBranch(db, entityId);
  if (!snapshot) {
    return { ok: false, error: `Branch not found: ${entityId}` };
  }

  const input = (toolCall.input ?? {}) as Record<string, unknown>;
  logger.debug("Backend inspect tool executing", { toolName: toolCall.toolName, entityId });

  switch (toolCall.toolName) {
    case "inspect_resume":
      return {
        ok: true,
        output: buildInspectResumeOutput(snapshot, (input["includeAssignments"] as boolean | undefined) ?? true),
      };

    case "inspect_resume_sections":
      return {
        ok: true,
        output: buildInspectResumeSectionsOutput(snapshot, (input["includeAssignments"] as boolean | undefined) ?? true),
      };

    case "inspect_resume_section":
      return buildInspectResumeSectionOutput(
        snapshot,
        (input["section"] as string | undefined) ?? "",
        input["assignmentId"] as string | undefined,
      );

    case "inspect_resume_skills":
      return { ok: true, output: buildInspectResumeSkillsOutput(snapshot) };

    case "list_revision_work_items":
      if (!options?.conversationId) {
        return { ok: false, error: "Conversation id is required for list_revision_work_items" };
      }
      return {
        ok: true,
        output: await buildListRevisionWorkItemsOutput(db, options.conversationId),
      };

    case "list_resume_assignments":
      return { ok: true, output: buildListResumeAssignmentsOutput(snapshot) };

    case "inspect_assignment":
      return buildInspectAssignmentOutput(snapshot, (input["assignmentId"] as string | undefined) ?? "");

    default:
      return { ok: false, error: `Unknown inspect tool: ${toolCall.toolName}` };
  }
  });
}
