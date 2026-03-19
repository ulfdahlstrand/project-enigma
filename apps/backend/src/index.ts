import { createServer } from "node:http";
import { OpenAPIGenerator } from "@orpc/openapi";
import { OpenAPIHandler } from "@orpc/openapi/node";
import { onError } from "@orpc/server";
import { CORSPlugin } from "@orpc/server/plugins";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { contract } from "@cv-tool/contracts";
import { router } from "./router.js";
import { verifyGoogleToken } from "./auth/verify-google-token.js";
import { verifyAccessToken } from "./auth/jwt.js";
import { upsertUser } from "./auth/upsert-user.js";
import { loginHandler } from "./auth/login-handler.js";
import { refreshHandler } from "./auth/refresh-handler.js";
import { logoutHandler } from "./auth/logout-handler.js";
import type { User } from "./db/types.js";
import { getDb } from "./db/client.js";

export type AppContext = { user: User | null };

const port = Number(process.env["BACKEND_PORT"] ?? 3001);

const generator = new OpenAPIGenerator({
  schemaConverters: [new ZodToJsonSchemaConverter()],
});

const spec = await generator.generate(contract, {
  info: { title: "cv-tool API", version: "0.0.0" },
});
const specJson = JSON.stringify(spec);

const handler = new OpenAPIHandler(router, {
  plugins: [new CORSPlugin()],
  interceptors: [
    onError((error) => {
      console.error("[backend] unhandled error:", error);
    }),
  ],
});

/**
 * Resolves the authenticated user from the request.
 *
 * Verification order:
 *   1. Self-issued JWT (HS256) — primary path after Phase 4 is deployed
 *   2. Google ID token — legacy fallback during rollout
 */
async function resolveUser(authHeader: string): Promise<User | null> {
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;

  // Try self-issued JWT first
  try {
    const payload = await verifyAccessToken(token);
    // Fetch full user from DB so we always have current data
    const user = await getDb()
      .selectFrom("users")
      .selectAll()
      .where("id", "=", payload.sub)
      .executeTakeFirst();
    return user ?? null;
  } catch {
    // Fall through to Google token verification
  }

  // Legacy: Google ID token
  const googleUser = await verifyGoogleToken(token);
  if (!googleUser) return null;
  return upsertUser(googleUser).catch(() => null);
}

const server = createServer(async (req, res) => {
  // Apply CORS headers to every response (preflight + actual requests)
  const origin = req.headers["origin"] ?? "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Auth endpoints — handled before the oRPC router
  if (req.method === "POST" && req.url === "/auth/login") {
    await loginHandler(req, res);
    return;
  }
  if (req.method === "POST" && req.url === "/auth/refresh") {
    await refreshHandler(req, res);
    return;
  }
  if (req.method === "POST" && req.url === "/auth/logout") {
    await logoutHandler(req, res);
    return;
  }

  if (req.method === "GET" && req.url === "/openapi.json") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(specJson);
    return;
  }

  const user = await resolveUser(req.headers["authorization"] ?? "");

  const result = await handler.handle(req, res, { context: { user } });

  if (!result.matched) {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "Not Found" }));
  }
});

server.listen(port, () => {
  console.log(`[backend] Server listening on port ${port}`);
  console.log(`[backend] OpenAPI spec at http://localhost:${port}/openapi.json`);
});
