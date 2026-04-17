import { implement } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import { createHash } from "node:crypto";
import type { z } from "zod";
import type { Kysely } from "kysely";
import type { Database, ResumeCommitContent } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthContext, type AuthUser } from "../../../auth/require-auth.js";
import { resolveEmployeeId } from "../../../auth/resolve-employee-id.js";
import { readBranchAssignmentContent } from "../lib/branch-assignment-content.js";
import type { getResumeBranchOutputSchema } from "@cv-tool/contracts";

type GetResumeBranchOutput = z.infer<typeof getResumeBranchOutputSchema>;

function buildDeterministicUuid(seed: string): string {
  const bytes = createHash("sha1").update(seed).digest().subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;

  const hex = Buffer.from(bytes).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function buildSnapshotSkills(resumeId: string, snapshotContent: ResumeCommitContent) {
  const skillGroups = snapshotContent.skillGroups.map((group, index) => ({
    id: buildDeterministicUuid(`${resumeId}:snapshot-skill-group:${index}:${group.name}`),
    resumeId,
    name: group.name,
    sortOrder: group.sortOrder,
  }));

  const groupIdByName = new Map(skillGroups.map((group) => [group.name.trim(), group.id]));

  const skills = snapshotContent.skills.map((skill, index) => ({
    id: buildDeterministicUuid(`${resumeId}:snapshot-skill:${index}:${skill.name}:${skill.category ?? ""}`),
    resumeId,
    groupId:
      groupIdByName.get(skill.category?.trim() ?? "")
      ?? skillGroups[0]?.id
      ?? buildDeterministicUuid(`${resumeId}:snapshot-skill-ungrouped:${index}`),
    name: skill.name,
    category: skill.category ?? null,
    sortOrder: skill.sortOrder,
  }));

  return { skillGroups, skills };
}

export async function getResumeBranch(
  db: Kysely<Database>,
  user: AuthUser,
  input: { resumeId: string; branchId: string },
): Promise<GetResumeBranchOutput> {
  const ownerEmployeeId = await resolveEmployeeId(db, user);

  const branchRow = await db
    .selectFrom("resume_branches as rb")
    .innerJoin("resumes as r", "r.id", "rb.resume_id")
    .leftJoin("resume_branches as main_rb", (join) =>
      join.onRef("main_rb.resume_id", "=", "r.id").on("main_rb.is_main", "=", true),
    )
    .select([
      "rb.id",
      "rb.resume_id",
      "rb.name",
      "rb.language",
      "rb.is_main",
      "rb.head_commit_id",
      "rb.forked_from_commit_id",
      "rb.branch_type",
      "rb.source_branch_id",
      "rb.source_commit_id",
      "r.employee_id",
      "r.created_at",
      "r.updated_at",
      "main_rb.id as main_branch_id",
    ])
    .where("rb.id", "=", input.branchId)
    .executeTakeFirst();

  if (!branchRow || branchRow.resume_id !== input.resumeId) {
    throw new ORPCError("NOT_FOUND");
  }

  if (ownerEmployeeId !== null && branchRow.employee_id !== ownerEmployeeId) {
    throw new ORPCError("FORBIDDEN");
  }

  const branch = await readBranchAssignmentContent(db, input.branchId);
  if (!branch || branch.resumeId !== input.resumeId) {
    throw new ORPCError("NOT_FOUND");
  }

  const snapshotSkills = buildSnapshotSkills(input.resumeId, branch.content);

  return {
    id: input.resumeId,
    employeeId: branchRow.employee_id,
    title: branch.content.title,
    consultantTitle: branch.content.consultantTitle ?? null,
    presentation: branch.content.presentation ?? [],
    summary: branch.content.summary ?? null,
    highlightedItems: branch.content.highlightedItems ?? [],
    language: branchRow.language,
    isMain: branchRow.is_main,
    createdAt: branchRow.created_at,
    updatedAt: branchRow.updated_at,
    mainBranchId: branchRow.main_branch_id ?? null,
    assignments: branch.content.assignments ?? [],
    education: branch.content.education ?? [],
    skillGroups: snapshotSkills.skillGroups,
    skills: snapshotSkills.skills,
    branchId: branchRow.id,
    branchName: branchRow.name,
    branchLanguage: branchRow.language,
    isMainBranch: branchRow.is_main,
    headCommitId: branchRow.head_commit_id,
    forkedFromCommitId: branchRow.forked_from_commit_id,
    branchType: branchRow.branch_type,
    sourceBranchId: branchRow.source_branch_id,
    sourceCommitId: branchRow.source_commit_id,
  };
}

export const getResumeBranchHandler = implement(contract.getResumeBranch).handler(
  async ({ input, context }) => {
    const user = requireAuth(context as AuthContext);
    return getResumeBranch(getDb(), user, input);
  },
);

export function createGetResumeBranchHandler(db: Kysely<Database>) {
  return implement(contract.getResumeBranch).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return getResumeBranch(db, user, input);
    },
  );
}
