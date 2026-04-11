import type { Kysely } from "kysely";

const EXTERNAL_AI_CATEGORY = {
  key: "external_ai",
  title: "External AI Guidance",
  description: "External-safe prompt guidance used by public AI clients through the external revision API.",
  sort_order: 2,
} as const;

const GUIDANCE_PROMPTS = [
  {
    key: "external-ai.shared-guidance",
    title: "Shared resume revision guidance",
    description: "Reusable external-safe instructions for any resume editing workflow.",
    is_editable: true,
    sort_order: 0,
    fragments: [
      {
        key: "base_prompt",
        label: "Base prompt",
        content:
          "You are an external AI assistant helping a consultant refine resume content through the public resume revision API.",
        sort_order: 0,
      },
      {
        key: "rules",
        label: "Rules",
        content: [
          "Write in the same language as the section you are revising.",
          "Stay within the user's requested scope.",
          "Keep the writing concise, factual, and CV-appropriate.",
          "Prefer concrete responsibilities, outcomes, and relevant technologies.",
        ].join("\n"),
        sort_order: 1,
      },
      {
        key: "validators",
        label: "Validators",
        content: [
          "Do not invent facts, technologies, dates, or achievements.",
          "Do not silently rewrite unrelated sections.",
          "Make sure revised text still fits the section it belongs to.",
        ].join("\n"),
        sort_order: 2,
      },
      {
        key: "workflow",
        label: "Workflow guidance",
        content: [
          "Fetch external AI context first.",
          "Read the current resume or branch state before editing.",
          "Create or reuse a branch-scoped revision flow.",
          "Apply narrow edits and create commits incrementally.",
        ].join("\n"),
        sort_order: 3,
      },
    ],
  },
  {
    key: "external-ai.assignment-guidance",
    title: "Assignment editing guidance",
    description: "External-safe instructions for revising or creating assignment entries.",
    is_editable: true,
    sort_order: 1,
    fragments: [
      {
        key: "base_prompt",
        label: "Base prompt",
        content:
          "Help improve assignment entries so they read like strong consulting CV experience while staying faithful to the source data.",
        sort_order: 0,
      },
      {
        key: "rules",
        label: "Rules",
        content: [
          "Use the full assignment object as context, not just the description field.",
          "Keep role, client, dates, and keywords coherent with the rewritten text.",
          "Highlight responsibilities, outcomes, scope, and relevant technologies when supported by the data.",
        ].join("\n"),
        sort_order: 1,
      },
      {
        key: "validators",
        label: "Validators",
        content: [
          "Do not add unsupported clients, employers, technologies, or achievements.",
          "Do not contradict the assignment title, role, or dates.",
          "Make sure the new text still sounds like one assignment, not a full-profile summary.",
        ].join("\n"),
        sort_order: 2,
      },
    ],
  },
  {
    key: "external-ai.presentation-guidance",
    title: "Presentation editing guidance",
    description: "External-safe instructions for presentation and summary style revisions.",
    is_editable: true,
    sort_order: 2,
    fragments: [
      {
        key: "base_prompt",
        label: "Base prompt",
        content:
          "Help improve presentation-style sections so they read as polished, professional consultant profile text.",
        sort_order: 0,
      },
      {
        key: "rules",
        label: "Rules",
        content: [
          "Write in the same language as the existing text.",
          "Keep the tone professional and concise.",
          "When working on the presentation section, prefer connected prose over fragmented bullet-like phrasing.",
        ].join("\n"),
        sort_order: 1,
      },
      {
        key: "validators",
        label: "Validators",
        content: [
          "Do not claim experience or strengths not supported by the resume data.",
          "Do not turn the presentation into an assignment list.",
          "Keep the text aligned with the consultant's visible profile and title.",
        ].join("\n"),
        sort_order: 2,
      },
    ],
  },
] as const;

export async function up(db: Kysely<unknown>): Promise<void> {
  const typedDb = db as Kysely<any>;

  let category = await typedDb
    .selectFrom("ai_prompt_categories")
    .select(["id"])
    .where("key", "=", EXTERNAL_AI_CATEGORY.key)
    .executeTakeFirst();

  if (!category) {
    category = await typedDb
      .insertInto("ai_prompt_categories")
      .values(EXTERNAL_AI_CATEGORY)
      .returning(["id"])
      .executeTakeFirstOrThrow();
  }

  for (const prompt of GUIDANCE_PROMPTS) {
    const existingPrompt = await typedDb
      .selectFrom("ai_prompt_definitions")
      .select(["id"])
      .where("key", "=", prompt.key)
      .executeTakeFirst();

    const promptRow = existingPrompt
      ?? await typedDb
        .insertInto("ai_prompt_definitions")
        .values({
          category_id: category.id,
          key: prompt.key,
          title: prompt.title,
          description: prompt.description,
          source_file: "external-ai-context",
          is_editable: prompt.is_editable,
          sort_order: prompt.sort_order,
        })
        .returning(["id"])
        .executeTakeFirstOrThrow();

    for (const fragment of prompt.fragments) {
      const existingFragment = await typedDb
        .selectFrom("ai_prompt_fragments")
        .select(["id"])
        .where("prompt_definition_id", "=", promptRow.id)
        .where("key", "=", fragment.key)
        .executeTakeFirst();

      if (!existingFragment) {
        await typedDb.insertInto("ai_prompt_fragments").values({
          prompt_definition_id: promptRow.id,
          key: fragment.key,
          label: fragment.label,
          content: fragment.content,
          sort_order: fragment.sort_order,
        }).execute();
      }
    }
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  const typedDb = db as Kysely<any>;

  await typedDb
    .deleteFrom("ai_prompt_definitions")
    .where("key", "in", GUIDANCE_PROMPTS.map((prompt) => prompt.key))
    .execute();

  await typedDb
    .deleteFrom("ai_prompt_categories")
    .where("key", "=", EXTERNAL_AI_CATEGORY.key)
    .execute();
}
