import type { Kysely } from "kysely";

const FRAGMENT_SEEDS = [
  {
    promptKey: "external-ai.shared-guidance",
    fragments: [
      {
        key: "output_contract",
        label: "Output contract",
        content:
          "Return revision-ready text or field values only. Do not claim that changes are already applied unless a write route has actually been called.",
        sort_order: 4,
      },
    ],
  },
  {
    promptKey: "external-ai.assignment-guidance",
    fragments: [
      {
        key: "context_requirements",
        label: "Context requirements",
        content:
          "When revising an assignment, use the full assignment object as context, including role, client, dates, technologies, keywords, and current highlight state.",
        sort_order: 3,
      },
      {
        key: "output_contract",
        label: "Output contract",
        content:
          "Return the revised assignment description or the exact assignment field values that should be written through the API. Keep the result scoped to one assignment.",
        sort_order: 4,
      },
    ],
  },
  {
    promptKey: "external-ai.presentation-guidance",
    fragments: [
      {
        key: "context_requirements",
        label: "Context requirements",
        content:
          "Use the consultant title, current presentation text, summary text, and visible profile context when revising presentation-style sections.",
        sort_order: 3,
      },
      {
        key: "output_contract",
        label: "Output contract",
        content:
          "Return revised presentation-style text only, preserving paragraph intent and keeping the result suitable for direct API submission.",
        sort_order: 4,
      },
    ],
  },
] as const;

export async function up(db: Kysely<unknown>): Promise<void> {
  const typedDb = db as Kysely<any>;

  for (const seed of FRAGMENT_SEEDS) {
    const prompt = await typedDb
      .selectFrom("ai_prompt_definitions")
      .select(["id"])
      .where("key", "=", seed.promptKey)
      .executeTakeFirst();

    if (!prompt) continue;

    for (const fragment of seed.fragments) {
      const existing = await typedDb
        .selectFrom("ai_prompt_fragments")
        .select(["id"])
        .where("prompt_definition_id", "=", prompt.id)
        .where("key", "=", fragment.key)
        .executeTakeFirst();

      if (!existing) {
        await typedDb
          .insertInto("ai_prompt_fragments")
          .values({
            prompt_definition_id: prompt.id,
            key: fragment.key,
            label: fragment.label,
            content: fragment.content,
            sort_order: fragment.sort_order,
          })
          .execute();
      }
    }
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  const typedDb = db as Kysely<any>;

  for (const seed of FRAGMENT_SEEDS) {
    const prompt = await typedDb
      .selectFrom("ai_prompt_definitions")
      .select(["id"])
      .where("key", "=", seed.promptKey)
      .executeTakeFirst();

    if (!prompt) continue;

    await typedDb
      .deleteFrom("ai_prompt_fragments")
      .where("prompt_definition_id", "=", prompt.id)
      .where("key", "in", seed.fragments.map((fragment) => fragment.key))
      .execute();
  }
}
