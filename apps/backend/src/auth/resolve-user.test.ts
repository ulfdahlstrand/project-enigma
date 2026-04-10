import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { resolveUser } from "./resolve-user.js";

vi.mock("./session-repository.js", () => ({
  createSessionRepository: vi.fn(),
}));

vi.mock("./jwt.js", () => ({
  verifyAccessToken: vi.fn(),
}));

vi.mock("./verify-entra-token.js", () => ({
  verifyEntraToken: vi.fn(),
}));

vi.mock("./upsert-user.js", () => ({
  upsertUser: vi.fn(),
}));

import { createSessionRepository } from "./session-repository.js";
import { verifyAccessToken } from "./jwt.js";
import { verifyEntraToken } from "./verify-entra-token.js";
import { upsertUser } from "./upsert-user.js";

const mockCreateSessionRepository = vi.mocked(createSessionRepository);
const mockVerifyAccessToken = vi.mocked(verifyAccessToken);
const mockVerifyEntraToken = vi.mocked(verifyEntraToken);
const mockUpsertUser = vi.mocked(upsertUser);

function createDbMock(user: { id: string; azure_oid?: string | null; email: string; name: string; role: "admin" | "consultant" } | null) {
  const executeTakeFirst = vi.fn().mockResolvedValue(user);
  const where = vi.fn().mockReturnValue({ executeTakeFirst });
  const selectAll = vi.fn().mockReturnValue({ where });
  const externalExecuteTakeFirst = vi.fn().mockResolvedValue(null);
  const externalQuery = {
    where: vi.fn(),
    executeTakeFirst: externalExecuteTakeFirst,
  };
  externalQuery.where.mockReturnValue(externalQuery);
  const externalSelect = vi.fn().mockReturnValue(externalQuery);
  const externalInnerJoin3 = vi.fn().mockReturnValue({ select: externalSelect });
  const externalInnerJoin2 = vi.fn().mockReturnValue({ innerJoin: externalInnerJoin3 });
  const externalInnerJoin1 = vi.fn().mockReturnValue({ innerJoin: externalInnerJoin2 });
  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "users") {
      return { selectAll };
    }
    if (table === "external_ai_access_tokens as t") {
      return { innerJoin: externalInnerJoin1 };
    }
    throw new Error(`Unexpected selectFrom table: ${table}`);
  });

  return {
    db: { selectFrom } as unknown as Kysely<Database>,
    selectFrom,
    selectAll,
    where,
    executeTakeFirst,
  };
}

describe("resolveUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the session user when a valid refresh cookie is present", async () => {
    const user = { id: "user-1", email: "user@example.com", name: "User", role: "admin" as const };
    const { db, selectFrom } = createDbMock(user);
    const updateLastSeen = vi.fn().mockResolvedValue(undefined);

    mockCreateSessionRepository.mockReturnValue({
      createSession: vi.fn(),
      findByRefreshTokenHash: vi.fn().mockResolvedValue({ id: "session-1", user_id: "user-1" }),
      updateLastSeen,
      revokeSession: vi.fn(),
      revokeAllUserSessions: vi.fn(),
    });

    const result = await resolveUser(db, "", "cv_refresh_token=raw-token");

    expect(result).toEqual(user);
    expect(selectFrom).toHaveBeenCalledWith("users");
    expect(updateLastSeen).toHaveBeenCalledWith("session-1");
    expect(mockVerifyAccessToken).not.toHaveBeenCalled();
  });

  it("falls back to a bearer access token when no valid cookie session exists", async () => {
    const user = { id: "user-2", email: "bearer@example.com", name: "Bearer", role: "consultant" as const };
    const { db } = createDbMock(user);

    mockCreateSessionRepository.mockReturnValue({
      createSession: vi.fn(),
      findByRefreshTokenHash: vi.fn().mockResolvedValue(undefined),
      updateLastSeen: vi.fn(),
      revokeSession: vi.fn(),
      revokeAllUserSessions: vi.fn(),
    });
    mockVerifyAccessToken.mockResolvedValue({ sub: "user-2" } as never);

    const result = await resolveUser(db, "Bearer signed-token", undefined);

    expect(result).toEqual(user);
    expect(mockVerifyAccessToken).toHaveBeenCalledWith("signed-token");
  });

  it("returns null when neither cookie session nor bearer token is valid", async () => {
    const { db } = createDbMock(null);

    mockCreateSessionRepository.mockReturnValue({
      createSession: vi.fn(),
      findByRefreshTokenHash: vi.fn().mockResolvedValue(undefined),
      updateLastSeen: vi.fn(),
      revokeSession: vi.fn(),
      revokeAllUserSessions: vi.fn(),
    });
    mockVerifyAccessToken.mockRejectedValue(new Error("bad token"));
    mockVerifyEntraToken.mockResolvedValue(null);

    const result = await resolveUser(db, "Bearer invalid-token", undefined);

    expect(result).toBeNull();
    expect(mockUpsertUser).not.toHaveBeenCalled();
  });
});
