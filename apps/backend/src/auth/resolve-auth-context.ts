import type { Kysely } from "kysely";
import type { Database, User } from "../db/types.js";
import { parseRefreshToken, hashRefreshToken } from "./refresh-token.js";
import { createSessionRepository } from "./session-repository.js";
import { verifyAccessToken } from "./jwt.js";
import { verifyEntraToken } from "./verify-entra-token.js";
import { upsertUser } from "./upsert-user.js";
import { hashExternalAISecret } from "./external-ai-tokens.js";

export type ExternalAIAuthInfo = {
  tokenId: string;
  authorizationId: string;
  clientId: string;
  clientKey: string;
  clientTitle: string;
  clientDescription: string | null;
  scopes: string[];
};

export type ResolvedAuthContext = {
  user: User | null;
  externalAI: ExternalAIAuthInfo | null;
};

async function resolveExternalAIAuth(
  db: Kysely<Database>,
  token: string,
): Promise<ResolvedAuthContext | null> {
  const now = new Date();
  const tokenHash = hashExternalAISecret(token);
  const externalToken = await db
    .selectFrom("external_ai_access_tokens as t")
    .innerJoin("external_ai_authorizations as a", "a.id", "t.authorization_id")
    .innerJoin("external_ai_clients as c", "c.id", "a.client_id")
    .innerJoin("users as u", "u.id", "a.user_id")
    .select([
      "t.id as tokenId",
      "t.authorization_id as authorizationId",
      "t.scopes as scopes",
      "a.client_id as clientId",
      "c.key as clientKey",
      "c.title as clientTitle",
      "c.description as clientDescription",
      "u.id as userId",
      "u.azure_oid as azure_oid",
      "u.email as email",
      "u.name as name",
      "u.role as role",
      "u.created_at as created_at",
    ])
    .where("t.token_hash", "=", tokenHash)
    .where("t.revoked_at", "is", null)
    .where("t.expires_at", ">", now)
    .where("a.revoked_at", "is", null)
    .where("a.expires_at", ">", now)
    .where("a.status", "=", "active")
    .where("c.is_active", "=", true)
    .executeTakeFirst();

  if (!externalToken) {
    return null;
  }

  await Promise.all([
    db
      .updateTable("external_ai_access_tokens")
      .set({ last_used_at: now })
      .where("id", "=", externalToken.tokenId)
      .execute(),
    db
      .updateTable("external_ai_authorizations")
      .set({ last_used_at: now, updated_at: now })
      .where("id", "=", externalToken.authorizationId)
      .execute(),
  ]);

  return {
    user: {
      id: externalToken.userId,
      azure_oid: externalToken.azure_oid,
      email: externalToken.email,
      name: externalToken.name,
      role: externalToken.role,
      created_at: externalToken.created_at,
    },
    externalAI: {
      tokenId: externalToken.tokenId,
      authorizationId: externalToken.authorizationId,
      clientId: externalToken.clientId,
      clientKey: externalToken.clientKey,
      clientTitle: externalToken.clientTitle,
      clientDescription: externalToken.clientDescription,
      scopes: externalToken.scopes,
    },
  };
}

export async function resolveAuthContext(
  db: Kysely<Database>,
  authHeader: string,
  cookieHeader: string | undefined,
): Promise<ResolvedAuthContext> {
  const rawRefreshToken = parseRefreshToken(cookieHeader);

  if (rawRefreshToken) {
    const sessionRepo = createSessionRepository(db);
    const session = await sessionRepo.findByRefreshTokenHash(hashRefreshToken(rawRefreshToken));

    if (session) {
      await sessionRepo.updateLastSeen(session.id);

      const sessionUser = await db
        .selectFrom("users")
        .selectAll()
        .where("id", "=", session.user_id)
        .executeTakeFirst();

      if (sessionUser) {
        return { user: sessionUser, externalAI: null };
      }
    }
  }

  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return { user: null, externalAI: null };
  }

  try {
    const payload = await verifyAccessToken(token);
    const user = await db
      .selectFrom("users")
      .selectAll()
      .where("id", "=", payload.sub)
      .executeTakeFirst();
    return { user: user ?? null, externalAI: null };
  } catch {
    // Fall through to Entra token verification
  }

  const entraUser = await verifyEntraToken(token);
  if (entraUser) {
    const user = await upsertUser(entraUser, db).catch(() => null);
    return { user, externalAI: null };
  }

  const externalAuth = await resolveExternalAIAuth(db, token);
  if (externalAuth) {
    return externalAuth;
  }

  return { user: null, externalAI: null };
}

export async function resolveUser(
  db: Kysely<Database>,
  authHeader: string,
  cookieHeader: string | undefined,
): Promise<User | null> {
  const context = await resolveAuthContext(db, authHeader, cookieHeader);
  return context.user;
}
