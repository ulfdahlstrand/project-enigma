import { describe, it, expect, vi, beforeEach } from "vitest";
import { upsertUser } from "./upsert-user.js";
import type { Kysely } from "kysely";
import type { Database, User } from "../db/types.js";

// ---------------------------------------------------------------------------
// Mock Kysely db with the insert ... on conflict ... returning chain
// ---------------------------------------------------------------------------

const GOOGLE_USER = {
  sub: "google-sub-456",
  email: "bob@example.com",
  name: "Bob Example",
};

const DB_USER: User = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  google_sub: GOOGLE_USER.sub,
  email: GOOGLE_USER.email,
  name: GOOGLE_USER.name,
  role: "consultant",
  created_at: new Date("2026-01-01T00:00:00Z"),
};

function makeMockDb(returnedUser: User | undefined): Kysely<Database> {
  const executeTakeFirstOrThrow = vi.fn().mockResolvedValue(returnedUser);
  const returning = vi.fn().mockReturnValue({ executeTakeFirstOrThrow });
  // onConflict receives a builder callback; the callback result is ignored in
  // the mock — we just return the next step in the chain ({ returning }).
  const onConflict = vi.fn().mockReturnValue({ returning });
  const values = vi.fn().mockReturnValue({ onConflict });
  const insertInto = vi.fn().mockReturnValue({ values });

  return { insertInto } as unknown as Kysely<Database>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("upsertUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the db user when insert succeeds", async () => {
    const db = makeMockDb(DB_USER);
    const result = await upsertUser(GOOGLE_USER, db);
    expect(result).toEqual(DB_USER);
  });

  it("inserts with the correct google_sub, email, name, and default role", async () => {
    const db = makeMockDb(DB_USER);
    await upsertUser(GOOGLE_USER, db);

    const insertIntoMock = db.insertInto as ReturnType<typeof vi.fn>;
    expect(insertIntoMock).toHaveBeenCalledWith("users");

    const valuesMock = insertIntoMock.mock.results[0]!.value.values as ReturnType<typeof vi.fn>;
    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        google_sub: GOOGLE_USER.sub,
        email: GOOGLE_USER.email,
        name: GOOGLE_USER.name,
        role: "consultant",
      })
    );
  });

  it("uses ON CONFLICT when inserting", async () => {
    const db = makeMockDb(DB_USER);
    await upsertUser(GOOGLE_USER, db);

    const insertIntoMock = db.insertInto as ReturnType<typeof vi.fn>;
    const valuesMock = insertIntoMock.mock.results[0]!.value.values as ReturnType<typeof vi.fn>;
    const onConflictMock = valuesMock.mock.results[0]!.value.onConflict as ReturnType<typeof vi.fn>;

    expect(onConflictMock).toHaveBeenCalled();
  });

  it("returns the user even when the row already existed (conflict path)", async () => {
    const db = makeMockDb(DB_USER);
    const result = await upsertUser(GOOGLE_USER, db);
    expect(result.google_sub).toBe(GOOGLE_USER.sub);
    expect(result.role).toBe("consultant");
  });
});
