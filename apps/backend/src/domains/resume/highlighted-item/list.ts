import { implement } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthContext } from "../../../auth/require-auth.js";

export async function listResumeHighlightedItems(db: Kysely<Database>, resumeId: string) {
  const rows = await db
    .selectFrom("resume_highlighted_items")
    .selectAll()
    .where("resume_id", "=", resumeId)
    .orderBy("sort_order", "asc")
    .execute();

  return {
    items: rows.map((r) => ({
      id: r.id,
      resumeId: r.resume_id,
      text: r.text,
      sortOrder: r.sort_order,
    })),
  };
}

export const listResumeHighlightedItemsHandler = implement(
  contract.listResumeHighlightedItems
).handler(async ({ input, context }) => {
  requireAuth(context as AuthContext);
  return listResumeHighlightedItems(getDb(), input.resumeId);
});

export function createListResumeHighlightedItemsHandler(db: Kysely<Database>) {
  return implement(contract.listResumeHighlightedItems).handler(
    async ({ input, context }) => {
      requireAuth(context as AuthContext);
      return listResumeHighlightedItems(db, input.resumeId);
    }
  );
}
