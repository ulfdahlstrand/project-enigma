import { implement } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthContext } from "../../../auth/require-auth.js";

type ItemInput = { text: string; sortOrder?: number | undefined };

export async function setResumeHighlightedItems(
  db: Kysely<Database>,
  resumeId: string,
  items: ItemInput[]
) {
  const inserted = await db.transaction().execute(async (trx) => {
    await trx
      .deleteFrom("resume_highlighted_items")
      .where("resume_id", "=", resumeId)
      .execute();

    if (items.length === 0) return [];

    return trx
      .insertInto("resume_highlighted_items")
      .values(
        items.map((item, idx) => ({
          resume_id: resumeId,
          text: item.text,
          sort_order: item.sortOrder ?? idx,
        }))
      )
      .returningAll()
      .execute();
  });

  return {
    items: inserted.map((r) => ({
      id: r.id,
      resumeId: r.resume_id,
      text: r.text,
      sortOrder: r.sort_order,
    })),
  };
}

export const setResumeHighlightedItemsHandler = implement(
  contract.setResumeHighlightedItems
).handler(async ({ input, context }) => {
  requireAuth(context as AuthContext);
  return setResumeHighlightedItems(getDb(), input.resumeId, input.items);
});

export function createSetResumeHighlightedItemsHandler(db: Kysely<Database>) {
  return implement(contract.setResumeHighlightedItems).handler(
    async ({ input, context }) => {
      requireAuth(context as AuthContext);
      return setResumeHighlightedItems(db, input.resumeId, input.items);
    }
  );
}
