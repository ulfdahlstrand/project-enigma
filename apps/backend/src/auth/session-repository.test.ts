import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSessionRepository } from "./session-repository.js";
import type { Kysely } from "kysely";
import type { Database, UserSession } from "../db/types.js";

const MOCK_SESSION: UserSession = {
  id: "session-uuid-1",
  user_id: "user-uuid-1",
  ip_address: "127.0.0.1",
  user_agent: "TestBrowser/1.0",
  logged_in_at: new Date("2026-03-20T10:00:00Z"),
  last_seen_at: new Date("2026-03-20T10:00:00Z"),
  expires_at: new Date("2026-04-19T10:00:00Z"),
  refresh_token_hash: "abc123hash",
  revoked_at: null,
};

function makeExecutor(value: unknown) {
  return vi.fn().mockResolvedValue(value);
}

function makeChain(terminalResult: unknown) {
  const execute = makeExecutor(terminalResult);
  const executeTakeFirst = makeExecutor(terminalResult);
  const executeTakeFirstOrThrow = makeExecutor(terminalResult);
  return { execute, executeTakeFirst, executeTakeFirstOrThrow };
}

describe("createSessionRepository", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: Kysely<Database>;
  let repo: ReturnType<typeof createSessionRepository>;

  beforeEach(() => {
    db = {} as Kysely<Database>;
    repo = createSessionRepository(db);
    vi.clearAllMocks();
  });

  describe("createSession", () => {
    it("inserts a session row and returns it", async () => {
      const chain = makeChain(MOCK_SESSION);
      const returningAll = vi.fn().mockReturnValue(chain);
      const values = vi.fn().mockReturnValue({ returningAll });
      const insertInto = vi.fn().mockReturnValue({ values });
      db.insertInto = insertInto as unknown as typeof db.insertInto;

      const result = await repo.createSession({
        userId: MOCK_SESSION.user_id,
        expiresAt: MOCK_SESSION.expires_at,
        ipAddress: MOCK_SESSION.ip_address,
        userAgent: MOCK_SESSION.user_agent,
        refreshTokenHash: MOCK_SESSION.refresh_token_hash,
      });

      expect(insertInto).toHaveBeenCalledWith("user_sessions");
      expect(result).toBe(MOCK_SESSION);
    });
  });

  describe("findByRefreshTokenHash", () => {
    it("returns session when found and not revoked or expired", async () => {
      const chain = makeChain(MOCK_SESSION);
      const where3 = vi.fn().mockReturnValue(chain);
      const where2 = vi.fn().mockReturnValue({ where: where3 });
      const where1 = vi.fn().mockReturnValue({ where: where2 });
      const selectAll = vi.fn().mockReturnValue({ where: where1 });
      const selectFrom = vi.fn().mockReturnValue({ selectAll });
      db.selectFrom = selectFrom as unknown as typeof db.selectFrom;

      const result = await repo.findByRefreshTokenHash("abc123hash");

      expect(selectFrom).toHaveBeenCalledWith("user_sessions");
      expect(result).toBe(MOCK_SESSION);
    });

    it("returns undefined when not found", async () => {
      const chain = makeChain(undefined);
      const where3 = vi.fn().mockReturnValue(chain);
      const where2 = vi.fn().mockReturnValue({ where: where3 });
      const where1 = vi.fn().mockReturnValue({ where: where2 });
      const selectAll = vi.fn().mockReturnValue({ where: where1 });
      const selectFrom = vi.fn().mockReturnValue({ selectAll });
      db.selectFrom = selectFrom as unknown as typeof db.selectFrom;

      const result = await repo.findByRefreshTokenHash("nonexistent");
      expect(result).toBeUndefined();
    });
  });

  describe("updateLastSeen", () => {
    it("updates last_seen_at for the given session id", async () => {
      const chain = makeChain([]);
      const where1 = vi.fn().mockReturnValue(chain);
      const set = vi.fn().mockReturnValue({ where: where1 });
      const updateTable = vi.fn().mockReturnValue({ set });
      db.updateTable = updateTable as unknown as typeof db.updateTable;

      await repo.updateLastSeen("session-uuid-1");

      expect(updateTable).toHaveBeenCalledWith("user_sessions");
      expect(set).toHaveBeenCalledWith(expect.objectContaining({ last_seen_at: expect.any(Date) as Date }));
    });
  });

  describe("revokeSession", () => {
    it("sets revoked_at for the given session id", async () => {
      const chain = makeChain([]);
      const where1 = vi.fn().mockReturnValue(chain);
      const set = vi.fn().mockReturnValue({ where: where1 });
      const updateTable = vi.fn().mockReturnValue({ set });
      db.updateTable = updateTable as unknown as typeof db.updateTable;

      await repo.revokeSession("session-uuid-1");

      expect(set).toHaveBeenCalledWith(expect.objectContaining({ revoked_at: expect.any(Date) as Date }));
    });
  });

  describe("revokeAllUserSessions", () => {
    it("revokes all active sessions for a user", async () => {
      const chain = makeChain([]);
      const where2 = vi.fn().mockReturnValue(chain);
      const where1 = vi.fn().mockReturnValue({ where: where2 });
      const set = vi.fn().mockReturnValue({ where: where1 });
      const updateTable = vi.fn().mockReturnValue({ set });
      db.updateTable = updateTable as unknown as typeof db.updateTable;

      await repo.revokeAllUserSessions("user-uuid-1");

      expect(updateTable).toHaveBeenCalledWith("user_sessions");
      expect(set).toHaveBeenCalledWith(expect.objectContaining({ revoked_at: expect.any(Date) as Date }));
    });
  });
});
