import { describe, it, expect, vi, beforeEach } from "vitest";
import { upsertUser } from "./upsert-user.js";
import type { Kysely } from "kysely";
import type { Database, User } from "../db/types.js";

// ---------------------------------------------------------------------------
// Mock Kysely db with the insert ... on conflict ... returning chain
// ---------------------------------------------------------------------------

const ENTRA_USER = {
  oid: "entra-oid-456",
  email: "bob@example.com",
  name: "Bob Example",
};

const DB_USER: User = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  azure_oid: ENTRA_USER.oid,
  email: ENTRA_USER.email,
  name: ENTRA_USER.name,
  role: "consultant",
  created_at: new Date("2026-01-01T00:00:00Z"),
};

function makeMockDb(input: {
  existingByOid?: User;
  existingByEmail?: User;
  insertedUser?: User;
  updatedUser?: User;
}): Kysely<Database> {
  const executeTakeFirst = vi
    .fn()
    .mockResolvedValueOnce(input.existingByOid)
    .mockResolvedValueOnce(input.existingByEmail);
  const where = vi.fn().mockReturnValue({ executeTakeFirst });
  const selectAll = vi.fn().mockReturnValue({ where });
  const selectFrom = vi.fn().mockReturnValue({ selectAll });

  const executeTakeFirstOrThrowUpdate = vi.fn().mockResolvedValue(input.updatedUser);
  const returningAllUpdate = vi.fn().mockReturnValue({ executeTakeFirstOrThrow: executeTakeFirstOrThrowUpdate });
  const whereUpdate = vi.fn().mockReturnValue({ returningAll: returningAllUpdate });
  const set = vi.fn().mockReturnValue({ where: whereUpdate });
  const updateTable = vi.fn().mockReturnValue({ set });

  const executeTakeFirstOrThrowInsert = vi.fn().mockResolvedValue(input.insertedUser);
  const returningAllInsert = vi.fn().mockReturnValue({ executeTakeFirstOrThrow: executeTakeFirstOrThrowInsert });
  const values = vi.fn().mockReturnValue({ returningAll: returningAllInsert });
  const insertInto = vi.fn().mockReturnValue({ values });

  return { selectFrom, updateTable, insertInto } as unknown as Kysely<Database>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("upsertUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the db user when insert succeeds", async () => {
    const db = makeMockDb({ insertedUser: DB_USER });
    const result = await upsertUser(ENTRA_USER, db);
    expect(result).toEqual(DB_USER);
  });

  it("inserts with the correct azure_oid, email, name, and default role", async () => {
    const db = makeMockDb({ insertedUser: DB_USER });
    await upsertUser(ENTRA_USER, db);

    const insertIntoMock = db.insertInto as ReturnType<typeof vi.fn>;
    expect(insertIntoMock).toHaveBeenCalledWith("users");

    const valuesMock = insertIntoMock.mock.results[0]!.value.values as ReturnType<typeof vi.fn>;
    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        azure_oid: ENTRA_USER.oid,
        email: ENTRA_USER.email,
        name: ENTRA_USER.name,
        role: "consultant",
      })
    );
  });

  it("updates an existing user matched by azure_oid", async () => {
    const db = makeMockDb({ existingByOid: DB_USER, updatedUser: DB_USER });
    const result = await upsertUser(ENTRA_USER, db);
    expect(result).toEqual(DB_USER);
    const updateTableMock = db.updateTable as ReturnType<typeof vi.fn>;
    expect(updateTableMock).toHaveBeenCalledWith("users");
  });

  it("links an existing user matched by email on first entra login", async () => {
    const migratedUser = { ...DB_USER, azure_oid: ENTRA_USER.oid };
    const db = makeMockDb({ existingByEmail: DB_USER, updatedUser: migratedUser });
    const result = await upsertUser(ENTRA_USER, db);
    expect(result.azure_oid).toBe(ENTRA_USER.oid);
  });
});
