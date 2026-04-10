import { implement, ORPCError } from "@orpc/server";
import type { Kysely } from "kysely";
import { contract } from "@cv-tool/contracts";
import type { ExternalAIScope } from "@cv-tool/contracts";
import type { Database } from "../../db/types.js";
import { getDb } from "../../db/client.js";
import { requireAuth, type AuthContext } from "../../auth/require-auth.js";
import {
  DEFAULT_EXTERNAL_AI_SCOPES,
  externalAIAccessTokenExpiresAt,
  externalAIAuthorizationExpiresAt,
  externalAIChallengeExpiresAt,
  generateExternalAIAccessToken,
  generateExternalAIChallengeCode,
  hashExternalAISecret,
} from "../../auth/external-ai-tokens.js";

type ExternalAIClientRow = {
  id: string;
  key: string;
  title: string;
  description: string | null;
  is_active: boolean;
};

function mapClient(row: ExternalAIClientRow) {
  return {
    id: row.id,
    key: row.key,
    title: row.title,
    description: row.description,
    isActive: row.is_active,
  };
}

export async function listExternalAIClients(db: Kysely<Database>) {
  const rows = await db
    .selectFrom("external_ai_clients")
    .selectAll()
    .where("is_active", "=", true)
    .orderBy("title")
    .execute();

  return { clients: rows.map(mapClient) };
}

export async function createExternalAIAuthorization(
  db: Kysely<Database>,
  userId: string,
  input: { clientKey: string; title?: string | null; scopes?: ExternalAIScope[] },
) {
  const client = await db
    .selectFrom("external_ai_clients")
    .selectAll()
    .where("key", "=", input.clientKey)
    .where("is_active", "=", true)
    .executeTakeFirst();

  if (!client) {
    throw new ORPCError("NOT_FOUND", { message: "External AI client not found" });
  }

  const requestedScopes = input.scopes?.length ? input.scopes : [...DEFAULT_EXTERNAL_AI_SCOPES];
  const allowedScopes = new Set<ExternalAIScope>(DEFAULT_EXTERNAL_AI_SCOPES as unknown as ExternalAIScope[]);
  const invalidScope = requestedScopes.find((scope) => !allowedScopes.has(scope));
  if (invalidScope) {
    throw new ORPCError("BAD_REQUEST", { message: `Unsupported external AI scope: ${invalidScope}` });
  }

  const scopes: ExternalAIScope[] = [...new Set(requestedScopes)];
  const challengeCode = generateExternalAIChallengeCode();
  const challengeExpiresAt = externalAIChallengeExpiresAt();
  const accessTokenExpiresAt = externalAIAccessTokenExpiresAt();
  const authorizationExpiresAt = externalAIAuthorizationExpiresAt();

  const authorization = await db
    .insertInto("external_ai_authorizations")
    .values({
      user_id: userId,
      client_id: client.id,
      title: input.title?.trim() || null,
      scopes,
      status: "pending",
      expires_at: authorizationExpiresAt,
    })
    .returning(["id"])
    .executeTakeFirstOrThrow();

  const challenge = await db
    .insertInto("external_ai_login_challenges")
    .values({
      authorization_id: authorization.id,
      challenge_code_hash: hashExternalAISecret(challengeCode),
      expires_at: challengeExpiresAt,
    })
    .returning(["id"])
    .executeTakeFirstOrThrow();

  return {
    authorizationId: authorization.id,
    challengeId: challenge.id,
    challengeCode,
    challengeExpiresAt: challengeExpiresAt.toISOString(),
    authorizationExpiresAt: authorizationExpiresAt.toISOString(),
    accessTokenExpiresAt: accessTokenExpiresAt.toISOString(),
    scopes,
    client: mapClient(client),
  };
}

export async function exchangeExternalAILoginChallenge(
  db: Kysely<Database>,
  input: { challengeId: string; challengeCode: string },
) {
  const now = new Date();
  const challenge = await db
    .selectFrom("external_ai_login_challenges as ch")
    .innerJoin("external_ai_authorizations as a", "a.id", "ch.authorization_id")
    .innerJoin("external_ai_clients as c", "c.id", "a.client_id")
    .select([
      "ch.id as challengeId",
      "ch.challenge_code_hash as challengeCodeHash",
      "ch.expires_at as challengeExpiresAt",
      "ch.used_at as challengeUsedAt",
      "a.id as authorizationId",
      "a.scopes as scopes",
      "a.expires_at as authorizationExpiresAt",
      "a.revoked_at as authorizationRevokedAt",
      "c.id as clientId",
      "c.key as clientKey",
      "c.title as clientTitle",
      "c.description as clientDescription",
      "c.is_active as clientIsActive",
    ])
    .where("ch.id", "=", input.challengeId)
    .executeTakeFirst();

  if (!challenge) {
    throw new ORPCError("NOT_FOUND", { message: "External AI login challenge not found" });
  }

  if (challenge.challengeUsedAt || challenge.challengeExpiresAt <= now) {
    throw new ORPCError("FORBIDDEN", { message: "External AI login challenge has expired" });
  }

  if (challenge.authorizationRevokedAt || challenge.authorizationExpiresAt <= now || !challenge.clientIsActive) {
    throw new ORPCError("FORBIDDEN", { message: "External AI authorization is no longer active" });
  }

  if (challenge.challengeCodeHash !== hashExternalAISecret(input.challengeCode)) {
    throw new ORPCError("FORBIDDEN", { message: "Invalid external AI login challenge" });
  }

  const scopes: ExternalAIScope[] = [...new Set(
    challenge.scopes.filter((scope): scope is ExternalAIScope => typeof scope === "string"),
  )];

  const rawAccessToken = generateExternalAIAccessToken();
  const accessTokenExpiresAt = externalAIAccessTokenExpiresAt();

  await Promise.all([
    db
      .insertInto("external_ai_access_tokens")
      .values({
        authorization_id: challenge.authorizationId,
        token_hash: hashExternalAISecret(rawAccessToken),
        scopes,
        expires_at: accessTokenExpiresAt,
      })
      .execute(),
    db
      .updateTable("external_ai_login_challenges")
      .set({ used_at: now })
      .where("id", "=", challenge.challengeId)
      .execute(),
    db
      .updateTable("external_ai_authorizations")
      .set({ status: "active", updated_at: now })
      .where("id", "=", challenge.authorizationId)
      .execute(),
  ]);

  return {
    accessToken: rawAccessToken,
    expiresAt: accessTokenExpiresAt.toISOString(),
    scopes,
    authorizationId: challenge.authorizationId,
    client: {
      id: challenge.clientId,
      key: challenge.clientKey,
      title: challenge.clientTitle,
      description: challenge.clientDescription,
      isActive: challenge.clientIsActive,
    },
  };
}

export async function revokeExternalAIAuthorization(
  db: Kysely<Database>,
  userId: string,
  authorizationId: string,
) {
  const authorization = await db
    .selectFrom("external_ai_authorizations")
    .select(["id", "user_id"])
    .where("id", "=", authorizationId)
    .executeTakeFirst();

  if (!authorization) {
    throw new ORPCError("NOT_FOUND", { message: "External AI authorization not found" });
  }

  if (authorization.user_id !== userId) {
    throw new ORPCError("FORBIDDEN");
  }

  const now = new Date();
  await Promise.all([
    db
      .updateTable("external_ai_authorizations")
      .set({
        status: "revoked",
        revoked_at: now,
        updated_at: now,
      })
      .where("id", "=", authorizationId)
      .execute(),
    db
      .updateTable("external_ai_access_tokens")
      .set({ revoked_at: now })
      .where("authorization_id", "=", authorizationId)
      .where("revoked_at", "is", null)
      .execute(),
  ]);

  return { success: true as const };
}

export const listExternalAIClientsHandler = implement(contract.listExternalAIClients).handler(
  async ({ context }) => {
    requireAuth(context as AuthContext);
    return listExternalAIClients(getDb());
  },
);

export const createExternalAIAuthorizationHandler = implement(contract.createExternalAIAuthorization).handler(
  async ({ input, context }) => {
    const user = requireAuth(context as AuthContext);
    return createExternalAIAuthorization(getDb(), user.id, {
      clientKey: input.clientKey,
      title: input.title ?? null,
    });
  },
);

export const exchangeExternalAILoginChallengeHandler = implement(contract.exchangeExternalAILoginChallenge).handler(
  async ({ input }) => exchangeExternalAILoginChallenge(getDb(), input),
);

export const revokeExternalAIAuthorizationHandler = implement(contract.revokeExternalAIAuthorization).handler(
  async ({ input, context }) => {
    const user = requireAuth(context as AuthContext);
    return revokeExternalAIAuthorization(getDb(), user.id, input.authorizationId);
  },
);
