import type { IncomingMessage, ServerResponse } from "node:http";
import { getDb } from "../db/client.js";
import { signAccessToken } from "./jwt.js";
import {
  buildRefreshCookie,
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiresAt,
} from "./refresh-token.js";
import { createSessionRepository } from "./session-repository.js";

const IS_PRODUCTION = process.env["NODE_ENV"] === "production";
const TEST_AUTH_ENABLED = process.env["ENABLE_TEST_AUTH"] === "true";

type TestLoginBody = {
  userId?: string;
  googleSub?: string;
  email?: string;
  name?: string;
  role?: "admin" | "consultant";
};

const DEFAULT_TEST_USER = {
  id: "40000000-0000-4000-8000-000000000001",
  googleSub: "playwright-admin-sub",
  email: "playwright-admin@example.com",
  name: "Playwright Admin",
  role: "admin" as const,
};

export async function testLoginHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!TEST_AUTH_ENABLED) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not Found" }));
    return;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }

  let body: TestLoginBody = {};
  if (chunks.length > 0) {
    try {
      body = JSON.parse(Buffer.concat(chunks).toString()) as TestLoginBody;
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid JSON" }));
      return;
    }
  }

  const userId = body.userId ?? DEFAULT_TEST_USER.id;
  const googleSub = body.googleSub ?? body.userId ?? DEFAULT_TEST_USER.googleSub;
  const email = body.email ?? DEFAULT_TEST_USER.email;
  const name = body.name ?? DEFAULT_TEST_USER.name;
  const role = body.role ?? DEFAULT_TEST_USER.role;

  const db = getDb();
  const user = await db
    .insertInto("users")
    .values({
      id: userId,
      google_sub: googleSub,
      email,
      name,
      role,
    })
    .onConflict((oc) =>
      oc.column("google_sub").doUpdateSet({
        email,
        name,
        role,
      })
    )
    .returning(["id", "email", "name", "role"])
    .executeTakeFirstOrThrow();

  const rawRefreshToken = generateRefreshToken();
  const refreshHash = hashRefreshToken(rawRefreshToken);
  const expiresAt = refreshTokenExpiresAt();

  const sessionRepo = createSessionRepository(db);
  await sessionRepo.createSession({
    userId: user.id,
    expiresAt,
    refreshTokenHash: refreshHash,
    ipAddress: req.headers["x-forwarded-for"]?.toString() ?? req.socket.remoteAddress ?? null,
    userAgent: req.headers["user-agent"] ?? "playwright",
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
  res.end(JSON.stringify({ accessToken, user }));
}
