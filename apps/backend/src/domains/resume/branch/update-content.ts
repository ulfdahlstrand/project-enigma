import { implement, ORPCError } from "@orpc/server";
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
  updateResumeBranchContentInputSchema,
  updateResumeBranchContentOutputSchema,
} from "@cv-tool/contracts";

type UpdateResumeBranchContentInput = z.infer<typeof updateResumeBranchContentInputSchema>;
type UpdateResumeBranchContentOutput = z.infer<typeof updateResumeBranchContentOutputSchema>;

function normalizeHighlightedItems(input: string[]) {
  return input
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function normalizeEducation(input: UpdateResumeBranchContentInput["education"]) {
  return (input ?? []).map((entry) => ({
    type: entry.type,
    value: entry.value.trim(),
    sortOrder: entry.sortOrder,
  }));
}

export async function updateResumeBranchContent(
  db: Kysely<Database>,
  user: AuthUser,
  input: UpdateResumeBranchContentInput,
): Promise<UpdateResumeBranchContentOutput> {
  const ownerEmployeeId = await resolveEmployeeId(db, user);
  const branch = await readBranchAssignmentContent(db, input.branchId);

  if (branch === null) {
    throw new ORPCError("NOT_FOUND");
  }

  if (ownerEmployeeId !== null && branch.employeeId !== ownerEmployeeId) {
    throw new ORPCError("FORBIDDEN");
  }

  const content = await upsertBranchContentFromLive(db, {
    resumeId: branch.resumeId,
    branchId: branch.branchId,
    userId: user.id,
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.consultantTitle !== undefined ? { consultantTitle: input.consultantTitle } : {}),
    ...(input.presentation !== undefined ? { presentation: input.presentation } : {}),
    ...(input.summary !== undefined ? { summary: input.summary } : {}),
    ...(input.highlightedItems !== undefined
      ? { highlightedItems: normalizeHighlightedItems(input.highlightedItems) }
      : {}),
    ...(input.education !== undefined ? { education: normalizeEducation(input.education) } : {}),
  });

  return {
    branchId: branch.branchId,
    title: content.title,
    consultantTitle: content.consultantTitle,
    presentation: content.presentation,
    summary: content.summary,
    highlightedItems: content.highlightedItems,
    education: content.education,
  };
}

export const updateResumeBranchContentHandler = implement(contract.updateResumeBranchContent).handler(
  async ({ input, context }) => {
    const user = requireAuth(context as AuthContext);
    return updateResumeBranchContent(getDb(), user, input);
  },
);

export function createUpdateResumeBranchContentHandler(db: Kysely<Database>) {
  return implement(contract.updateResumeBranchContent).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return updateResumeBranchContent(db, user, input);
    },
  );
}
