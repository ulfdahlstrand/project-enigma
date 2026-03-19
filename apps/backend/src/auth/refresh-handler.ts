import type { IncomingMessage, ServerResponse } from "node:http";
import { signAccessToken } from "./jwt.js";
import {
  parseRefreshToken,
  hashRefreshToken,
  generateRefreshToken,
  refreshTokenExpiresAt,
  buildRefreshCookie,
} from "./refresh-token.js";
import { createSessionRepository } from "./session-repository.js";
import { getDb } from "../db/client.js";
import type { Database } from "../db/types.js";
import type { Kysely } from "kysely";

const IS_PRODUCTION = process.env["NODE_ENV"] === "production";

/**
 * POST /auth/refresh
 *
 * Reads cv_refresh_token cookie → validates session → issues new access token.
 * Rotates the refresh token on each use (refresh token rotation).
 *
 * Response: { accessToken: string }
 */
export async function refreshHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const rawToken = parseRefreshToken(req.headers["cookie"]);
  if (!rawToken) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "No refresh token" }));
    return;
  }

  const db: Kysely<Database> = getDb();
  const sessionRepo = createSessionRepository(db);
  const session = await sessionRepo.findByRefreshTokenHash(hashRefreshToken(rawToken));

  if (!session) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid or expired refresh token" }));
    return;
  }

  // Fetch the user for token payload
  const user = await db
    .selectFrom("users")
    .selectAll()
    .where("id", "=", session.user_id)
    .executeTakeFirst();

  if (!user) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "User not found" }));
    return;
  }

  // Rotate refresh token
  const newRawToken = generateRefreshToken();
  const newHash = hashRefreshToken(newRawToken);
  const newExpiresAt = refreshTokenExpiresAt();

  await db
    .updateTable("user_sessions")
    .set({
      refresh_token_hash: newHash,
      expires_at: newExpiresAt,
      last_seen_at: new Date(),
    })
    .where("id", "=", session.id)
    .execute();

  const accessToken = await signAccessToken({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });

  res.writeHead(200, {
    "Content-Type": "application/json",
    "Set-Cookie": buildRefreshCookie(newRawToken, IS_PRODUCTION),
  });
  res.end(JSON.stringify({ accessToken }));
}
