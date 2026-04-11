import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Kysely } from "kysely";
import type { Database } from "../../db/types.js";
import {
  createExternalAIAuthorization,
  deleteExternalAIAuthorization,
  exchangeExternalAILoginChallenge,
  listExternalAIAuthorizations,
  listExternalAIClients,
  refreshExternalAIAccessToken,
  revokeExternalAIAuthorization,
} from "./external-ai.js";

vi.mock("../../auth/external-ai-tokens.js", () => ({
  DEFAULT_EXTERNAL_AI_SCOPES: [
    "ai:context:read",
    "resume:read",
    "resume-branch:read",
    "resume-branch:write",
    "resume-commit:read",
    "resume-commit:write",
    "branch-assignment:read",
    "branch-assignment:write",
    "branch-skill:write",
    "education:read",
    "education:write",
  ],
  EXTERNAL_AI_CONTEXT_SCOPE: "ai:context:read",
  EXTERNAL_AI_DEFAULT_DURATION: "8h",
  externalAIAccessTokenExpiresAt: vi.fn(() => new Date("2026-04-11T12:00:00Z")),
  externalAIAuthorizationExpiresAt: vi.fn(() => new Date("2026-04-11T20:00:00Z")),
  externalAIChallengeExpiresAt: vi.fn(() => new Date("2026-04-11T10:10:00Z")),
  generateExternalAIAccessToken: vi.fn(() => "eai_token"),
  generateExternalAIChallengeCode: vi.fn(() => "challenge-code"),
  generateExternalAIRefreshToken: vi.fn(() => "eair_refresh_token"),
  hashExternalAISecret: vi.fn((value: string) => `hash:${value}`),
}));

function buildListDb(rows: unknown[]) {
  const execute = vi.fn().mockResolvedValue(rows);
  const orderBy = vi.fn().mockReturnValue({ execute });
  const where = vi.fn().mockReturnValue({ orderBy });
  const selectAll = vi.fn().mockReturnValue({ where });
  const selectFrom = vi.fn().mockReturnValue({ selectAll });
  return { selectFrom } as unknown as Kysely<Database>;
}

function buildCreateDb() {
  const clientExecuteTakeFirst = vi.fn().mockResolvedValue({
    id: "client-1",
    key: "anthropic_claude",
    title: "Anthropic Claude",
    description: "Claude",
    is_active: true,
  });
  const clientWhereIsActive = vi.fn().mockReturnValue({ executeTakeFirst: clientExecuteTakeFirst });
  const clientWhereKey = vi.fn().mockReturnValue({ where: clientWhereIsActive });
  const clientSelectAll = vi.fn().mockReturnValue({ where: clientWhereKey });

  const challengeReturning = vi.fn().mockReturnValue({
    executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ id: "challenge-1" }),
  });
  const challengeValues = vi.fn().mockReturnValue({ returning: challengeReturning });

  const authReturning = vi.fn().mockReturnValue({
    executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ id: "auth-1" }),
  });
  const authValues = vi.fn().mockReturnValue({ returning: authReturning });

  const insertInto = vi.fn((table: string) => {
    if (table === "external_ai_authorizations") {
      return { values: authValues };
    }
    if (table === "external_ai_login_challenges") {
      return { values: challengeValues };
    }
    throw new Error(`Unexpected insert table: ${table}`);
  });

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "external_ai_clients") {
      return { selectAll: clientSelectAll };
    }
    throw new Error(`Unexpected select table: ${table}`);
  });

  return { selectFrom, insertInto } as unknown as Kysely<Database>;
}

function buildAuthorizationListDb(rows: unknown[]) {
  const execute = vi.fn().mockResolvedValue(rows);
  const orderBy = vi.fn().mockReturnValue({ execute });
  const where = vi.fn().mockReturnValue({ orderBy });
  const select = vi.fn().mockReturnValue({ where });
  const innerJoin = vi.fn().mockReturnValue({ select });
  const selectFrom = vi.fn().mockReturnValue({ innerJoin });
  return { selectFrom } as unknown as Kysely<Database>;
}

function buildExchangeDb(existing: unknown) {
  const executeTakeFirst = vi.fn().mockResolvedValue(existing);
  const where = vi.fn().mockReturnValue({ executeTakeFirst });
  const select = vi.fn().mockReturnValue({ where });
  const innerJoin2 = vi.fn().mockReturnValue({ select });
  const innerJoin1 = vi.fn().mockReturnValue({ innerJoin: innerJoin2 });
  const selectFrom = vi.fn().mockReturnValue({ innerJoin: innerJoin1 });

  const insertExecute = vi.fn().mockResolvedValue(undefined);
  const insertValues = vi.fn().mockReturnValue({ execute: insertExecute });

  const executeUpdate = vi.fn().mockResolvedValue(undefined);
  const whereUpdate = vi.fn().mockReturnValue({ execute: executeUpdate });
  const set = vi.fn().mockReturnValue({ where: whereUpdate });
  const updateTable = vi.fn().mockReturnValue({ set });

  return { selectFrom, insertInto: vi.fn().mockReturnValue({ values: insertValues }), updateTable } as unknown as Kysely<Database>;
}

function buildRefreshDb(existing: unknown) {
  const executeTakeFirst = vi.fn().mockResolvedValue(existing);
  const where = vi.fn().mockReturnValue({ executeTakeFirst });
  const select = vi.fn().mockReturnValue({ where });
  const innerJoin = vi.fn().mockReturnValue({ select });
  const selectFrom = vi.fn().mockReturnValue({ innerJoin });

  const insertExecute = vi.fn().mockResolvedValue(undefined);
  const insertValues = vi.fn().mockReturnValue({ execute: insertExecute });

  const executeUpdate = vi.fn().mockResolvedValue(undefined);
  const whereUpdate = vi.fn().mockReturnValue({ execute: executeUpdate });
  const set = vi.fn().mockReturnValue({ where: whereUpdate });
  const updateTable = vi.fn().mockReturnValue({ set });

  return { selectFrom, insertInto: vi.fn().mockReturnValue({ values: insertValues }), updateTable } as unknown as Kysely<Database>;
}

function buildDeleteDb(existing: unknown) {
  const executeTakeFirst = vi.fn().mockResolvedValue(existing);
  const where = vi.fn().mockReturnValue({ executeTakeFirst, execute: vi.fn().mockResolvedValue(undefined) });
  const select = vi.fn().mockReturnValue({ where });
  const selectFrom = vi.fn().mockReturnValue({ select });
  const deleteWhere = vi.fn().mockReturnValue({ execute: vi.fn().mockResolvedValue(undefined) });
  const deleteFrom = vi.fn().mockReturnValue({ where: deleteWhere });

  return { selectFrom, deleteFrom } as unknown as Kysely<Database>;
}

function buildRevokeDb(existing: unknown) {
  const executeTakeFirst = vi.fn().mockResolvedValue(existing);
  const where = vi.fn().mockReturnValue({ executeTakeFirst });
  const select = vi.fn().mockReturnValue({ where });
  const selectFrom = vi.fn().mockReturnValue({ select });

  const executeUpdate = vi.fn().mockResolvedValue(undefined);
  const whereRevoked = vi.fn().mockReturnValue({ execute: executeUpdate });
  const whereAuthorization = vi.fn().mockReturnValue({ where: whereRevoked, execute: executeUpdate });
  const set = vi.fn().mockReturnValue({ where: whereAuthorization });
  const updateTable = vi.fn().mockReturnValue({ set });

  return { selectFrom, updateTable } as unknown as Kysely<Database>;
}

describe("listExternalAIClients", () => {
  it("returns active external ai clients", async () => {
    const db = buildListDb([
      {
        id: "client-1",
        key: "anthropic_claude",
        title: "Anthropic Claude",
        description: "Claude",
        is_active: true,
      },
    ]);

    await expect(listExternalAIClients(db)).resolves.toEqual({
      clients: [
        {
          id: "client-1",
          key: "anthropic_claude",
          title: "Anthropic Claude",
          description: "Claude",
          isActive: true,
        },
      ],
    });
  });
});

describe("createExternalAIAuthorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates an authorization and one-time login challenge", async () => {
    const db = buildCreateDb();

    await expect(
      createExternalAIAuthorization(db, "user-1", {
        clientKey: "anthropic_claude",
        title: "Claude connection",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        authorizationId: "auth-1",
        challengeId: "challenge-1",
        challengeCode: "challenge-code",
        scopes: [
          "ai:context:read",
          "resume:read",
          "resume-branch:read",
          "resume-branch:write",
          "resume-commit:read",
          "resume-commit:write",
          "branch-assignment:read",
          "branch-assignment:write",
          "branch-skill:write",
          "education:read",
          "education:write",
        ],
      }),
    );
  });

  it("allows requesting a subset of supported scopes", async () => {
    const db = buildCreateDb();

    await expect(
      createExternalAIAuthorization(db, "user-1", {
        clientKey: "anthropic_claude",
        scopes: ["ai:context:read", "resume:read"],
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        scopes: ["ai:context:read", "resume:read"],
      }),
    );
  });
});

describe("listExternalAIAuthorizations", () => {
  it("returns the user's external AI authorizations", async () => {
    const db = buildAuthorizationListDb([
      {
        id: "auth-1",
        title: "Claude connection",
        scopes: ["ai:context:read", "resume:read"],
        status: "active",
        last_used_at: new Date("2026-04-10T12:00:00Z"),
        expires_at: new Date("2026-05-10T12:00:00Z"),
        revoked_at: null,
        created_at: new Date("2026-04-10T10:00:00Z"),
        clientId: "client-1",
        clientKey: "anthropic_claude",
        clientTitle: "Anthropic Claude",
        clientDescription: "Claude",
        clientIsActive: true,
      },
    ]);

    await expect(listExternalAIAuthorizations(db, "user-1")).resolves.toEqual({
      authorizations: [
        {
          id: "auth-1",
          title: "Claude connection",
          scopes: ["ai:context:read", "resume:read"],
          status: "active",
          lastUsedAt: "2026-04-10T12:00:00.000Z",
          expiresAt: "2026-05-10T12:00:00.000Z",
          revokedAt: null,
          createdAt: "2026-04-10T10:00:00.000Z",
          client: {
            id: "client-1",
            key: "anthropic_claude",
            title: "Anthropic Claude",
            description: "Claude",
            isActive: true,
          },
        },
      ],
    });
  });
});

describe("exchangeExternalAILoginChallenge", () => {
  it("exchanges a valid one-time challenge for an access token and refresh token", async () => {
    const authorizationExpiresAt = new Date("2099-04-11T20:00:00Z");
    const db = buildExchangeDb({
      challengeId: "challenge-1",
      challengeCodeHash: "hash:challenge-code",
      challengeExpiresAt: new Date("2099-04-11T10:10:00Z"),
      challengeUsedAt: null,
      authorizationId: "auth-1",
      scopes: ["ai:context:read", "resume:read"],
      authorizationExpiresAt,
      authorizationRevokedAt: null,
      clientId: "client-1",
      clientKey: "anthropic_claude",
      clientTitle: "Anthropic Claude",
      clientDescription: "Claude",
      clientIsActive: true,
    });

    await expect(
      exchangeExternalAILoginChallenge(db, {
        challengeId: "challenge-1",
        challengeCode: "challenge-code",
      }),
    ).resolves.toEqual({
      accessToken: "eai_token",
      expiresAt: "2026-04-11T12:00:00.000Z",
      refreshToken: "eair_refresh_token",
      refreshTokenExpiresAt: authorizationExpiresAt.toISOString(),
      scopes: ["ai:context:read", "resume:read"],
      authorizationId: "auth-1",
      client: {
        id: "client-1",
        key: "anthropic_claude",
        title: "Anthropic Claude",
        description: "Claude",
        isActive: true,
      },
    });
  });
});

describe("refreshExternalAIAccessToken", () => {
  it("issues a new access token for a valid refresh token", async () => {
    const db = buildRefreshDb({
      tokenId: "token-1",
      scopes: ["ai:context:read", "resume:read"],
      tokenRevokedAt: null,
      authorizationId: "auth-1",
      authorizationStatus: "active",
      authorizationExpiresAt: new Date("2099-04-11T20:00:00Z"),
      authorizationRevokedAt: null,
    });

    await expect(
      refreshExternalAIAccessToken(db, { refreshToken: "eair_refresh_token" }),
    ).resolves.toEqual({
      accessToken: "eai_token",
      expiresAt: "2026-04-11T12:00:00.000Z",
      scopes: ["ai:context:read", "resume:read"],
    });
  });

  it("rejects a revoked refresh token", async () => {
    const db = buildRefreshDb({
      tokenId: "token-1",
      scopes: ["ai:context:read"],
      tokenRevokedAt: new Date("2026-04-11T08:00:00Z"),
      authorizationId: "auth-1",
      authorizationStatus: "active",
      authorizationExpiresAt: new Date("2099-04-11T20:00:00Z"),
      authorizationRevokedAt: null,
    });

    await expect(
      refreshExternalAIAccessToken(db, { refreshToken: "eair_refresh_token" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects a token whose authorization has expired", async () => {
    const db = buildRefreshDb({
      tokenId: "token-1",
      scopes: ["ai:context:read"],
      tokenRevokedAt: null,
      authorizationId: "auth-1",
      authorizationStatus: "expired",
      authorizationExpiresAt: new Date("2020-01-01T00:00:00Z"),
      authorizationRevokedAt: null,
    });

    await expect(
      refreshExternalAIAccessToken(db, { refreshToken: "eair_refresh_token" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("deleteExternalAIAuthorization", () => {
  it("deletes a revoked authorization owned by the user", async () => {
    const db = buildDeleteDb({
      id: "auth-1",
      user_id: "user-1",
      status: "revoked",
      revoked_at: new Date("2026-04-11T08:00:00Z"),
      expires_at: new Date("2099-04-11T20:00:00Z"),
    });

    await expect(deleteExternalAIAuthorization(db, "user-1", "auth-1")).resolves.toEqual({
      success: true,
    });
  });

  it("deletes an expired authorization", async () => {
    const db = buildDeleteDb({
      id: "auth-1",
      user_id: "user-1",
      status: "expired",
      revoked_at: null,
      expires_at: new Date("2020-01-01T00:00:00Z"),
    });

    await expect(deleteExternalAIAuthorization(db, "user-1", "auth-1")).resolves.toEqual({
      success: true,
    });
  });

  it("rejects deletion of an active authorization", async () => {
    const db = buildDeleteDb({
      id: "auth-1",
      user_id: "user-1",
      status: "active",
      revoked_at: null,
      expires_at: new Date("2099-04-11T20:00:00Z"),
    });

    await expect(deleteExternalAIAuthorization(db, "user-1", "auth-1")).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("rejects deletion of another user's authorization", async () => {
    const db = buildDeleteDb({
      id: "auth-1",
      user_id: "user-2",
      status: "revoked",
      revoked_at: new Date("2026-04-11T08:00:00Z"),
      expires_at: new Date("2099-04-11T20:00:00Z"),
    });

    await expect(deleteExternalAIAuthorization(db, "user-1", "auth-1")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("revokeExternalAIAuthorization", () => {
  it("revokes an authorization owned by the current user", async () => {
    const db = buildRevokeDb({ id: "auth-1", user_id: "user-1" });
    await expect(revokeExternalAIAuthorization(db, "user-1", "auth-1")).resolves.toEqual({
      success: true,
    });
  });
});
