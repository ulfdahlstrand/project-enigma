import type { IncomingMessage, ServerResponse } from "node:http";
import {
  parseRefreshToken,
  hashRefreshToken,
  clearRefreshCookie,
} from "./refresh-token.js";
import { createSessionRepository } from "./session-repository.js";
import { getDb } from "../db/client.js";

const IS_PRODUCTION = process.env["NODE_ENV"] === "production";

/**
 * POST /auth/logout
 *
 * Revokes the session associated with the refresh token cookie and clears it.
 */
export async function logoutHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const rawToken = parseRefreshToken(req.headers["cookie"]);

  if (rawToken) {
    const db = getDb();
    const sessionRepo = createSessionRepository(db);
    const session = await sessionRepo.findByRefreshTokenHash(hashRefreshToken(rawToken));
    if (session) {
      await sessionRepo.revokeSession(session.id);
    }
  }

  res.writeHead(200, {
    "Content-Type": "application/json",
    "Set-Cookie": clearRefreshCookie(IS_PRODUCTION),
  });
  res.end(JSON.stringify({ ok: true }));
}
