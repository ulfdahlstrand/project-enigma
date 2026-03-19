import type { Kysely } from "kysely";
import type { Database, UserSession, NewUserSession } from "../db/types.js";

export interface CreateSessionParams {
  userId: string;
  expiresAt: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
  refreshTokenHash?: string | null;
}

export interface SessionRepository {
  createSession(params: CreateSessionParams): Promise<UserSession>;
  findByRefreshTokenHash(hash: string): Promise<UserSession | undefined>;
  updateLastSeen(sessionId: string): Promise<void>;
  revokeSession(sessionId: string): Promise<void>;
  revokeAllUserSessions(userId: string): Promise<void>;
}

export function createSessionRepository(db: Kysely<Database>): SessionRepository {
  return {
    async createSession(params) {
      const row: NewUserSession = {
        user_id: params.userId,
        expires_at: params.expiresAt,
        ip_address: params.ipAddress ?? null,
        user_agent: params.userAgent ?? null,
        refresh_token_hash: params.refreshTokenHash ?? null,
      };
      return db
        .insertInto("user_sessions")
        .values(row)
        .returningAll()
        .executeTakeFirstOrThrow();
    },

    async findByRefreshTokenHash(hash) {
      return db
        .selectFrom("user_sessions")
        .selectAll()
        .where("refresh_token_hash", "=", hash)
        .where("revoked_at", "is", null)
        .where("expires_at", ">", new Date())
        .executeTakeFirst();
    },

    async updateLastSeen(sessionId) {
      await db
        .updateTable("user_sessions")
        .set({ last_seen_at: new Date() })
        .where("id", "=", sessionId)
        .execute();
    },

    async revokeSession(sessionId) {
      await db
        .updateTable("user_sessions")
        .set({ revoked_at: new Date() })
        .where("id", "=", sessionId)
        .execute();
    },

    async revokeAllUserSessions(userId) {
      await db
        .updateTable("user_sessions")
        .set({ revoked_at: new Date() })
        .where("user_id", "=", userId)
        .where("revoked_at", "is", null)
        .execute();
    },
  };
}
