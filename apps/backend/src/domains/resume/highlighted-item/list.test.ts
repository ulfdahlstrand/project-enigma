import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import {
  listResumeHighlightedItems,
  createListResumeHighlightedItemsHandler,
} from "./list.js";
import { MOCK_ADMIN } from "../../../test-helpers/mock-users.js";

const RESUME_ID = "550e8400-e29b-41d4-a716-446655440021";
const ITEM_1_ID = "550e8400-e29b-41d4-a716-446655440031";
const ITEM_2_ID = "550e8400-e29b-41d4-a716-446655440032";

const ITEM_ROWS = [
  { id: ITEM_1_ID, resume_id: RESUME_ID, text: "Built APIs at Acme", sort_order: 0 },
  { id: ITEM_2_ID, resume_id: RESUME_ID, text: "Led team of 5 at Globex", sort_order: 1 },
];

function buildDbMock(opts: { rows?: unknown[] } = {}) {
  const { rows = ITEM_ROWS } = opts;

  const execute = vi.fn().mockResolvedValue(rows);
  const orderBy = vi.fn().mockReturnValue({ execute });
  const where = vi.fn().mockReturnValue({ orderBy });
  const selectAll = vi.fn().mockReturnValue({ where });
  const selectFrom = vi.fn().mockReturnValue({ selectAll });

  const db = { selectFrom } as unknown as Kysely<Database>;
  return { db, where, orderBy };
}

describe("listResumeHighlightedItems", () => {
  it("returns items ordered by sort_order", async () => {
    const { db, orderBy } = buildDbMock();

    const result = await listResumeHighlightedItems(db, RESUME_ID);

    expect(orderBy).toHaveBeenCalledWith("sort_order", "asc");
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      id: ITEM_1_ID,
      resumeId: RESUME_ID,
      text: "Built APIs at Acme",
      sortOrder: 0,
    });
    expect(result.items[1]).toMatchObject({
      id: ITEM_2_ID,
      text: "Led team of 5 at Globex",
      sortOrder: 1,
    });
  });

  it("filters by resume_id", async () => {
    const { db, where } = buildDbMock();

    await listResumeHighlightedItems(db, RESUME_ID);

    expect(where).toHaveBeenCalledWith("resume_id", "=", RESUME_ID);
  });

  it("returns empty items when none exist", async () => {
    const { db } = buildDbMock({ rows: [] });

    const result = await listResumeHighlightedItems(db, RESUME_ID);

    expect(result.items).toHaveLength(0);
  });
});

describe("createListResumeHighlightedItemsHandler", () => {
  it("calls listResumeHighlightedItems with input resumeId", async () => {
    const { db } = buildDbMock();
    const handler = createListResumeHighlightedItemsHandler(db);

    const result = await call(
      handler,
      { resumeId: RESUME_ID },
      { context: { user: MOCK_ADMIN } }
    );

    expect(result.items).toHaveLength(2);
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const { db } = buildDbMock();
    const handler = createListResumeHighlightedItemsHandler(db);

    await expect(
      call(handler, { resumeId: RESUME_ID }, { context: {} })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED"
    );
  });
});
