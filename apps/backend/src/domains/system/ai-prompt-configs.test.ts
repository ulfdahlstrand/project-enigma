import { describe, expect, it, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../db/types.js";
import {
  getAIPromptFragmentsByKey,
  listAIPromptFragmentsByKeys,
  listAIPromptConfigs,
  updateAIPromptFragment,
} from "./ai-prompt-configs.js";

function buildListDb(rows: unknown[]) {
  const execute = vi.fn().mockResolvedValue(rows);
  const orderBy3 = vi.fn().mockReturnValue({ execute });
  const orderBy2 = vi.fn().mockReturnValue({ orderBy: orderBy3 });
  const orderBy1 = vi.fn().mockReturnValue({ orderBy: orderBy2 });
  const select = vi.fn().mockReturnValue({ orderBy: orderBy1 });
  const innerJoin2 = vi.fn().mockReturnValue({ select });
  const innerJoin1 = vi.fn().mockReturnValue({ innerJoin: innerJoin2 });
  const selectFrom = vi.fn().mockReturnValue({ innerJoin: innerJoin1 });
  return { selectFrom } as unknown as Kysely<Database>;
}

function buildFragmentLookupDb(rows: unknown[]) {
  const execute = vi.fn().mockResolvedValue(rows);
  const orderBy = vi.fn().mockReturnValue({ execute });
  const where = vi.fn().mockReturnValue({ orderBy });
  const select = vi.fn().mockReturnValue({ where });
  const innerJoin = vi.fn().mockReturnValue({ select });
  const selectFrom = vi.fn().mockReturnValue({ innerJoin });
  return { selectFrom } as unknown as Kysely<Database>;
}

function buildFragmentLookupByKeysDb(rows: unknown[]) {
  const execute = vi.fn().mockResolvedValue(rows);
  const orderBy2 = vi.fn().mockReturnValue({ execute });
  const orderBy1 = vi.fn().mockReturnValue({ orderBy: orderBy2 });
  const where = vi.fn().mockReturnValue({ orderBy: orderBy1 });
  const select = vi.fn().mockReturnValue({ where });
  const innerJoin = vi.fn().mockReturnValue({ select });
  const selectFrom = vi.fn().mockReturnValue({ innerJoin });
  return { selectFrom } as unknown as Kysely<Database>;
}

function buildUpdateDb(existing: unknown) {
  const executeUpdate = vi.fn().mockResolvedValue(undefined);
  const whereUpdate = vi.fn().mockReturnValue({ execute: executeUpdate });
  const set = vi.fn().mockReturnValue({ where: whereUpdate });
  const updateTable = vi.fn().mockReturnValue({ set });

  const executeTakeFirst = vi.fn().mockResolvedValue(existing);
  const whereSelect = vi.fn().mockReturnValue({ executeTakeFirst });
  const select = vi.fn().mockReturnValue({ where: whereSelect });
  const innerJoin = vi.fn().mockReturnValue({ select });
  const selectFrom = vi.fn().mockReturnValue({ innerJoin });

  return { selectFrom, updateTable } as unknown as Kysely<Database>;
}

describe("listAIPromptConfigs", () => {
  it("groups rows into nested categories, prompts, and fragments", async () => {
    const db = buildListDb([
      {
        categoryId: "cat-1",
        categoryKey: "frontend",
        categoryTitle: "Frontend",
        categoryDescription: "Frontend prompts",
        categorySortOrder: 0,
        promptId: "prompt-1",
        promptKey: "frontend.assignment-assistant",
        promptTitle: "Assignment assistant",
        promptDescription: "desc",
        sourceFile: "apps/frontend/src/components/ai-assistant/lib/build-assignment-prompt.ts",
        isEditable: true,
        promptSortOrder: 0,
        fragmentId: "fragment-1",
        fragmentKey: "system_template",
        fragmentLabel: "System template",
        fragmentContent: "Hello {{description}}",
        fragmentSortOrder: 0,
        noop: 0,
      },
      {
        categoryId: "cat-1",
        categoryKey: "frontend",
        categoryTitle: "Frontend",
        categoryDescription: "Frontend prompts",
        categorySortOrder: 0,
        promptId: "prompt-1",
        promptKey: "frontend.assignment-assistant",
        promptTitle: "Assignment assistant",
        promptDescription: "desc",
        sourceFile: "apps/frontend/src/components/ai-assistant/lib/build-assignment-prompt.ts",
        isEditable: true,
        promptSortOrder: 0,
        fragmentId: "fragment-2",
        fragmentKey: "kickoff_message",
        fragmentLabel: "Kickoff message",
        fragmentContent: "Hi there",
        fragmentSortOrder: 1,
        noop: 0,
      },
    ]);

    const result = await listAIPromptConfigs(db);

    expect(result.categories).toHaveLength(1);
    expect(result.categories[0]?.prompts).toHaveLength(1);
    expect(result.categories[0]?.prompts[0]?.fragments).toHaveLength(2);
    expect(result.categories[0]?.prompts[0]?.isEditable).toBe(true);
  });
});

describe("getAIPromptFragmentsByKey", () => {
  it("returns a key-value map of fragments for one prompt", async () => {
    const db = buildFragmentLookupDb([
      { key: "system_template", content: "System" },
      { key: "kickoff_message", content: "Kickoff" },
    ]);

    await expect(getAIPromptFragmentsByKey(db, "frontend.assignment-assistant")).resolves.toEqual({
      system_template: "System",
      kickoff_message: "Kickoff",
    });
  });
});

describe("listAIPromptFragmentsByKeys", () => {
  it("groups fragments by prompt key", async () => {
    const db = buildFragmentLookupByKeysDb([
      {
        promptKey: "external-ai.shared-guidance",
        key: "base_prompt",
        label: "Base prompt",
        content: "Shared prompt",
        sortOrder: 0,
      },
      {
        promptKey: "external-ai.assignment-guidance",
        key: "rules",
        label: "Rules",
        content: "Assignment rules",
        sortOrder: 1,
      },
    ]);

    await expect(
      listAIPromptFragmentsByKeys(db, [
        "external-ai.shared-guidance",
        "external-ai.assignment-guidance",
      ]),
    ).resolves.toEqual({
      "external-ai.shared-guidance": [
        { key: "base_prompt", label: "Base prompt", content: "Shared prompt", sortOrder: 0 },
      ],
      "external-ai.assignment-guidance": [
        { key: "rules", label: "Rules", content: "Assignment rules", sortOrder: 1 },
      ],
    });
  });
});

describe("updateAIPromptFragment", () => {
  it("updates editable fragments", async () => {
    const db = buildUpdateDb({
      id: "fragment-1",
      key: "system_template",
      label: "System template",
      sortOrder: 0,
      isEditable: true,
    });

    await expect(
      updateAIPromptFragment(db, { fragmentId: "fragment-1", content: "Updated" }),
    ).resolves.toEqual({
      fragment: {
        id: "fragment-1",
        key: "system_template",
        label: "System template",
        content: "Updated",
        sortOrder: 0,
      },
    });
  });

  it("rejects updates for non-editable prompts", async () => {
    const db = buildUpdateDb({
      id: "fragment-1",
      key: "system_template",
      label: "System template",
      sortOrder: 0,
      isEditable: false,
    });

    await expect(
      updateAIPromptFragment(db, { fragmentId: "fragment-1", content: "Updated" }),
    ).rejects.toSatisfy(
      (error: unknown) => error instanceof ORPCError && error.code === "FORBIDDEN",
    );
  });
});
