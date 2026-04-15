import type { Kysely } from "kysely";

const SHARED_GUIDANCE_KEY = "external-ai.shared-guidance";

const BRANCH_TYPE_FRAGMENT = {
  key: "context_requirements",
  label: "Branch type context",
  content: [
    "Branches have three types:",
    "- variant: the long-lived base branch for a version of the resume.",
    "- translation: a language copy of a variant, identified by its language field and sourceBranchId pointing to the parent variant. An isStale flag of true means the source variant has new commits not yet reflected here.",
    "- revision: a short-lived working copy forked from a specific commit, identified by sourceBranchId and sourceCommitId. Use this for exploratory or isolated edits.",
    "When making edits, prefer a variant branch or create a revision from it. For language-specific work, choose the matching translation branch. Alert the user before editing a stale translation (isStale: true).",
  ].join("\n"),
  sort_order: 4,
} as const;

export async function up(db: Kysely<unknown>): Promise<void> {
  const typedDb = db as Kysely<any>;

  const promptRow = await typedDb
    .selectFrom("ai_prompt_definitions")
    .select(["id"])
    .where("key", "=", SHARED_GUIDANCE_KEY)
    .executeTakeFirst();

  if (!promptRow) return;

  const existingFragment = await typedDb
    .selectFrom("ai_prompt_fragments")
    .select(["id"])
    .where("prompt_definition_id", "=", promptRow.id)
    .where("key", "=", BRANCH_TYPE_FRAGMENT.key)
    .executeTakeFirst();

  if (!existingFragment) {
    await typedDb.insertInto("ai_prompt_fragments").values({
      prompt_definition_id: promptRow.id,
      key: BRANCH_TYPE_FRAGMENT.key,
      label: BRANCH_TYPE_FRAGMENT.label,
      content: BRANCH_TYPE_FRAGMENT.content,
      sort_order: BRANCH_TYPE_FRAGMENT.sort_order,
    }).execute();
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  const typedDb = db as Kysely<any>;

  const promptRow = await typedDb
    .selectFrom("ai_prompt_definitions")
    .select(["id"])
    .where("key", "=", SHARED_GUIDANCE_KEY)
    .executeTakeFirst();

  if (!promptRow) return;

  await typedDb
    .deleteFrom("ai_prompt_fragments")
    .where("prompt_definition_id", "=", promptRow.id)
    .where("key", "=", BRANCH_TYPE_FRAGMENT.key)
    .execute();
}
