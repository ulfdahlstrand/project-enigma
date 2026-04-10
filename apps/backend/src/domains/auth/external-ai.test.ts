import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Kysely } from "kysely";
import type { Database } from "../../db/types.js";
import {
  createExternalAIAuthorization,
  exchangeExternalAILoginChallenge,
  listExternalAIClients,
  revokeExternalAIAuthorization,
} from "./external-ai.js";

vi.mock("../../auth/external-ai-tokens.js", () => ({
  DEFAULT_EXTERNAL_AI_SCOPES: ["ai:context:read"],
  EXTERNAL_AI_CONTEXT_SCOPE: "ai:context:read",
  externalAIAccessTokenExpiresAt: vi.fn(() => new Date("2026-04-10T12:00:00Z")),
  externalAIAuthorizationExpiresAt: vi.fn(() => new Date("2026-05-10T12:00:00Z")),
  externalAIChallengeExpiresAt: vi.fn(() => new Date("2026-04-10T10:10:00Z")),
  generateExternalAIAccessToken: vi.fn(() => "eai_token"),
  generateExternalAIChallengeCode: vi.fn(() => "challenge-code"),
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
        scopes: ["ai:context:read"],
      }),
    );
  });
});

describe("exchangeExternalAILoginChallenge", () => {
  it("exchanges a valid one-time challenge for an access token", async () => {
    const db = buildExchangeDb({
      challengeId: "challenge-1",
      challengeCodeHash: "hash:challenge-code",
      challengeExpiresAt: new Date("2099-04-10T10:10:00Z"),
      challengeUsedAt: null,
      authorizationId: "auth-1",
      scopes: ["ai:context:read"],
      authorizationExpiresAt: new Date("2099-05-10T12:00:00Z"),
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
      expiresAt: "2026-04-10T12:00:00.000Z",
      scopes: ["ai:context:read"],
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

describe("revokeExternalAIAuthorization", () => {
  it("revokes an authorization owned by the current user", async () => {
    const db = buildRevokeDb({ id: "auth-1", user_id: "user-1" });
    await expect(revokeExternalAIAuthorization(db, "user-1", "auth-1")).resolves.toEqual({
      success: true,
    });
  });
});
