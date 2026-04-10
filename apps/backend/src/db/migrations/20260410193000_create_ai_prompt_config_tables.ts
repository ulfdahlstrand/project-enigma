import { sql, type Kysely } from "kysely";

type PromptSeed = {
  categoryKey: string;
  key: string;
  title: string;
  description: string;
  sourceFile: string;
  isEditable: boolean;
  sortOrder: number;
  fragments: Array<{
    key: string;
    label: string;
    content: string;
    sortOrder: number;
  }>;
};

const PROMPT_SEEDS: PromptSeed[] = [
  {
    categoryKey: "frontend",
    key: "frontend.assignment-assistant",
    title: "Assignment assistant",
    description: "Assignment improvement assistant prompt and kickoff message.",
    sourceFile: "apps/frontend/src/components/ai-assistant/lib/build-assignment-prompt.ts",
    isEditable: true,
    sortOrder: 0,
    fragments: [
      {
        key: "system_template",
        label: "System template",
        content: [
          "You are an expert CV writer helping a consultant improve the description of an assignment.",
          "{{role_client_line}}",
          "Write in the same language as the existing description.",
          "When you have a concrete suggested improvement, wrap it in a JSON block exactly like this:",
          "```json",
          '{"type":"suggestion","content":"<the improved description text>"}',
          "```",
          "You may ask clarifying questions before suggesting changes. Be concise and professional.",
          "",
          "Current description:",
          "{{description}}",
        ].join("\n"),
        sortOrder: 0,
      },
      {
        key: "kickoff_message",
        label: "Kickoff message",
        content:
          "Greet the user naturally and briefly acknowledge what you can help them with based on the assignment context above. Be friendly and specific and mention the role and client if you know them. Do not use a generic template. Keep it to 1–2 sentences.",
        sortOrder: 1,
      },
    ],
  },
  {
    categoryKey: "frontend",
    key: "frontend.presentation-assistant",
    title: "Presentation assistant",
    description: "Presentation improvement assistant prompt and kickoff message.",
    sourceFile: "apps/frontend/src/components/ai-assistant/lib/build-presentation-prompt.ts",
    isEditable: true,
    sortOrder: 1,
    fragments: [
      {
        key: "system_template",
        label: "System template",
        content: [
          "You are an expert CV writer helping a consultant improve the presentation section of their resume.",
          "The presentation is the introductory text that appears on the cover page and should be professional, engaging, and written in third person.",
          "{{consultant_context_line}}",
          "Write in the same language as the existing text.",
          "The presentation may contain multiple paragraphs, separated by blank lines.",
          "When you have a concrete suggested improvement, wrap it in a JSON block exactly like this:",
          "```json",
          '{"type":"suggestion","content":"<the improved presentation text, use \\\\n\\\\n between paragraphs>"}',
          "```",
          "You may ask clarifying questions before suggesting changes. Be concise and professional.",
          "",
          "Current presentation:",
          "{{presentation}}",
        ].join("\n"),
        sortOrder: 0,
      },
      {
        key: "kickoff_message",
        label: "Kickoff message",
        content:
          "Greet the user naturally and briefly acknowledge what you can help them with by improving their resume presentation section. Be friendly and specific, mentioning the consultant name or title if you know them. Do not use a generic template. Keep it to 1–2 sentences.",
        sortOrder: 1,
      },
    ],
  },
  {
    categoryKey: "frontend",
    key: "frontend.unified-revision",
    title: "Unified revision assistant",
    description: "Main revision workflow prompt, kickoff, and autostart prompt.",
    sourceFile: "apps/frontend/src/components/ai-assistant/lib/build-resume-revision-prompt.ts",
    isEditable: true,
    sortOrder: 2,
    fragments: [
      {
        key: "system_template",
        label: "System template",
        content: [
          "You are helping the user revise their resume inside the resume editor.",
          "{{locale_instruction_block}}",
          "Be concise. Do not narrate your reasoning. Take the next obvious step immediately.",
          "When you send a conversational update, keep it to one short sentence.",
          "Stay in one continuous revision conversation for the whole branch session.",
          "The user may ask for several follow-up revisions in sequence. Handle each new request in the same chat.",
          "Suggestions are the main output. Let them accumulate unless the user clearly changes direction and replacing them is more helpful.",
          "You can edit any part of the resume: title, consultant title, presentation, summary, skills, and any assignment.",
          "{{branch_start_guidance}}",
          "{{branch_scope_guidance}}",
          "{{branch_followup_guidance}}",
          "If you ask that scope question, you must stop there and wait for the user's answer.",
          "Do not inspect, do not emit suggestions, and do not propose concrete text changes until the user has answered whether more changes are coming.",
          "If the user confirms that they only want this single narrow change, continue with normal inspection and suggestion generation in the current branch.",
          "If the user's first concrete request is already broad, for example spelling in the whole CV, several sections at once, or all assignments, do not ask the narrow-scope follow-up question.",
          "Instead, continue directly in the current chat and drive the broader work through explicit work items.",
        ].join("\n"),
        sortOrder: 0,
      },
      {
        key: "kickoff_message",
        label: "Kickoff message",
        content: "{{existing_branch_line}}\n{{branch_goal_line}}\n{{existing_branch_followup}}{{default_kickoff_line}}",
        sortOrder: 1,
      },
      {
        key: "auto_start_message",
        label: "Auto-start message",
        content: [
          "A dedicated revision branch has already been created for this broader effort.",
          "Current branch goal: {{branch_goal}}",
          "Continue with that goal now.",
          "Do not ask whether the user wants to keep making more changes in this branch.",
          "Inspect the necessary content and emit concrete suggestions immediately.",
        ].join("\n"),
        sortOrder: 2,
      },
    ],
  },
  {
    categoryKey: "backend",
    key: "backend.improve-description",
    title: "Improve description",
    description: "Backend assignment description improvement prompt.",
    sourceFile: "apps/backend/src/domains/ai/lib/prompts.ts",
    isEditable: true,
    sortOrder: 0,
    fragments: [
      {
        key: "system_template",
        label: "System template",
        content:
          "You are an expert CV writer specialising in IT consulting profiles. Your task is to improve assignment descriptions to be professional, concise, and achievement-focused. Write in the same language as the input. Return only the improved description text with no preamble or explanation.",
        sortOrder: 0,
      },
      {
        key: "user_template",
        label: "User template",
        content:
          "Please improve the following assignment description.{{context_section}}\n\n<description>\n{{description}}\n</description>",
        sortOrder: 1,
      },
    ],
  },
  {
    categoryKey: "backend",
    key: "backend.conversation-title",
    title: "Conversation title generator",
    description: "Backend title generation system prompt.",
    sourceFile: "apps/backend/src/domains/ai/lib/generate-title.ts",
    isEditable: true,
    sortOrder: 1,
    fragments: [
      {
        key: "system_template",
        label: "System template",
        content:
          "You summarise conversations in 2–4 words. Reply with only the summary, no punctuation.",
        sortOrder: 0,
      },
    ],
  },
];

export async function up(db: Kysely<unknown>): Promise<void> {
  const typedDb = db as Kysely<any>;

  await db.schema
    .createTable("ai_prompt_categories")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("key", "varchar(255)", (col) => col.notNull().unique())
    .addColumn("title", "varchar(255)", (col) => col.notNull())
    .addColumn("description", "text")
    .addColumn("sort_order", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createTable("ai_prompt_definitions")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("category_id", "uuid", (col) =>
      col.notNull().references("ai_prompt_categories.id").onDelete("cascade"))
    .addColumn("key", "varchar(255)", (col) => col.notNull().unique())
    .addColumn("title", "varchar(255)", (col) => col.notNull())
    .addColumn("description", "text")
    .addColumn("source_file", "text", (col) => col.notNull())
    .addColumn("is_editable", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("sort_order", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createTable("ai_prompt_fragments")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("prompt_definition_id", "uuid", (col) =>
      col.notNull().references("ai_prompt_definitions.id").onDelete("cascade"))
    .addColumn("key", "varchar(255)", (col) => col.notNull())
    .addColumn("label", "varchar(255)", (col) => col.notNull())
    .addColumn("content", "text", (col) => col.notNull())
    .addColumn("sort_order", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex("ai_prompt_fragments_definition_key_idx")
    .on("ai_prompt_fragments")
    .columns(["prompt_definition_id", "key"])
    .unique()
    .execute();

  const categories = await typedDb
    .insertInto("ai_prompt_categories")
    .values([
      {
        key: "frontend",
        title: "Frontend Prompt Builders",
        description: "Prompt builders used by the frontend before opening AI conversations.",
        sort_order: 0,
      },
      {
        key: "backend",
        title: "Backend Prompt Builders",
        description: "Prompts used directly by backend AI workflows.",
        sort_order: 1,
      },
    ])
    .returning(["id", "key"])
    .execute();

  const categoryIds = Object.fromEntries(categories.map((category) => [category.key, category.id]));

  for (const seed of PROMPT_SEEDS) {
    const prompt = await typedDb
      .insertInto("ai_prompt_definitions")
      .values({
        category_id: categoryIds[seed.categoryKey],
        key: seed.key,
        title: seed.title,
        description: seed.description,
        source_file: seed.sourceFile,
        is_editable: seed.isEditable,
        sort_order: seed.sortOrder,
      })
      .returning(["id"])
      .executeTakeFirstOrThrow();

    await typedDb
      .insertInto("ai_prompt_fragments")
      .values(
        seed.fragments.map((fragment) => ({
          prompt_definition_id: prompt.id,
          key: fragment.key,
          label: fragment.label,
          content: fragment.content,
          sort_order: fragment.sortOrder,
        })),
      )
      .execute();
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex("ai_prompt_fragments_definition_key_idx").ifExists().execute();
  await db.schema.dropTable("ai_prompt_fragments").ifExists().execute();
  await db.schema.dropTable("ai_prompt_definitions").ifExists().execute();
  await db.schema.dropTable("ai_prompt_categories").ifExists().execute();
}
