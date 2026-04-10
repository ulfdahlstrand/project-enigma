import { implement } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { z } from "zod";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../../../auth/require-auth.js";
import { resolveEmployeeId } from "../../../auth/resolve-employee-id.js";
import { readBranchAssignmentContent } from "../lib/branch-assignment-content.js";
import { upsertBranchContentFromLive } from "../lib/upsert-branch-content-from-live.js";
import type {
  updateResumeBranchSkillsInputSchema,
  updateResumeBranchSkillsOutputSchema,
} from "@cv-tool/contracts";

type UpdateResumeBranchSkillsInput = z.infer<typeof updateResumeBranchSkillsInputSchema>;
type UpdateResumeBranchSkillsOutput = z.infer<typeof updateResumeBranchSkillsOutputSchema>;

function normalizeSkillGroups(input: UpdateResumeBranchSkillsInput["skillGroups"]) {
  return input.map((group) => ({
    name: group.name.trim(),
    sortOrder: group.sortOrder,
  }));
}

function normalizeSkills(input: UpdateResumeBranchSkillsInput["skills"]) {
  return input.map((skill) => ({
    name: skill.name.trim(),
    category: skill.category?.trim() || null,
    sortOrder: skill.sortOrder,
  }));
}

export async function updateResumeBranchSkills(
  db: Kysely<Database>,
  user: AuthUser,
  input: UpdateResumeBranchSkillsInput,
): Promise<UpdateResumeBranchSkillsOutput> {
  const ownerEmployeeId = await resolveEmployeeId(db, user);
  const branch = await readBranchAssignmentContent(db, input.branchId);

  if (branch === null) {
    throw new ORPCError("NOT_FOUND");
  }

  if (ownerEmployeeId !== null && branch.employeeId !== ownerEmployeeId) {
    throw new ORPCError("FORBIDDEN");
  }

  const skillGroups = normalizeSkillGroups(input.skillGroups);
  const skills = normalizeSkills(input.skills);

  await upsertBranchContentFromLive(db, {
    resumeId: branch.resumeId,
    branchId: branch.branchId,
    userId: user.id,
    skillGroups,
    skills,
  });

  return {
    branchId: branch.branchId,
    skillGroups,
    skills,
  };
}

export const updateResumeBranchSkillsHandler = implement(contract.updateResumeBranchSkills).handler(
  async ({ input, context }) => {
    const user = requireAuth(context as AuthContext);
    return updateResumeBranchSkills(getDb(), user, input);
  },
);

export function createUpdateResumeBranchSkillsHandler(db: Kysely<Database>) {
  return implement(contract.updateResumeBranchSkills).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return updateResumeBranchSkills(db, user, input);
    },
  );
}
