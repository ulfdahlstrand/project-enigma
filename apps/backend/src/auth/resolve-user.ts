import type { Kysely } from "kysely";
import type { Database, User } from "../db/types.js";
import { parseRefreshToken, hashRefreshToken } from "./refresh-token.js";
import { createSessionRepository } from "./session-repository.js";
import { verifyAccessToken } from "./jwt.js";
import { verifyGoogleToken } from "./verify-google-token.js";
import { upsertUser } from "./upsert-user.js";

/**
 * Resolves the authenticated user from either:
 *   1. the backend-managed session cookie
 *   2. a self-issued bearer token
 *   3. a legacy Google bearer token
 *
 * Cookie/session auth is preferred so the backend can transition away from
 * frontend-managed Authorization headers without breaking older clients.
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
    // Fall through to legacy Google token verification
  }

  const googleUser = await verifyGoogleToken(token);
  if (!googleUser) {
    return null;
  }

  return upsertUser(googleUser, db).catch(() => null);
}
