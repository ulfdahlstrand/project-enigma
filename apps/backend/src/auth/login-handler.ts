import type { IncomingMessage, ServerResponse } from "node:http";
import { verifyEntraToken } from "./verify-entra-token.js";
import { upsertUser } from "./upsert-user.js";
import { signAccessToken } from "./jwt.js";
import {
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiresAt,
  buildRefreshCookie,
} from "./refresh-token.js";
import { createSessionRepository } from "./session-repository.js";
import { getDb } from "../db/client.js";

const IS_PRODUCTION = process.env["NODE_ENV"] === "production";

/**
 * POST /auth/login
 *
 * Body: { credential: string }  — Entra ID token from the SPA login flow
 *
 * Response: { accessToken: string }
 * Cookie: cv_refresh_token (HttpOnly)
 */
export async function loginHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }

  let body: { credential?: string };
  try {
    body = JSON.parse(Buffer.concat(chunks).toString()) as { credential?: string };
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid JSON" }));
    return;
  }

  if (!body.credential) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "credential is required" }));
    return;
  }

  const entraUser = await verifyEntraToken(body.credential);
  if (!entraUser) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid Entra token" }));
    return;
  }

  const db = getDb();
  const user = await upsertUser(entraUser, db);

  const rawRefreshToken = generateRefreshToken();
  const refreshHash = hashRefreshToken(rawRefreshToken);
  const expiresAt = refreshTokenExpiresAt();

  const sessionRepo = createSessionRepository(db);
  await sessionRepo.createSession({
    userId: user.id,
    expiresAt,
    refreshTokenHash: refreshHash,
    ipAddress: req.headers["x-forwarded-for"]?.toString() ?? req.socket.remoteAddress ?? null,
    userAgent: req.headers["user-agent"] ?? null,
  });

  const accessToken = await signAccessToken({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });

  res.writeHead(200, {
    "Content-Type": "application/json",
    "Set-Cookie": buildRefreshCookie(rawRefreshToken, IS_PRODUCTION),
  });
  res.end(JSON.stringify({ accessToken }));
}
