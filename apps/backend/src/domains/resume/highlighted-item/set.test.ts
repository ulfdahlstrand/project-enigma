import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import {
  setResumeHighlightedItems,
  createSetResumeHighlightedItemsHandler,
} from "./set.js";
import { MOCK_ADMIN } from "../../../test-helpers/mock-users.js";

const RESUME_ID = "550e8400-e29b-41d4-a716-446655440021";
const ITEM_1_ID = "550e8400-e29b-41d4-a716-446655440031";
const ITEM_2_ID = "550e8400-e29b-41d4-a716-446655440032";

const INPUT_ITEMS = [
  { text: "Built APIs at Acme", sortOrder: 0 },
  { text: "Led team of 5 at Globex", sortOrder: 1 },
];

const INSERTED_ROWS = [
  { id: ITEM_1_ID, resume_id: RESUME_ID, text: "Built APIs at Acme", sort_order: 0 },
  { id: ITEM_2_ID, resume_id: RESUME_ID, text: "Led team of 5 at Globex", sort_order: 1 },
];

function buildDbMock(opts: { insertedRows?: unknown[] } = {}) {
  const { insertedRows = INSERTED_ROWS } = opts;

  // DELETE query
  const deleteExecute = vi.fn().mockResolvedValue(undefined);
  const deleteWhere = vi.fn().mockReturnValue({ execute: deleteExecute });
  const deleteFrom = vi.fn().mockReturnValue({ where: deleteWhere });

  // INSERT query
  const insertExecute = vi.fn().mockResolvedValue(insertedRows);
  const insertReturningAll = vi.fn().mockReturnValue({ execute: insertExecute });
  const insertValues = vi.fn().mockReturnValue({ returningAll: insertReturningAll });
  const insertInto = vi.fn().mockReturnValue({ values: insertValues });

  const transaction = vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockImplementation(async (fn: (trx: unknown) => Promise<unknown>) => {
      const trx = { deleteFrom, insertInto };
      return fn(trx);
    }),
  }));

  const db = { transaction } as unknown as Kysely<Database>;
  return { db, deleteFrom, deleteWhere, insertValues, insertExecute };
}

describe("setResumeHighlightedItems", () => {
  it("deletes existing items then inserts new ones in a transaction", async () => {
    const { db, deleteWhere, insertValues } = buildDbMock();

    await setResumeHighlightedItems(db, RESUME_ID, INPUT_ITEMS);

    expect(deleteWhere).toHaveBeenCalledWith("resume_id", "=", RESUME_ID);
    expect(insertValues).toHaveBeenCalledWith([
      { resume_id: RESUME_ID, text: "Built APIs at Acme", sort_order: 0 },
      { resume_id: RESUME_ID, text: "Led team of 5 at Globex", sort_order: 1 },
    ]);
  });

  it("returns the inserted items mapped to camelCase", async () => {
    const { db } = buildDbMock();

    const result = await setResumeHighlightedItems(db, RESUME_ID, INPUT_ITEMS);

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      id: ITEM_1_ID,
      resumeId: RESUME_ID,
      text: "Built APIs at Acme",
      sortOrder: 0,
    });
  });

  it("defaults sortOrder to the array index when not provided", async () => {
    const { db, insertValues } = buildDbMock({
      insertedRows: [
        { id: ITEM_1_ID, resume_id: RESUME_ID, text: "Item A", sort_order: 0 },
      ],
    });

    await setResumeHighlightedItems(db, RESUME_ID, [{ text: "Item A" }]);

    expect(insertValues).toHaveBeenCalledWith([
      { resume_id: RESUME_ID, text: "Item A", sort_order: 0 },
    ]);
  });

  it("handles empty items list — deletes all and inserts nothing", async () => {
    const { db, deleteWhere, insertValues } = buildDbMock({ insertedRows: [] });

    const result = await setResumeHighlightedItems(db, RESUME_ID, []);

    expect(deleteWhere).toHaveBeenCalledWith("resume_id", "=", RESUME_ID);
    expect(insertValues).not.toHaveBeenCalled();
    expect(result.items).toHaveLength(0);
  });
});

describe("createSetResumeHighlightedItemsHandler", () => {
  it("calls setResumeHighlightedItems and returns items", async () => {
    const { db } = buildDbMock();
    const handler = createSetResumeHighlightedItemsHandler(db);

    const result = await call(
      handler,
      { resumeId: RESUME_ID, items: INPUT_ITEMS },
      { context: { user: MOCK_ADMIN } }
    );

    expect(result.items).toHaveLength(2);
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const { db } = buildDbMock();
    const handler = createSetResumeHighlightedItemsHandler(db);

    await expect(
      call(handler, { resumeId: RESUME_ID, items: [] }, { context: {} })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED"
    );
  });
});
