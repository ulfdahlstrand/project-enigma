import type { Kysely } from "kysely";
import type { Database, User } from "../db/types.js";
import { parseRefreshToken, hashRefreshToken } from "./refresh-token.js";
import { createSessionRepository } from "./session-repository.js";
import { verifyAccessToken } from "./jwt.js";
import { verifyEntraToken } from "./verify-entra-token.js";
import { upsertUser } from "./upsert-user.js";

/**
 * Resolves the authenticated user from either:
 *   1. the backend-managed session cookie
 *   2. a self-issued bearer token
 *   3. an Entra bearer token
 *
 * Cookie/session auth is preferred, but Entra bearer token verification remains
 * available as a compatibility path for callers that still provide one.
 */
export async function resolveUser(
  db: Kysely<Database>,
  authHeader: string,
  cookieHeader: string | undefined
): Promise<User | null> {
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
        return sessionUser;
      }
    }
  }

  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return null;
  }

  try {
    const payload = await verifyAccessToken(token);
    const user = await db
      .selectFrom("users")
      .selectAll()
      .where("id", "=", payload.sub)
      .executeTakeFirst();
    return user ?? null;
  } catch {
    // Fall through to Entra token verification
  }

  const entraUser = await verifyEntraToken(token);
  if (!entraUser) {
    return null;
  }

  return upsertUser(entraUser, db).catch(() => null);
}
