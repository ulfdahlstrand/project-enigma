import { implement, ORPCError } from "@orpc/server";
import type { Kysely } from "kysely";
import { contract } from "@cv-tool/contracts";
import type { Database } from "../../db/types.js";
import { getDb } from "../../db/client.js";
import { requireAdmin, requireAuth, type AuthContext } from "../../auth/require-auth.js";

type PromptCategoryRow = {
  categoryId: string;
  categoryKey: string;
  categoryTitle: string;
  categoryDescription: string | null;
  categorySortOrder: number;
  promptId: string;
  promptKey: string;
  promptTitle: string;
  promptDescription: string | null;
  sourceFile: string;
  isEditable: boolean;
  promptSortOrder: number;
  fragmentId: string;
  fragmentKey: string;
  fragmentLabel: string;
  fragmentContent: string;
  fragmentSortOrder: number;
};

function mapPromptRows(rows: PromptCategoryRow[]) {
  const categories = new Map<string, {
    id: string;
    key: string;
    title: string;
    description: string | null;
    sortOrder: number;
    prompts: Array<{
      id: string;
      key: string;
      title: string;
      description: string | null;
      sourceFile: string;
      isEditable: boolean;
      sortOrder: number;
      fragments: Array<{
        id: string;
        key: string;
        label: string;
        content: string;
        sortOrder: number;
      }>;
    }>;
  }>();

  const prompts = new Map<string, {
    id: string;
    key: string;
    title: string;
    description: string | null;
    sourceFile: string;
    isEditable: boolean;
    sortOrder: number;
    fragments: Array<{
      id: string;
      key: string;
      label: string;
      content: string;
      sortOrder: number;
    }>;
  }>();

  for (const row of rows) {
    let category = categories.get(row.categoryId);
    if (!category) {
      category = {
        id: row.categoryId,
        key: row.categoryKey,
        title: row.categoryTitle,
        description: row.categoryDescription,
        sortOrder: row.categorySortOrder,
        prompts: [],
      };
      categories.set(row.categoryId, category);
    }

    let prompt = prompts.get(row.promptId);
    if (!prompt) {
      prompt = {
        id: row.promptId,
        key: row.promptKey,
        title: row.promptTitle,
        description: row.promptDescription,
        sourceFile: row.sourceFile,
        isEditable: row.isEditable,
        sortOrder: row.promptSortOrder,
        fragments: [],
      };
      prompts.set(row.promptId, prompt);
      category.prompts.push(prompt);
    }

    prompt.fragments.push({
      id: row.fragmentId,
      key: row.fragmentKey,
      label: row.fragmentLabel,
      content: row.fragmentContent,
      sortOrder: row.fragmentSortOrder,
    });
  }

  return {
    categories: Array.from(categories.values()).sort((a, b) => a.sortOrder - b.sortOrder).map((category) => ({
      ...category,
      prompts: category.prompts
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((prompt) => ({
          ...prompt,
          fragments: prompt.fragments.sort((a, b) => a.sortOrder - b.sortOrder),
        })),
    })),
  };
}

export async function listAIPromptConfigs(db: Kysely<Database>) {
  const rows = await db
    .selectFrom("ai_prompt_categories as c")
    .innerJoin("ai_prompt_definitions as d", "d.category_id", "c.id")
    .innerJoin("ai_prompt_fragments as f", "f.prompt_definition_id", "d.id")
    .select([
      "c.id as categoryId",
      "c.key as categoryKey",
      "c.title as categoryTitle",
      "c.description as categoryDescription",
      "c.sort_order as categorySortOrder",
      "d.id as promptId",
      "d.key as promptKey",
      "d.title as promptTitle",
      "d.description as promptDescription",
      "d.source_file as sourceFile",
      "d.is_editable as isEditable",
      "d.sort_order as promptSortOrder",
      "f.id as fragmentId",
      "f.key as fragmentKey",
      "f.label as fragmentLabel",
      "f.content as fragmentContent",
      "f.sort_order as fragmentSortOrder",
    ])
    .orderBy("c.sort_order")
    .orderBy("d.sort_order")
    .orderBy("f.sort_order")
    .execute() as PromptCategoryRow[];

  return mapPromptRows(rows);
}

export async function getAIPromptFragmentsByKey(
  db: Kysely<Database>,
  promptKey: string,
): Promise<Record<string, string>> {
  const rows = await db
    .selectFrom("ai_prompt_fragments as f")
    .innerJoin("ai_prompt_definitions as d", "d.id", "f.prompt_definition_id")
    .select(["f.key", "f.content"])
    .where("d.key", "=", promptKey)
    .orderBy("f.sort_order")
    .execute();

  return Object.fromEntries(rows.map((row) => [row.key, row.content]));
}

export async function listAIPromptFragmentsByKeys(
  db: Kysely<Database>,
  promptKeys: string[],
): Promise<Record<string, Array<{ key: string; label: string; content: string; sortOrder: number }>>> {
  if (promptKeys.length === 0) return {};

  const rows = await db
    .selectFrom("ai_prompt_fragments as f")
    .innerJoin("ai_prompt_definitions as d", "d.id", "f.prompt_definition_id")
    .select([
      "d.key as promptKey",
      "f.key as key",
      "f.label as label",
      "f.content as content",
      "f.sort_order as sortOrder",
    ])
    .where("d.key", "in", promptKeys)
    .orderBy("d.sort_order")
    .orderBy("f.sort_order")
    .execute();

  const grouped = new Map<string, Array<{ key: string; label: string; content: string; sortOrder: number }>>();
  for (const row of rows) {
    const fragments = grouped.get(row.promptKey) ?? [];
    fragments.push({
      key: row.key,
      label: row.label,
      content: row.content,
      sortOrder: row.sortOrder,
    });
    grouped.set(row.promptKey, fragments);
  }

  return Object.fromEntries(Array.from(grouped.entries()));
}

export async function updateAIPromptFragment(
  db: Kysely<Database>,
  input: { fragmentId: string; content: string },
) {
  const existing = await db
    .selectFrom("ai_prompt_fragments as f")
    .innerJoin("ai_prompt_definitions as d", "d.id", "f.prompt_definition_id")
    .select([
      "f.id as id",
      "f.key as key",
      "f.label as label",
      "f.sort_order as sortOrder",
      "d.is_editable as isEditable",
    ])
    .where("f.id", "=", input.fragmentId)
    .executeTakeFirst();

  if (!existing) {
    throw new ORPCError("NOT_FOUND", { message: "Prompt fragment not found" });
  }

  if (!existing.isEditable) {
    throw new ORPCError("FORBIDDEN", { message: "Prompt is not editable" });
  }

  await db
    .updateTable("ai_prompt_fragments")
    .set({
      content: input.content,
      updated_at: new Date(),
    })
    .where("id", "=", input.fragmentId)
    .execute();

  return {
    fragment: {
      id: existing.id,
      key: existing.key,
      label: existing.label,
      content: input.content,
      sortOrder: existing.sortOrder,
    },
  };
}

export const listAIPromptConfigsHandler = implement(contract.listAIPromptConfigs).handler(
  async ({ context }) => {
    requireAuth(context as AuthContext);
    return listAIPromptConfigs(getDb());
  },
);

export const updateAIPromptFragmentHandler = implement(contract.updateAIPromptFragment).handler(
  async ({ input, context }) => {
    requireAdmin(context as AuthContext);
    return updateAIPromptFragment(getDb(), input);
  },
);
